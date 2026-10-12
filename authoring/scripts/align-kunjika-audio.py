"""Transcribe and force-align the Siddha Kunjika Stotram source recording.

The reader's Sanskrit stays immutable.  Local STT supplies only coarse windows;
WhisperX then aligns the canonical Sanskrit inside those windows.  The resulting
word spans are private build evidence used to cut clean stanza clips.
"""
from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'authoring' / 'kunjika-stotram' / 'source.m4a'
DATA = ROOT / 'stotra' / 'siddha-kunjika-stotram' / 'data.js'
WORK = ROOT / '.kunjika-work'

# The Windows console may still be configured for cp1252 even though all reader
# text and STT diagnostics are Devanagari.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


def normalize(text: str) -> str:
    """Use the same loose Sanskrit phonetic folding as the Gita pipeline."""
    text = (text.replace('श', 'स').replace('ष', 'स').replace('ण', 'न')
                .replace('ँ', 'ं').replace('ी', 'ि').replace('ू', 'ु')
                .replace('ृ', '्रि'))
    return ''.join(char for char in text
                   if '\u0900' <= char <= '\u0963' and char not in 'ः्ऽ')


def spoken_words(line: str) -> list[str]:
    return [word for word in line.split()
            if re.search(r'[\u0900-\u0963]', word)]


def load_stanzas() -> list[str]:
    source = DATA.read_text(encoding='utf-8')
    stanzas = re.findall(r"sanskrit:\s*'((?:\\.|[^'])*)'", source, re.DOTALL)
    stanzas = [stanza.replace(r'\n', '\n') for stanza in stanzas]
    if len(stanzas) != 15:
        raise RuntimeError(f'Expected 15 reader stanzas, found {len(stanzas)}.')
    return stanzas


def transcribe() -> None:
    """Run local STT with timestamps; the transcript never becomes reader text."""
    os.environ['HF_HUB_OFFLINE'] = '1'
    from faster_whisper import WhisperModel

    WORK.mkdir(exist_ok=True)
    model = WhisperModel('small', device='cpu', compute_type='int8',
                         local_files_only=True, cpu_threads=6)
    segments, _ = model.transcribe(
        str(SOURCE), language='hi', beam_size=5, word_timestamps=True,
        condition_on_previous_text=False, vad_filter=False,
        no_speech_threshold=None,
        initial_prompt='शिव उवाच। शृणु देवि प्रवक्ष्यामि कुञ्जिकास्तोत्रमुत्तमम्।',
    )
    result = []
    for segment in segments:
        result.append({
            'start': segment.start,
            'end': segment.end,
            'text': segment.text,
            'words': [{'word': word.word, 'start': word.start, 'end': word.end}
                      for word in segment.words],
        })
        print(f'{segment.start:.2f}-{segment.end:.2f}  {segment.text}', flush=True)
    (WORK / 'transcription.json').write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Saved {len(result)} STT segments.', flush=True)


def create_windows() -> None:
    """Map the local STT output to coarse, per-line WhisperX search windows."""
    import numpy as np

    stanzas = load_stanzas()
    transcript = json.loads((WORK / 'transcription.json').read_text(encoding='utf-8'))
    reference, offsets = '', []
    for stanza in stanzas:
        offsets.append(len(reference))
        reference += normalize(stanza)
    offsets.append(len(reference))

    heard, heard_times = '', []
    for segment in transcript:
        for word in segment['words']:
            heard_word = normalize(word['word'])
            if not heard_word:
                continue
            heard += heard_word
            span = len(heard_word)
            heard_times.extend(
                word['start'] + (word['end'] - word['start']) * index / span
                for index in range(span)
            )

    matches = difflib.SequenceMatcher(None, reference, heard, autojunk=False).get_matching_blocks()
    positions, timestamps = [], []
    for block in matches:
        if block.size >= 3:
            positions.extend(range(block.a, block.a + block.size))
            timestamps.extend(heard_times[block.b:block.b + block.size])
    if len(positions) < 20:
        raise RuntimeError('STT did not provide enough Sanskrit anchors to create alignment windows.')

    character_times = np.interp(np.arange(len(reference)), positions, timestamps)
    windows = []
    for index, stanza in enumerate(stanzas, 1):
        stanza_windows, cursor = [], offsets[index - 1]
        for line in stanza.splitlines():
            length = len(normalize(line))
            if not length:
                continue
            stanza_windows.append({
                'start': round(max(0, float(character_times[cursor]) - .30), 3),
                'end': round(float(character_times[cursor + length - 1]) + .75, 3),
                'text': ' '.join(spoken_words(line)),
            })
            cursor += length
        if not stanza_windows or any(item['end'] <= item['start'] for item in stanza_windows):
            raise RuntimeError(f'Stanza {index}: invalid STT-derived alignment window.')
        windows.append(stanza_windows)
        print(f'Stanza {index:02}: {stanza_windows[0]["start"]:.3f}-{stanza_windows[-1]["end"]:.3f}', flush=True)

    (WORK / 'windows.json').write_text(
        json.dumps(windows, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Created windows for {len(windows)} stanzas.', flush=True)


def align() -> None:
    """Force-align each canonical Sanskrit stanza within its STT-derived bounds."""
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    import numpy as np
    import torch
    import whisperx

    stanzas = load_stanzas()
    windows = json.loads((WORK / 'windows.json').read_text(encoding='utf-8'))
    if len(windows) != len(stanzas):
        raise RuntimeError('Alignment-window count does not match reader stanzas.')
    torch.set_num_threads(6)
    model, metadata = whisperx.load_align_model('hi', 'cpu', model_cache_only=True)
    audio = whisperx.load_audio(str(SOURCE))
    aligned = []
    for index, (stanza, stanza_windows) in enumerate(zip(stanzas, windows), 1):
        result = whisperx.align(stanza_windows, model, metadata, audio, 'cpu',
                                return_char_alignments=False, print_progress=False)
        words = result.get('word_segments', [])
        expected = [normalize(word) for line in stanza.splitlines() for word in spoken_words(line)]
        actual = [normalize(word.get('word', '')) for word in words]
        if expected != actual:
            raise RuntimeError(
                f'Stanza {index}: force alignment did not retain the canonical token sequence '
                f'({len(actual)} aligned vs {len(expected)} expected).')
        if not words or words[-1].get('end') is None or words[0].get('start') is None:
            raise RuntimeError(f'Stanza {index}: alignment returned no timed words.')
        aligned.append(words)
        scores = [word.get('score', 0) for word in words]
        print(f'Stanza {index:02}: {len(words)} words, mean confidence {np.mean(scores):.2f}', flush=True)

    (WORK / 'aligned.json').write_text(
        json.dumps(aligned, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (WORK / 'alignment-meta.json').write_text(json.dumps({
        'method': 'Local faster-whisper STT word anchors plus cached WhisperX Hindi force alignment of canonical Sanskrit.',
        'reviewStatus': 'machine-aligned',
        'sttModel': 'faster-whisper small (local)',
        'alignModel': 'theainerd/Wav2Vec2-large-xlsr-hindi (local cache)',
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Force-aligned {len(aligned)} stanzas.', flush=True)


parser = argparse.ArgumentParser()
parser.add_argument('step', choices=['transcribe', 'windows', 'align'])
args = parser.parse_args()
if not SOURCE.is_file():
    raise SystemExit(f'Missing source recording: {SOURCE}')
{'transcribe': transcribe, 'windows': create_windows, 'align': align}[args.step]()
