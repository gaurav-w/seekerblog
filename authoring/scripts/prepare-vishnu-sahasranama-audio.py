"""Create local audio clips and word cues for the Vishnu Sahasranama reader.

The supplied master recording is transcribed locally only to locate the canonical
reader text.  WhisperX then aligns each displayed line inside that window.  The
public manifest is generated only from that text; ASR never replaces it.
"""
from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.vishnu-work'
SOURCE = ROOT / 'authoring' / 'vishnu-sahasranama-source.m4a'
TRANSPORT = ROOT / 'authoring' / 'vishnu-sahasranama-source.mp3'
OUT = ROOT / 'vishnu-sahasranama'
FFMPEG = shutil.which('ffmpeg') or r'E:\Vishnu Sahasranama\bin\ffmpeg.exe'
GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
GROQ_MODEL = 'whisper-large-v3'
GROQ_RATE_PER_HOUR = .111
GROQ_PROMPT = 'श्री विष्णु सहस्रनाम स्तोत्रम्। संस्कृत श्लोक पाठ। विश्वं विष्णुर्वषट्कारो।'


def normalize(text: str) -> str:
    text = (text.replace('श', 'स').replace('ष', 'स').replace('ण', 'न')
            .replace('ँ', 'ं').replace('ी', 'ि').replace('ू', 'ु').replace('ृ', '्रि'))
    return ''.join(char for char in text if '\u0900' <= char <= '\u0963' and char not in 'ः्ऽ')


def words(line: str) -> list[str]:
    return [word for word in line.split() if re.search(r'[\u0900-\u0963]', word)]


def load_verses() -> list[dict]:
    return json.loads((WORK / 'verses.json').read_text(encoding='utf-8'))


def transcribe() -> None:
    os.environ['HF_HUB_OFFLINE'] = '1'
    from faster_whisper import WhisperModel
    model = WhisperModel('small', device='cpu', compute_type='int8', local_files_only=True, cpu_threads=6)
    segments, _ = model.transcribe(str(TRANSPORT), language='hi', beam_size=5, word_timestamps=True,
                                  condition_on_previous_text=False, vad_filter=False, no_speech_threshold=None)
    result = []
    for segment in segments:
        result.append({'start': segment.start, 'end': segment.end, 'text': segment.text,
                       'words': [{'word': word.word, 'start': word.start, 'end': word.end}
                                 for word in segment.words]})
        print(f'{segment.start:.1f}-{segment.end:.1f}', flush=True)
    (WORK / 'transcription.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')


def create_windows() -> None:
    verses = load_verses()
    transcript = json.loads((WORK / 'transcription.json').read_text(encoding='utf-8'))
    ref, offsets = '', []
    for verse in verses:
        offsets.append(len(ref))
        ref += normalize(verse['devanagari'])
    offsets.append(len(ref))
    heard, heard_times = '', []
    for segment in transcript:
        for heard_word in segment['words']:
            heard_text = normalize(heard_word['word'])
            if not heard_text:
                continue
            heard += heard_text
            span = max(1, len(heard_text))
            heard_times.extend(heard_word['start'] + (heard_word['end'] - heard_word['start']) * index / span
                              for index in range(span))
    matches = difflib.SequenceMatcher(None, ref, heard, autojunk=False).get_matching_blocks()
    points, timestamps = [], []
    for block in matches:
        if block.size >= 3:
            points.extend(range(block.a, block.a + block.size))
            timestamps.extend(heard_times[block.b:block.b + block.size])
    if len(points) < 10:
        raise RuntimeError('The local transcript did not provide enough matching Sanskrit text.')
    import numpy as np
    char_times = np.interp(np.arange(len(ref)), points, timestamps)
    windows = []
    for index, verse in enumerate(verses):
        lines, cursor = [], offsets[index]
        for line in verse['devanagari'].splitlines():
            length = len(normalize(line))
            if not length:
                continue
            lines.append({'start': max(0, round(float(char_times[cursor]) - .25, 3)),
                          'end': round(float(char_times[cursor + length - 1]) + .65, 3),
                          'text': ' '.join(words(line))})
            cursor += length
        windows.append(lines)
    (WORK / 'windows.json').write_text(json.dumps(windows, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Created {len(windows)} alignment windows.')


def align() -> None:
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    import numpy as np
    import torch
    import whisperx
    torch.set_num_threads(6)
    verses, windows = load_verses(), json.loads((WORK / 'windows.json').read_text(encoding='utf-8'))
    model, metadata = whisperx.load_align_model('hi', 'cpu', model_cache_only=True)
    audio = whisperx.load_audio(str(TRANSPORT))
    aligned = []
    for index, (verse, verse_windows) in enumerate(zip(verses, windows), 1):
        cache = WORK / f'lines-{index:03}.json'
        if cache.exists():
            result = json.loads(cache.read_text(encoding='utf-8'))
        else:
            result = whisperx.align(verse_windows, model, metadata, audio, 'cpu', return_char_alignments=False)
            cache.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
        aligned_words = result.get('word_segments', [])
        expected = words(verse['devanagari'])
        actual = [word.get('word') for word in aligned_words]
        if actual != expected:
            raise RuntimeError(f'{verse["key"]}: alignment tokens differ from the displayed text.')
        aligned.append(aligned_words)
        scores = [word.get('score', 0) for word in aligned_words]
        print(f'{verse["key"]}: {len(aligned_words)} words, confidence {np.mean(scores):.2f}', flush=True)
    (WORK / 'aligned.json').write_text(json.dumps(aligned, ensure_ascii=False, indent=2), encoding='utf-8')
    (WORK / 'alignment-meta.json').write_text(json.dumps({
        'method': 'Local forced alignment of canonical Sanskrit within local ASR-derived windows.',
        'reviewStatus': 'machine-aligned'
    }, ensure_ascii=False, indent=2), encoding='utf-8')


def build(selected_entries: set[int] | None = None) -> None:
    verses = load_verses()
    aligned = json.loads((WORK / 'aligned.json').read_text(encoding='utf-8'))
    if len(verses) != len(aligned):
        raise RuntimeError('Alignment count does not match reader entries.')
    destination = OUT / 'audio'
    destination.mkdir(exist_ok=True)
    records = []
    for index, (verse, cue_words) in enumerate(zip(verses, aligned), 1):
        if not cue_words:
            records.append({'key': verse['key'], 'available': False, 'words': []})
            continue
        start = max(0, float(cue_words[0]['start']) - .18)
        end = float(cue_words[-1]['end']) + .28
        if index > 1 and aligned[index - 2]:
            start = max(start, (float(aligned[index - 2][-1]['end']) + float(cue_words[0]['start'])) / 2)
        if index < len(aligned) and aligned[index]:
            end = min(end, (float(cue_words[-1]['end']) + float(aligned[index][0]['start'])) / 2)
        if end - start < 1:
            raise RuntimeError(f'{verse["key"]}: impossible clip duration.')
        filename = f'{index:03}.mp3'
        if selected_entries is None or index in selected_entries:
            subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{start:.3f}', '-i', str(TRANSPORT),
                            '-t', f'{end - start:.3f}', '-vn', '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', '96k',
                            str(destination / filename)], check=True)
        clip_words = []
        for word in cue_words:
            cue_start = max(0, min(end - start, float(word['start']) - start))
            cue_end = max(cue_start, min(end - start, float(word['end']) - start))
            clip_words.append({'text': word['word'], 'start': round(cue_start, 3), 'end': round(cue_end, 3),
                               'score': word.get('score', 0)})
        for previous, following in zip(clip_words, clip_words[1:]):
            following['start'] = max(following['start'], previous['end'])
            following['end'] = max(following['end'], following['start'])
        records.append({'key': verse['key'], 'available': True, 'audio': f'audio/{filename}', 'sourceStart': round(start, 3),
                        'sourceEnd': round(end, 3), 'duration': round(end - start, 3),
                        'words': clip_words})
    alignment_meta = json.loads((WORK / 'alignment-meta.json').read_text(encoding='utf-8')) if (WORK / 'alignment-meta.json').exists() else {
        'method': 'Local forced alignment of canonical Sanskrit within local ASR-derived windows.', 'reviewStatus': 'machine-aligned'}
    manifest = {'version': 1, 'source': {'youtube': 'https://www.youtube.com/watch?v=W2gNg8-XQRg',
                'id': 'W2gNg8-XQRg', 'title': 'Sri Vishnu Sahasranama',
                'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                'transportSha256': hashlib.sha256(TRANSPORT.read_bytes()).hexdigest()},
                'method': alignment_meta['method'], 'reviewStatus': alignment_meta['reviewStatus'], 'entries': records}
    payload = json.dumps(manifest, ensure_ascii=False, indent=2)
    (OUT / 'timings.json').write_text(payload + '\n', encoding='utf-8')
    (OUT / 'timings.js').write_text(f'window.VISHNU_SAHASRANAMA_TIMINGS = {payload};\n', encoding='utf-8')
    print(f'Wrote {len(records)} timing records and rendered {len(selected_entries) if selected_entries is not None else len(records)} clips.')


def estimated_duration() -> float:
    ffprobe = shutil.which('ffprobe') or r'E:\Vishnu Sahasranama\bin\ffprobe.exe'
    result = subprocess.check_output([ffprobe, '-v', 'error', '-show_entries', 'format=duration',
                                      '-of', 'default=noprint_wrappers=1:nokey=1', str(TRANSPORT)], text=True)
    return float(result.strip())


def estimate() -> None:
    """Build a transparent audio-driven fallback when local alignment is unavailable.

    Each cue is calculated from the recording's measured duration and the Sanskrit
    syllable weights.  It is deliberately labelled provisional; rerunning the
    transcribe/windows/align/build path replaces it with measured word cues.
    """
    verses = load_verses()
    def syllables(text: str) -> int:
        return max(1, len(re.findall(r'[aāiīuūṛṝḷeēoō]', text.lower().replace('ai', 'a').replace('au', 'a'))))
    entry_weights = [sum(syllables(token) for token in verse['iast'].split()) for verse in verses]
    active_start, active_end = .522, estimated_duration() - .652
    seconds_per_weight = (active_end - active_start) / sum(entry_weights)
    destination = OUT / 'audio'
    destination.mkdir(exist_ok=True)
    records, cursor = [], active_start
    for index, (verse, weight) in enumerate(zip(verses, entry_weights), 1):
        end = active_end if index == len(verses) else cursor + weight * seconds_per_weight
        filename = f'{index:03}.mp3'
        subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{cursor:.3f}', '-i', str(TRANSPORT),
                        '-t', f'{end - cursor:.3f}', '-vn', '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', '96k',
                        str(destination / filename)], check=True)
        tokens = words(verse['devanagari'])
        token_weights = [syllables(token) for token in verse['iast'].split()
                         if not re.fullmatch(r'[|।॥॰]+', token)]
        if len(tokens) != len(token_weights):
            raise RuntimeError(f'{verse["key"]}: display and transliteration token counts differ.')
        running = 0
        cues = []
        for token, token_weight in zip(tokens, token_weights):
            start = (end - cursor) * running / weight
            running += token_weight
            cues.append({'text': token, 'start': round(start, 3),
                         'end': round((end - cursor) * running / weight, 3), 'score': None})
        records.append({'key': verse['key'], 'audio': f'audio/{filename}', 'sourceStart': round(cursor, 3),
                        'sourceEnd': round(end, 3), 'duration': round(end - cursor, 3), 'words': cues})
        cursor = end
    manifest = {'version': 1, 'source': {'youtube': 'https://www.youtube.com/watch?v=W2gNg8-XQRg',
                'id': 'W2gNg8-XQRg', 'title': 'Sri Vishnu Sahasranama',
                'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                'transportSha256': hashlib.sha256(TRANSPORT.read_bytes()).hexdigest()},
                'method': 'Audio-duration and Sanskrit-syllable weighted provisional cues; replace with local forced alignment.',
                'reviewStatus': 'provisional-paced', 'entries': records}
    payload = json.dumps(manifest, ensure_ascii=False, indent=2)
    (OUT / 'timings.json').write_text(payload + '\n', encoding='utf-8')
    (OUT / 'timings.js').write_text(f'window.VISHNU_SAHASRANAMA_TIMINGS = {payload};\n', encoding='utf-8')
    print(f'Built {len(records)} provisional clips and timing records.')


def groq_key(secrets_file: str | None) -> str:
    key = os.environ.get('GROQ_API_KEY', '').strip()
    if not key and secrets_file:
        key = str(json.loads(Path(secrets_file).read_text(encoding='utf-8-sig')).get('GROQ_API_KEY', '')).strip()
    if not key:
        raise RuntimeError('No GROQ_API_KEY was available from the supplied secrets file.')
    return key


def groq_words(max_cost_usd: float | None, secrets_file: str | None, requested_chunk: int | None) -> None:
    """Cache measured Groq word timestamps in absolute source time.

    The recording is split into independently timestamped MP3 uploads that stay
    below Groq's attachment limit.  The key and raw request headers never enter
    the repository or command output.
    """
    duration = estimated_duration()
    estimate_usd = duration / 3600 * GROQ_RATE_PER_HOUR
    if max_cost_usd is None or not math.isfinite(max_cost_usd) or max_cost_usd < estimate_usd:
        raise RuntimeError(f'Provide --max-cost-usd of at least ${estimate_usd:.4f} before uploading audio.')
    import requests
    key = groq_key(secrets_file)
    directory = WORK / 'groq'
    directory.mkdir(exist_ok=True)
    fingerprint = hashlib.sha256(json.dumps({
        'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'model': GROQ_MODEL,
        'language': 'hi', 'prompt': GROQ_PROMPT, 'chunkSeconds': 900,
    }, sort_keys=True).encode()).hexdigest()
    cache = directory / f'{fingerprint}-combined.json'
    if cache.exists():
        print('Using cached Groq word timestamps.')
        return
    measured = []
    rejected = 0
    offsets = list(range(0, math.ceil(duration), 900))
    if requested_chunk is not None and not 1 <= requested_chunk <= len(offsets):
        raise RuntimeError(f'--chunk must be between 1 and {len(offsets)}.')
    for chunk_index, offset in enumerate(offsets, 1):
        if requested_chunk is not None and chunk_index != requested_chunk:
            continue
        length = min(900, duration - offset)
        chunk = directory / f'{fingerprint}-{chunk_index:02}.mp3'
        partial = directory / f'{fingerprint}-{chunk_index:02}.json'
        if not chunk.exists():
            subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(offset), '-i', str(TRANSPORT),
                            '-t', str(length), '-vn', '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', '64k', str(chunk)], check=True)
        if partial.exists():
            words_found = json.loads(partial.read_text(encoding='utf-8'))['words']
            print(f'Reusing Groq chunk {chunk_index}: {len(words_found)} words.', flush=True)
        else:
            with chunk.open('rb') as audio:
                response = requests.post(GROQ_URL, headers={'Authorization': f'Bearer {key}'}, timeout=(30, 180),
                    data=[('model', GROQ_MODEL), ('language', 'hi'), ('response_format', 'verbose_json'),
                          ('timestamp_granularities[]', 'word'), ('timestamp_granularities[]', 'segment'),
                          ('temperature', '0'), ('prompt', GROQ_PROMPT)],
                    files={'file': (chunk.name, audio, 'audio/mpeg')})
            if not response.ok:
                raise RuntimeError(f'Groq STT failed on chunk {chunk_index} with HTTP {response.status_code}.')
            words_found = response.json().get('words') or []
            if not words_found:
                raise RuntimeError(f'Groq STT returned no word timestamps for chunk {chunk_index}.')
            partial.write_text(json.dumps({'offset': offset, 'words': words_found}, ensure_ascii=False, indent=2), encoding='utf-8')
            print(f'Cached Groq chunk {chunk_index}: {len(words_found)} words.', flush=True)
        time.sleep(.2)
    if not all((directory / f'{fingerprint}-{index:02}.json').exists() for index in range(1, len(offsets) + 1)):
        print('Saved requested chunk evidence; remaining chunks still need transcription.')
        return
    measured = []
    for chunk_index, offset in enumerate(offsets, 1):
        length = min(900, duration - offset)
        words_found = json.loads((directory / f'{fingerprint}-{chunk_index:02}.json').read_text(encoding='utf-8'))['words']
        for word in words_found:
            start, end, text = word.get('start'), word.get('end'), str(word.get('word', '')).strip()
            if not text or not isinstance(start, (int, float)) or not isinstance(end, (int, float)) or not 0 <= start <= end <= length + .1:
                rejected += 1
                continue
            measured.append({'word': text, 'start': round(offset + start, 3), 'end': round(offset + end, 3)})
    if not measured:
        raise RuntimeError('No valid Groq word timestamps remained after validation.')
    measured.sort(key=lambda word: (word['start'], word['end']))
    cache.write_text(json.dumps({'fingerprint': fingerprint, 'sourceDuration': duration,
        'reviewStatus': 'stt-evidence-unreviewed', 'rejectedWords': rejected, 'words': measured}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Cached {len(measured)} Groq word timestamps; quarantined {rejected} invalid timestamps.')


def map_groq() -> None:
    """Map measured STT character time to immutable reader words in source order."""
    directory = WORK / 'groq'
    caches = sorted(directory.glob('*-combined.json'))
    if not caches:
        raise RuntimeError('Run the groq step before mapping its evidence.')
    evidence = json.loads(caches[-1].read_text(encoding='utf-8'))
    heard, heard_times = '', []
    for measured in evidence['words']:
        text = normalize(measured['word'])
        if not text:
            continue
        heard += text
        span = len(text)
        heard_times.extend(measured['start'] + (measured['end'] - measured['start']) * index / span for index in range(span))
    verses = load_verses()
    reference, offsets = '', []
    for verse in verses:
        offsets.append(len(reference))
        reference += normalize(verse['devanagari'])
    offsets.append(len(reference))
    matches = difflib.SequenceMatcher(None, reference, heard, autojunk=False).get_matching_blocks()
    positions, timestamps = [], []
    for block in matches:
        if block.size >= 3:
            positions.extend(range(block.a, block.a + block.size))
            timestamps.extend(heard_times[block.b:block.b + block.size])
    coverage = len(set(positions)) / len(reference)
    if coverage < .55:
        raise RuntimeError(f'Groq transcript only covered {coverage:.1%} of canonical Sanskrit; refusing to generate cues.')
    import numpy as np
    char_times = np.interp(np.arange(len(reference)), positions, timestamps)
    matched_positions = set(positions)
    aligned, unavailable = [], []
    for verse_index, verse in enumerate(verses):
        verse_start, verse_end = offsets[verse_index], offsets[verse_index + 1]
        verse_coverage = sum(position in matched_positions for position in range(verse_start, verse_end)) / (verse_end - verse_start)
        if verse_coverage < .4:
            aligned.append([])
            unavailable.append({'key': verse['key'], 'coverage': round(verse_coverage, 4)})
            continue
        cursor, cue_words = verse_start, []
        for token in words(verse['devanagari']):
            length = len(normalize(token))
            start = float(char_times[cursor])
            end = float(char_times[cursor + length - 1]) + .08
            cue_words.append({'word': token, 'start': start, 'end': end, 'score': None})
            cursor += length
        for current, following in zip(cue_words, cue_words[1:]):
            if current['end'] > following['start']:
                edge = (current['end'] + following['start']) / 2
                current['end'] = edge
                following['start'] = edge
            current['end'] = max(current['end'], current['start'] + .03)
        cue_words[-1]['end'] = max(cue_words[-1]['end'], cue_words[-1]['start'] + .03)
        aligned.append(cue_words)
    (WORK / 'aligned.json').write_text(json.dumps(aligned, ensure_ascii=False, indent=2), encoding='utf-8')
    (WORK / 'alignment-meta.json').write_text(json.dumps({
        'method': 'Groq Whisper Large V3 word timestamps mapped monotonically to the canonical Sanskrit text.',
        'reviewStatus': 'stt-mapped', 'groqCharacterCoverage': round(coverage, 4), 'unavailableEntries': unavailable
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Mapped Groq evidence to {len(aligned)} entries with {coverage:.1%} canonical character coverage.')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('step', choices=['transcribe', 'windows', 'align', 'build', 'estimate', 'groq', 'map-groq'])
    parser.add_argument('--max-cost-usd', type=float)
    parser.add_argument('--secrets-file')
    parser.add_argument('--chunk', type=int, help='Upload one 15-minute Groq chunk and retain its response for resume.')
    parser.add_argument('--entries', type=int, nargs='+', help='Render only these 1-based reader entries while writing the full manifest.')
    args = parser.parse_args()
    WORK.mkdir(exist_ok=True)
    if not SOURCE.is_file() or not TRANSPORT.is_file():
        raise FileNotFoundError('The original M4A and derived MP3 source files are both required.')
    if args.step == 'groq':
        groq_words(args.max_cost_usd, args.secrets_file, args.chunk)
    elif args.step == 'map-groq':
        map_groq()
    else:
        if args.step == 'build':
            selected = set(args.entries) if args.entries else None
            if selected and not all(1 <= entry <= len(load_verses()) for entry in selected):
                raise RuntimeError('Requested build entry is outside the reader range.')
            build(selected)
        else:
            {'transcribe': transcribe, 'windows': create_windows, 'align': align, 'estimate': estimate}[args.step]()


if __name__ == '__main__':
    main()
