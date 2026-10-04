"""Attach cached recognition-group windows to every displayed Gita word cue.

The word-level alignment stays intact for provenance. Words recognized as one
STT token share that token's measured interval in the reader.
"""

import argparse
import json
import os
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def load_chapter(chapter):
    report_path = ROOT / ".gita-work" / f"chapter-{chapter}" / "groq-repair" / "report.json"
    timings_path = ROOT / "gita" / str(chapter) / "timings.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    timings = json.loads(timings_path.read_text(encoding="utf-8"))
    if report.get("chapter") != chapter or timings.get("chapter") != chapter:
        raise ValueError(f"Chapter {chapter}: report or manifest identity mismatch")

    groups_by_verse = {verse["verse"]: [] for verse in timings["verses"]}
    for decision in report["decisions"]:
        verse = decision["verse"]
        if verse not in groups_by_verse:
            raise ValueError(f"Chapter {chapter}: group refers to absent verse {verse}")
        groups_by_verse[verse].extend(decision["groups"])

    verse_count = 0
    word_count = 0
    group_count = 0
    combined_count = 0
    for verse in timings["verses"]:
        verse_count += 1
        verse["highlightMode"] = "word"
        words = verse["words"]
        cursor = 0
        for group_id, group in enumerate(groups_by_verse[verse["verse"]]):
            tokens = group["tokens"]
            count = len(tokens)
            cues = words[cursor:cursor + count]
            if count == 0 or len(cues) != count or [cue["text"] for cue in cues] != tokens:
                raise ValueError(
                    f"Chapter {chapter}.{verse['verse']}: cached group does not match canonical cues"
                )
            cursor += count
            group_count += 1
            word_count += count
            if count > 1:
                combined_count += 1
                clip_start = float(verse["sourceStart"])
                clip_end = clip_start + float(verse["duration"])
                source_start = max(clip_start, float(group["sourceStart"]))
                source_end = min(clip_end, float(group["sourceEnd"]))
                if source_end <= source_start:
                    source_start = clip_start + min(cue["start"] for cue in cues)
                    source_end = clip_start + max(cue["end"] for cue in cues)
                if source_end <= source_start:
                    raise ValueError(
                        f"Chapter {chapter}.{verse['verse']}: combined group has no usable interval"
                    )
                local_start = round(source_start - clip_start, 3)
                local_end = round(source_end - clip_start, 3)
                if local_end <= local_start:
                    raise ValueError(
                        f"Chapter {chapter}.{verse['verse']}: combined interval collapses at millisecond precision"
                    )
                method = group.get("method", "stt-group")
            else:
                local_start = float(cues[0]["start"])
                local_end = float(cues[0]["end"])
                method = cues[0].get("timingMethod", group.get("method", "single-word"))

            for cue in cues:
                cue["highlightGroup"] = group_id
                cue["highlightStart"] = local_start
                cue["highlightEnd"] = local_end
                cue["highlightMethod"] = method

        if cursor != len(words):
            raise ValueError(
                f"Chapter {chapter}.{verse['verse']}: {len(words) - cursor} cues lack a cached group"
            )

    return timings, {
        "verses": verse_count,
        "groups": group_count,
        "words": word_count,
        "combined": combined_count,
    }


def atomic_write(path, content):
    handle = tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", newline="\n", dir=path.parent,
        prefix=path.name + ".", suffix=".tmp", delete=False,
    )
    temporary = Path(handle.name)
    try:
        with handle:
            handle.write(content)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write all chapter timing manifests")
    args = parser.parse_args()

    staged = []
    totals = {"chapters": 0, "verses": 0, "groups": 0, "words": 0, "combined": 0}
    for chapter in range(1, 19):
        timings, counts = load_chapter(chapter)
        base = ROOT / "gita" / str(chapter)
        payload = json.dumps(timings, ensure_ascii=False, indent=2) + "\n"
        javascript = f"window.GITA_CHAPTER_{chapter}_TIMINGS = {payload};\n"
        staged.extend(((base / "timings.json", payload), (base / "timings.js", javascript)))
        totals["chapters"] += 1
        for key in ("verses", "groups", "words", "combined"):
            totals[key] += counts[key]

    action = "Would update" if not args.apply else "Updated"
    print(
        f"{action} {totals['chapters']} chapters, {totals['verses']} verses, "
        f"{totals['words']} word cues in {totals['groups']} groups; "
        f"{totals['combined']} multiword groups share their STT interval."
    )
    if args.apply:
        for path, content in staged:
            atomic_write(path, content)


if __name__ == "__main__":
    main()
