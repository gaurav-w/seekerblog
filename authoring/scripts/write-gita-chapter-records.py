"""Write concise provenance records for the final eight Gita chapters."""
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = {
    11: ("2bmRapKPFeI", 969), 12: ("TLX3S-BD5vk", 399),
    13: ("nPqpIg4dIpc", 502), 14: ("MaAYGYjbpaw", 442),
    15: ("cEsJL3jqTOM", 420), 16: ("6avQjcWU0Io", 390),
    17: ("NJkdl9kon4k", 448), 18: ("FIK-Hm62_xc", 1149),
}


def duration(path: Path) -> float:
    return float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ], text=True).strip())


def main() -> None:
    for chapter, (video_id, source_seconds) in SOURCES.items():
        master = ROOT / "authoring" / "gita" / f"chapter-{chapter}.mp3"
        data = ROOT / "gita" / str(chapter) / "data.js"
        timing = ROOT / "gita" / str(chapter) / "timings.json"
        count = data.read_text(encoding="utf-8").count('"sanskrit"')
        source_hash = hashlib.sha256(master.read_bytes()).hexdigest()
        if timing.exists():
            status = json.loads(timing.read_text(encoding="utf-8")).get("reviewStatus", "unknown")
            timing_note = f"Local per-shloka clips and the matching JSON/JS timing manifests were generated; review status: **{status}**."
        else:
            timing_note = "The local master is acquired; per-shloka alignment and clip generation are pending."
        recording = f"Rajshri Soul, Bhagavad Gita Chapter {chapter}"
        artist = ", recited by Shrirang Bhave" if chapter == 14 else ""
        source_note = (
            "\n- Source replacement, 2026-10-08: the former ChinmayaChannel master was replaced "
            "with the Rajshri Soul recording used by the reader credit. All 27 shlokas were freshly "
            "transcribed, force-aligned, and rebuilt; timing from the previous recording was not reused. "
            "Status remains **machine-aligned** pending a complete listening review."
            if chapter == 14 else ""
        )
        record = f'''# Chapter {chapter} record

Prepared {count} verses from the Swami Ramsukhdas *Sadhak-Sanjivani* records in the public Vedic Scriptures mirror. Sanskrit and Hindi retain that edition; English is an editorial reader rendering. No ISKCON text is used.

- Recording: [{recording}](https://youtu.be/{video_id}){artist}; source-video duration: {source_seconds} s.
- Master: MP3, {duration(master):.3f} s; SHA-256 `{source_hash}`.
- Bilingual inline word meanings were imported from the Chapter {chapter} tables at [bhagwadgita.info](https://bhagwadgita.info/).
- {timing_note}{source_note}
'''
        output = ROOT / "authoring" / "docs" / "gita" / f"CHAPTER-{chapter}-RECORD.md"
        output.write_text(record, encoding="utf-8")
        print(output)


if __name__ == "__main__":
    main()
