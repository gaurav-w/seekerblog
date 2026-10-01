"""Build small verse clips and static word cues from local alignment output."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--chapter', type=int, required=True, choices=range(1, 19))
parser.add_argument('--verses', type=int, nargs='+', help='Rebuild only these 1-based verse clips and manifest entries.')
args = parser.parse_args()
chapter = args.chapter
ROOT = Path(__file__).resolve().parents[2]
source = ROOT / f'authoring/gita/chapter-{chapter}.mp3'
directory = ROOT / 'gita' / str(chapter) / 'audio'
directory.mkdir(parents=True, exist_ok=True)
text = (ROOT / 'gita' / str(chapter) / 'data.js').read_text(encoding='utf-8')
verses = json.loads(text.split('=', 1)[1].strip().removesuffix(';'))
aligned = json.loads((ROOT / '.gita-work' / f'chapter-{chapter}' / 'aligned.json').read_text(encoding='utf-8'))
assert len(aligned) == len(verses)
selected = set(args.verses or range(1, len(verses) + 1))
assert all(1 <= verse <= len(verses) for verse in selected), 'Verse selection is outside this chapter.'
# CTC line alignments can leave two neighbouring labels slightly crossed at a
# line hand-off.  Preserve their combined interval but assign the shared edge
# to its midpoint; this is a deterministic repair, not an invented cue.
for previous, following in zip(aligned, aligned[1:]):
    if previous and following and previous[-1]['end'] > following[0]['start']:
        edge = (previous[-1]['end'] + following[0]['start']) / 2
        previous[-1]['end'] = edge
        following[0]['start'] = edge
for words in aligned:
    for previous, following in zip(words, words[1:]):
        if previous['end'] > following['start']:
            edge = (previous['end'] + following['start']) / 2
            previous['end'] = edge
            following['start'] = edge
    for word in words:
        if word['end'] < word['start']:
            word['end'] = word['start']
    for previous, following in zip(words, words[1:]):
        if previous['end'] > following['start']:
            edge = max(previous['start'], (previous['end'] + following['start']) / 2)
            previous['end'] = edge
            following['start'] = edge
    for word in words:
        if word['end'] < word['start']:
            word['end'] = word['start']
timing_path = ROOT / 'gita' / str(chapter) / 'timings.json'
alignment_overrides = json.loads((ROOT / 'authoring' / 'scripts' / f'gita-alignment-windows-chapter-{chapter}.json').read_text(encoding='utf-8'))
clip_end_overrides = alignment_overrides.get('_clipEndOverrides', {})
if args.verses:
    output = json.loads(timing_path.read_text(encoding='utf-8'))
else:
    output = {'version': 1, 'chapter': chapter, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
              'method': 'Local forced alignment of Sanskrit text; Hindi acoustic model with ASR-constrained line windows.',
              'reviewStatus': 'machine-aligned', 'verses': []}
for i, (verse, words) in enumerate(zip(verses, aligned)):
    if i + 1 not in selected:
        continue
    expected = [w for w in verse['sanskrit'].split() if re.search(r'[\u0900-\u0963]', w)]
    assert [w['word'] for w in words] == expected, f'Word mismatch in verse {i+1}'
    assert all('start' in w and 'end' in w for w in words), f'Missing timing in verse {i+1}'
    assert all(w['end'] >= w['start'] for w in words), f'Negative cue interval in verse {i+1}'
    assert all(a['end'] <= b['start'] + .05 for a, b in zip(words, words[1:])), f'Word overlap in verse {i+1}'
    start = max(0, words[0]['start'] - .18)
    end = words[-1]['end'] + .28
    if i:
        start = max(start, (aligned[i-1][-1]['end'] + words[0]['start']) / 2)
    if i + 1 < len(aligned):
        end = min(end, (words[-1]['end'] + aligned[i+1][0]['start']) / 2)
    if str(i + 1) in clip_end_overrides:
        assert i + 1 == len(aligned), 'Explicit clip end overrides are final-verse only.'
        end = float(clip_end_overrides[str(i + 1)])
    assert 4 < end - start < 45, f'Unexpected verse duration: {i+1}'
    assert start <= words[0]['start'] and end >= words[-1]['end'], f'Overlapping verses: {i+1}'
    path = directory / f'{i+1:02}.mp3'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(start),
                    '-i', str(source), '-t', str(end-start), '-vn', '-map_metadata', '-1',
                    '-codec:a', 'libmp3lame', '-b:a', '96k', str(path)], check=True)
    cues = [{'text': w['word'], 'start': round(max(0,w['start']-start),3),
             'end': round(w['end']-start,3), 'score': w.get('score',0)} for w in words]
    entry = {'verse': i+1, 'audio': f'audio/{i+1:02}.mp3',
             'sourceStart': round(start,3), 'sourceEnd': round(end,3),
             'duration': round(end-start,3), 'words': cues}
    if args.verses:
        output['verses'][i] = entry
    else:
        output['verses'].append(entry)
    print(f'Built verse {i+1}: {end-start:.2f}s', flush=True)
payload = json.dumps(output, ensure_ascii=False, indent=2)
timing_path.write_text(payload + '\n', encoding='utf-8')
# A classic script also works when the user opens the page through file://.
(ROOT / 'gita' / str(chapter) / 'timings.js').write_text(f'window.GITA_CHAPTER_{chapter}_TIMINGS = ' + payload + ';\n', encoding='utf-8')
print(f'Built {len(selected)} verse clip(s) and matching word-cue entries.', flush=True)
