"""Build Siddha Kunjika Stotram clips from STT-backed force alignment evidence."""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'authoring' / 'kunjika-stotram' / 'source.m4a'
DESTINATION = ROOT / 'stotra' / 'siddha-kunjika-stotram'
DATA = DESTINATION / 'data.js'
WORK = ROOT / '.kunjika-work'

# The local STT segment for the opening begins at 11.10 s, while the forced
# aligner clusters the short attribution "शिव उवाच" too late.  Retain 0.20 s
# of lead-in from that measured onset so the first spoken words are not cut.
SOURCE_SUPPORTED_STARTS = {0: 10.90}

if not SOURCE.is_file():
    raise SystemExit(f'Missing source recording: {SOURCE}')
verse_count = DATA.read_text(encoding='utf-8').count('sanskrit:')
aligned = json.loads((WORK / 'aligned.json').read_text(encoding='utf-8'))
alignment_meta = json.loads((WORK / 'alignment-meta.json').read_text(encoding='utf-8'))
if verse_count != len(aligned):
    raise SystemExit(f'Expected {verse_count} aligned stanzas, found {len(aligned)}')

def source_window(index):
    """Leave natural phrase tails while preventing any neighbouring stanza bleed."""
    words = aligned[index]
    if not words:
        raise SystemExit(f'Stanza {index + 1} has no aligned words')
    start = max(0, float(words[0]['start']) - .20)
    start = min(start, SOURCE_SUPPORTED_STARTS.get(index, start))
    end = float(words[-1]['end']) + .32
    if index:
        previous_end = float(aligned[index - 1][-1]['end'])
        start = max(start, (previous_end + float(words[0]['start'])) / 2)
    if index + 1 < len(aligned):
        following_start = float(aligned[index + 1][0]['start'])
        end = min(end, (float(words[-1]['end']) + following_start) / 2)
    if end <= start:
        raise SystemExit(f'Stanza {index + 1} has an invalid aligned clip window')
    return round(start, 3), round(end, 3)

DESTINATION.joinpath('audio').mkdir(exist_ok=True)
entries = []
windows = []
for number in range(1, verse_count + 1):
    start, end = source_window(number - 1)
    windows.append((start, end))
    output = DESTINATION / 'audio' / f'{number:02}.mp3'
    subprocess.run([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(SOURCE),
        '-ss', str(start), '-t', str(end - start), '-vn', '-map_metadata', '-1',
        '-codec:a', 'libmp3lame', '-b:a', '96k', str(output),
    ], check=True)
    entries.append({
        'verse': number,
        'audio': f'audio/{number:02}.mp3',
        'sourceStart': start,
        'sourceEnd': end,
        'duration': round(end - start, 3),
        'highlightMode': 'stanza',
        'words': [],
    })
    print(f'Built stanza {number}: {end - start:.1f}s')

source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
timings = {
    'version': 1,
    'id': 'siddha-kunjika',
    'sourceSha256': source_hash,
    'alignmentFingerprint': hashlib.sha256(f'{source_hash}:{windows}'.encode()).hexdigest(),
    'method': alignment_meta['method'],
    'reviewStatus': alignment_meta['reviewStatus'],
    'sourceUrl': 'https://www.youtube.com/watch?v=uswcVLQExOo',
    'verses': entries,
}
encoded = json.dumps(timings, ensure_ascii=False, indent=2)
(DESTINATION / 'timings.json').write_text(encoded + '\n', encoding='utf-8')
(DESTINATION / 'timings.js').write_text(f'window.STOTRA_READER_TIMINGS = {encoded};\n', encoding='utf-8')
print(f'Built {len(entries)} clips from {SOURCE.name}.')
