"""Local-only first pass used to locate verses in the supplied recording."""
import argparse
import json
import os
from pathlib import Path

os.environ['HF_HUB_OFFLINE'] = '1'
from faster_whisper import WhisperModel

parser = argparse.ArgumentParser()
parser.add_argument('--chapter', type=int, required=True, choices=(1, 2, 3))
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
work = root / '.gita-work' / f'chapter-{args.chapter}'
work.mkdir(parents=True, exist_ok=True)
model = WhisperModel('small', device='cpu', compute_type='int8', local_files_only=True, cpu_threads=6)
segments, info = model.transcribe(str(root / f'authoring/gita/chapter-{args.chapter}.mp3'), language='hi', beam_size=5, word_timestamps=True, condition_on_previous_text=False, no_speech_threshold=None, vad_filter=False)
result = []
for s in segments:
    result.append({'start': s.start, 'end': s.end, 'text': s.text,
                   'words': [{'word': w.word, 'start': w.start, 'end': w.end} for w in s.words]})
    print(f'{s.start:.1f}-{s.end:.1f}', flush=True)
    (work / 'transcription.json').write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
print('Transcription complete', flush=True)
