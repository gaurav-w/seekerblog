"""Audit Vishnu Sahasranama reader clips against cached STT evidence.

This is deliberately an audit, not a cue generator.  Sanskrit chanting is a
hard ASR problem, so the reader's canonical text remains the source of truth.
The script compares it with the cached Groq Whisper Large V3 words to identify
clips that have no STT support, omit a material part of the displayed text, or
contain a material amount of additional speech.

It writes an ignored JSON work artifact and a reviewable Markdown report.  The
report's labels are evidence for a listening/re-cut queue; they do not certify
word or syllable boundaries.
"""
from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / ".vishnu-work"
SOURCE = ROOT / "authoring" / "vishnu-sahasranama-source.m4a"
VERSES = WORK / "verses.json"
MANIFEST = ROOT / "vishnu-sahasranama" / "timings.json"
META = WORK / "alignment-meta.json"
DEFAULT_JSON = WORK / "stt-audit.json"
DEFAULT_REPORT = ROOT / "authoring" / "docs" / "vishnu-sahasranama" / "STT-AUDIO-AUDIT.md"

# Similar to the normalizer used by the existing alignment tool.  It collapses
# common Hindi/Sanskrit ASR confusions before character-level matching.
NORMALIZE = str.maketrans({
    "श": "स", "ष": "स", "ण": "न", "ँ": "ं", "ी": "ि", "ू": "ु", "ृ": "्रि",
})


def normalise(text: str) -> str:
    text = text.translate(NORMALIZE)
    return "".join(
        char for char in text
        if "\u0900" <= char <= "\u0963" and char not in "ः्ऽं"
    )


def similarity(expected: str, heard: str) -> tuple[float, float, float]:
    """Return recall, precision, and F1 from conservative LCS matching."""
    if not expected or not heard:
        return 0.0, 0.0, 0.0
    matched = sum(
        block.size
        for block in difflib.SequenceMatcher(None, expected, heard, autojunk=False).get_matching_blocks()
    )
    recall = matched / len(expected)
    precision = matched / len(heard)
    f1 = 2 * recall * precision / (recall + precision) if recall + precision else 0.0
    return recall, precision, f1


def raw_words_between(words: list[dict], start: float, end: float) -> list[dict]:
    return [word for word in words if word["end"] > start and word["start"] < end]


def evidence_window(entries: list[dict], index: int) -> tuple[float | None, float | None]:
    """Use a neighbouring clip window when an entry has no rendered clip."""
    entry = entries[index]
    if entry.get("available") is not False:
        return float(entry["sourceStart"]), float(entry["sourceEnd"])
    before = next(
        (float(candidate["sourceEnd"]) for candidate in reversed(entries[:index])
         if candidate.get("available") is not False),
        None,
    )
    after = next(
        (float(candidate["sourceStart"]) for candidate in entries[index + 1:]
         if candidate.get("available") is not False),
        None,
    )
    # The opening invocation can have no prior rendered entry.  Its source
    # window starts at the beginning of the master, not at an unknown point.
    return (0.0 if before is None else before), after


def classify(*, available: bool, coverage: float | None, recall: float, precision: float) -> str:
    if not available:
        # `coverage` is the prior monotonic STT-to-canonical character mapping.
        # A positive value says some canonical material was recognised, not that
        # it is complete enough to construct a trustworthy reader clip.
        return "stt-partial-no-clip" if max(coverage or 0.0, recall) >= 0.25 else "not-evidenced-no-clip"
    if recall < 0.65:
        return "partial-or-wrong-clip"
    if precision < 0.40:
        return "extra-speech-in-clip"
    if precision < 0.55:
        return "possible-extra-speech"
    return "stt-supported"


def line_evidence(text: str, heard: str) -> list[dict]:
    rows = []
    for line in (line.strip() for line in text.splitlines() if line.strip()):
        expected = normalise(line)
        recall, _, _ = similarity(expected, heard)
        rows.append({"text": line, "sttRecall": round(recall, 3)})
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument(
        "--apply-markers",
        action="store_true",
        help="Copy conservative STT review states into the public timing manifest.",
    )
    args = parser.parse_args()

    cache_files = sorted((WORK / "groq").glob("*-combined.json"))
    if not cache_files:
        raise FileNotFoundError("No combined Groq STT cache found under .vishnu-work/groq.")
    if not SOURCE.is_file():
        raise FileNotFoundError(f"Missing source recording: {SOURCE}")

    verses = json.loads(VERSES.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    meta = json.loads(META.read_text(encoding="utf-8")) if META.exists() else {}
    evidence = json.loads(cache_files[-1].read_text(encoding="utf-8"))
    words = evidence["words"]
    entries = manifest["entries"]
    if len(verses) != len(entries):
        raise ValueError("The reader data and timing manifest have different entry counts.")

    source_sha = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    if source_sha != manifest["source"]["sha256"]:
        raise ValueError("The timing manifest and source recording do not share a SHA-256 fingerprint.")
    unavailable_coverage = {
        item["key"]: float(item["coverage"])
        for item in meta.get("unavailableEntries", [])
    }

    rows = []
    for index, (verse, entry) in enumerate(zip(verses, entries)):
        available = entry.get("available") is not False
        start, end = evidence_window(entries, index)
        evidence_words = raw_words_between(words, start, end) if start is not None and end is not None else []
        heard = "".join(normalise(word["word"]) for word in evidence_words)
        expected = normalise(verse["devanagari"])
        recall, precision, f1 = similarity(expected, heard)
        coverage = unavailable_coverage.get(verse["key"])
        status = classify(
            available=available,
            coverage=coverage,
            recall=recall,
            precision=precision,
        )
        rows.append({
            "readerIndex": index + 1,
            "key": verse["key"],
            "section": verse["section"],
            "available": available,
            "status": status,
            "sourceStart": start,
            "sourceEnd": end,
            "sttMappedCoverage": round(coverage, 4) if coverage is not None else None,
            "sttRecall": round(recall, 3),
            "sttPrecision": round(precision, 3),
            "sttF1": round(f1, 3),
            "lines": line_evidence(verse["devanagari"], heard),
            "sttExcerpt": " ".join(word["word"] for word in evidence_words),
        })

    audit = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "path": str(SOURCE.relative_to(ROOT)).replace("\\", "/"),
            "sha256": source_sha,
            "sttCache": str(cache_files[-1].relative_to(ROOT)).replace("\\", "/"),
            "sttModel": "Groq Whisper Large V3",
            "sttReviewStatus": evidence.get("reviewStatus"),
        },
        "thresholds": {
            "partialOrWrongClipRecallBelow": 0.65,
            "extraSpeechPrecisionBelow": 0.40,
            "possibleExtraSpeechPrecisionBelow": 0.55,
            "partialWithoutClipCoverageAtLeast": 0.25,
        },
        "entries": rows,
    }

    if args.apply_markers:
        by_key = {row["key"]: row for row in rows}
        playback_disabled = {"partial-or-wrong-clip", "extra-speech-in-clip"}
        for entry in entries:
            row = by_key[entry["key"]]
            if row["status"] == "stt-supported":
                entry.pop("audioReview", None)
                entry.pop("playback", None)
                continue
            entry["audioReview"] = row["status"]
            if row["status"] in playback_disabled:
                # The audio remains on disk for repair, but the reader must not
                # play a clip that STT shows to be incomplete or mismatched.
                entry["playback"] = "disabled-pending-recut"
            else:
                entry.pop("playback", None)
        payload = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
        MANIFEST.write_text(payload, encoding="utf-8")
        (ROOT / "vishnu-sahasranama" / "timings.js").write_text(
            f"window.VISHNU_SAHASRANAMA_TIMINGS = {payload}", encoding="utf-8"
        )
    args.json.parent.mkdir(parents=True, exist_ok=True)
    args.json.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    issues = [row for row in rows if row["status"] != "stt-supported"]
    counts = {status: sum(row["status"] == status for row in rows) for status in sorted({row["status"] for row in rows})}
    report = [
        "# Vishnu Sahasranama STT audio audit",
        "",
        "This audit compares the immutable reader text with cached Groq Whisper Large V3 word timestamps from the supplied master recording. It is a review queue, not a transcription replacement or a listening certification.",
        "",
        f"- Reader entries: {len(rows)}",
        f"- STT-supported clips: {counts.get('stt-supported', 0)}",
        f"- Entries with no rendered clip: {counts.get('not-evidenced-no-clip', 0) + counts.get('stt-partial-no-clip', 0)}",
        f"- Rendered clips with missing/mismatched canonical speech: {counts.get('partial-or-wrong-clip', 0)}",
        f"- Rendered clips with potential additional speech: {counts.get('extra-speech-in-clip', 0) + counts.get('possible-extra-speech', 0)}",
        "",
        "## Status meanings",
        "",
        "- **not-evidenced-no-clip** — no reader clip and the cached STT did not provide a reliable canonical match. This is not proof of silence; it is a re-record/review candidate.",
        "- **stt-partial-no-clip** — no reader clip, although the cached STT recognises a material part of the passage. It needs a bounded source window and manual listening before restoration.",
        "- **partial-or-wrong-clip** — a rendered clip has less than 65% canonical-character recall in its own STT window; it likely omits text or begins/ends in a neighbour.",
        "- **extra-speech-in-clip** / **possible-extra-speech** — the clip has considerable STT material not found in its displayed passage. It needs a cut-boundary review.",
        "",
        "## Review queue",
        "",
        "| Entry | Status | STT recall | STT precision | Source window | Missing/weak lines |",
        "| --- | --- | ---: | ---: | --- | --- |",
    ]
    for row in issues:
        window = "—" if row["sourceStart"] is None else f"{row['sourceStart']:.3f}–{row['sourceEnd']:.3f}s"
        weak_lines = "; ".join(
            line["text"] for line in row["lines"] if line["sttRecall"] < 0.55
        ) or "—"
        report.append(
            f"| {row['readerIndex']:03} `{row['key']}` | {row['status']} | "
            f"{row['sttRecall']:.3f} | {row['sttPrecision']:.3f} | {window} | {weak_lines} |"
        )
    report += [
        "",
        "The full machine-readable evidence, including every reader entry and the corresponding STT excerpt, is generated in `.vishnu-work/stt-audit.json` and is intentionally not published.",
        "",
        "## Re-run",
        "",
        "```powershell",
        "python authoring/scripts/audit-vishnu-sahasranama-stt.py",
        "```",
    ]
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text("\n".join(report) + "\n", encoding="utf-8")
    suffix = "; public review markers applied" if args.apply_markers else ""
    print(f"Wrote {args.json} and {args.report}; {len(issues)} entries require review{suffix}.")


if __name__ == "__main__":
    main()
