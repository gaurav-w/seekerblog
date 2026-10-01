"""Align the original Sanskrit to the supplied MP3, using cached local models.

Run transcribe-gita.py first. ASR is only used to find approximate verse windows;
the displayed Sanskrit is never replaced with machine transcription.
"""
import difflib
import argparse
import json
import os
import re
from pathlib import Path

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('--chapter', type=int, required=True, choices=range(1, 19))
parser.add_argument('--redo', type=int, nargs='*', default=[])
redo = set(parser.parse_args().redo)

ROOT = Path(__file__).resolve().parents[2]
chapter = parser.parse_args().chapter
WORK = ROOT / '.gita-work' / f'chapter-{chapter}'
data_source = (ROOT / 'gita' / str(chapter) / 'data.js').read_text(encoding='utf-8')
verses = json.loads(data_source.split('=', 1)[1].strip().removesuffix(';'))
transcript = json.loads((WORK / 'transcription.json').read_text(encoding='utf-8'))

def normalize(text):
    text = text.replace('श', 'स').replace('ष', 'स').replace('ण', 'न').replace('ँ', 'ं').replace('ी', 'ि').replace('ू', 'ु').replace('ृ', '्रि')
    return ''.join(c for c in text if '\u0900' <= c <= '\u0963' and c not in 'ः्ऽ')

ref, offsets = '', []
for v in verses:
    offsets.append(len(ref))
    ref += normalize(v['sanskrit'])
offsets.append(len(ref))
heard, heard_times = '', []
for segment in transcript:
    for word in segment['words']:
        text = normalize(word['word'])
        heard += text
        heard_times.extend(np.linspace(word['start'], word['end'], len(text), endpoint=False).tolist())
matches = difflib.SequenceMatcher(None, ref, heard, autojunk=False).get_matching_blocks()
positions, timestamps = [], []
for block in matches:
    if block.size < 3:
        continue
    positions.extend(range(block.a, block.a + block.size))
    timestamps.extend(heard_times[block.b:block.b + block.size])
char_times = np.interp(np.arange(len(ref)), positions, timestamps)
windows = []
for i, verse in enumerate(verses):
    lines = []
    cursor = offsets[i]
    for line in verse['sanskrit'].splitlines():
        length = len(normalize(line))
        start = max(0, float(char_times[cursor]) - .25)
        end = float(char_times[cursor + length - 1]) + .65
        tokens = [t for t in line.split() if re.search(r'[\u0900-\u0963]', t)]
        lines.append({'start': start, 'end': end, 'text': ' '.join(tokens)})
        cursor += length
    windows.append(lines)
# The ASR returned Latin transliteration for verse 33. Use its observed phrase
# windows directly so a preceding Sanskrit syllable cannot be reused by CTC.
overrides = json.loads((ROOT / 'authoring' / 'scripts' / f'gita-alignment-windows-chapter-{chapter}.json').read_text(encoding='utf-8'))
cue_overrides = overrides.pop('_cueOverrides', {})
overrides.pop('_clipEndOverrides', None)
for number, bounds in overrides.items():
    for line, bound in zip(windows[int(number)-1], bounds):
        line.update(bound)
(WORK / 'windows.json').write_text(json.dumps(windows, ensure_ascii=False, indent=2), encoding='utf-8')
print('Aligning each Sanskrit line within transcription-derived bounds.', flush=True)

import torch
import whisperx
torch.set_num_threads(6)
model, metadata = whisperx.load_align_model('hi', 'cpu', model_cache_only=True)
audio = whisperx.load_audio(str(ROOT / f'authoring/gita/chapter-{chapter}.mp3'))
results = []
for index, window in enumerate(windows):
    cache = WORK / f'lines-{index+1:02}.json'
    if cache.exists() and index + 1 not in redo:
        result = json.loads(cache.read_text(encoding='utf-8'))
    else:
        result = whisperx.align(window, model, metadata, audio, 'cpu', return_char_alignments=False)
        cache.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    words = result['word_segments']
    # A chapter-specific, transcript-anchored cue override is only used when
    # the acoustic model collapses a clearly spoken phrase into a short range.
    # Keep it explicit and verify it still matches the displayed tokenization.
    replacement = cue_overrides.get(str(index + 1))
    if replacement:
        assert [word['word'] for word in words] == [word['word'] for word in replacement], \
            f'Cue override token mismatch in verse {index + 1}'
        words = [{**word, 'start': revised['start'], 'end': revised['end']}
                 for word, revised in zip(words, replacement)]
    results.append(words)
    scores = [w.get('score',0) for w in words]
    print(f'Verse {index+1}: {len(words)} words, confidence {np.mean(scores):.2f}', flush=True)
(WORK / 'aligned.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
