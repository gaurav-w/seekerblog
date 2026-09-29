"""Keep natural inter-shloka silence without leaking the next recitation."""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("chapters", nargs="+", type=int, choices=(1, 2, 3))
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
guard = 0.035  # End just before the next aligned audible syllable.

for chapter in args.chapters:
    timing_path = root / "gita" / str(chapter) / "timings.json"
    manifest = json.loads(timing_path.read_text(encoding="utf-8"))
    verses = manifest["verses"]
    master = root / "authoring" / "gita" / f"chapter-{chapter}.mp3"
    for index, verse in enumerate(verses):
        start = verse["sourceStart"]
        end = verse["sourceEnd"]
        if index + 1 < len(verses):
            next_verse = verses[index + 1]
            next_voice = next_verse["sourceStart"] + next_verse["words"][0]["start"]
            # The next verse's aligned voice is a hard boundary.  Most clips
            # extend into silence; an anomalous old tail is shortened instead
            # of allowing the next recitation to bleed into this clip.
            last_voice = start + verse["words"][-1]["end"]
            end = max(last_voice, next_voice - guard)
        verse["sourceEnd"] = round(end, 3)
        verse["duration"] = round(end - start, 3)
        output = root / "gita" / str(chapter) / verse["audio"]
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(start),
            "-i", str(master), "-t", str(end - start), "-vn", "-map_metadata", "-1",
            "-codec:a", "libmp3lame", "-b:a", "96k", str(output),
        ], check=True)
    payload = json.dumps(manifest, ensure_ascii=False, indent=2)
    timing_path.write_text(payload + "\n", encoding="utf-8")
    (timing_path.with_suffix(".js")).write_text(
        f"window.GITA_CHAPTER_{chapter}_TIMINGS = {payload};\n", encoding="utf-8"
    )
    print(f"Extended natural clip tails for Chapter {chapter}.")
