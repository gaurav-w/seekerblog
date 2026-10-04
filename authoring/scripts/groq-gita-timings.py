"""Prepare/cache Groq STT evidence for Gita timing repair; never edit live cues.

The default command is offline. --transcribe sends the chapter masters to Groq
and requires a cost ceiling. Responses are evidence, not canonical Sanskrit or
certified timestamps. Follow authoring/docs/gita/TIMING-REPAIR-PLAN.md to align,
review, and promote them.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import time

ROOT = Path(__file__).resolve().parents[2]
MODEL = "whisper-large-v3"
RATE_PER_HOUR = 0.111
VERSION = 1
PROMPT = "श्रीमद्भगवद्गीता। संस्कृत श्लोक पाठ। श्रीभगवानुवाच। अर्जुन उवाच।"


def fingerprint(source_hash, text, language):
    settings = {"version": VERSION, "sourceSha256": source_hash,
                "textSha256": hashlib.sha256(text.encode()).hexdigest(),
                "model": MODEL, "language": language, "prompt": PROMPT,
                "temperature": 0, "timestamps": ["word", "segment"],
                "transport": "flac-mono-16000-s16"}
    return hashlib.sha256(json.dumps(settings, sort_keys=True).encode()).hexdigest(), settings


def validate_response(result, duration):
    words = result.get("words")
    if not isinstance(words, list) or not words:
        raise ValueError("STT returned no word timestamps; cannot use this as timing evidence")
    previous = -1.0
    for word in words:
        start, end = word.get("start"), word.get("end")
        if not isinstance(word.get("word"), str) or not word["word"].strip():
            raise ValueError("STT returned an empty word")
        if (not isinstance(start, (int, float)) or not isinstance(end, (int, float))
                or not math.isfinite(start) or not math.isfinite(end)
                or start < 0 or end < start or end > duration + .1 or start < previous):
            raise ValueError("STT word timestamps are invalid or out of order")
        previous = start


def usable_response(result, duration):
    """Quarantine impossible/provider-repeated timestamps, preserving raw evidence."""
    usable, rejected = [], []
    previous = -1.0
    for index, word in enumerate(result.get("words") or []):
        start, end = word.get("start"), word.get("end")
        valid = (isinstance(start, (int, float)) and isinstance(end, (int, float))
                 and math.isfinite(start) and math.isfinite(end)
                 and isinstance(word.get("word"), str) and word["word"].strip()
                 and 0 <= start <= end <= duration + .1 and start >= previous)
        if valid:
            usable.append(word)
            previous = start
        else:
            rejected.append({"index": index, "word": word, "reason": "invalid-or-nonmonotonic-timestamp"})
    filtered = {**result, "words": usable}
    validate_response(filtered, duration)
    return filtered, rejected


def binary(name, supplied):
    found = supplied or shutil.which(name)
    if not found or not Path(found).is_file():
        raise ValueError(f"Supply --{name} with the existing {name} executable path")
    return str(found)


def duration_of(source, ffprobe):
    output = subprocess.check_output([ffprobe, "-v", "error", "-show_entries",
        "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(source)],
        text=True, timeout=30)
    duration = float(output.strip())
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError("Invalid source duration")
    return duration


def plan(chapter, language, ffprobe):
    source = ROOT / "authoring" / "gita" / f"chapter-{chapter}.mp3"
    text = (ROOT / "gita" / str(chapter) / "data.js").read_text(encoding="utf-8")
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    manifest = json.loads((ROOT / "gita" / str(chapter) / "timings.json").read_text(encoding="utf-8"))
    if digest != manifest["sourceSha256"]:
        raise ValueError(f"Chapter {chapter}: master changed; reconcile provenance first")
    duration = duration_of(source, ffprobe)
    identity, settings = fingerprint(digest, text, language)
    directory = ROOT / ".gita-work" / f"chapter-{chapter}" / "groq"
    cache = directory / f"{identity}.json"
    cached = False
    if cache.is_file():
        saved = json.loads(cache.read_text(encoding="utf-8"))
        if saved.get("fingerprint") != identity or saved.get("settings") != settings:
            raise ValueError("Cache provenance mismatch")
        validate_response(saved["result"], duration)
        cached = True
    return {"chapter": chapter, "source": source, "duration": duration,
            "fingerprint": identity, "settings": settings, "directory": directory,
            "cache": cache, "cached": cached,
            "estimatedUsd": 0 if cached else max(10, duration) / 3600 * RATE_PER_HOUR}


def api_key(secrets_file):
    key = os.environ.get("GROQ_API_KEY", "").strip()
    if not key and secrets_file:
        key = str(json.loads(Path(secrets_file).read_text(encoding="utf-8-sig"))
                  .get("GROQ_API_KEY", "")).strip()
    if not key:
        raise ValueError("No GROQ_API_KEY configured; supply an existing --secrets-file")
    return key


def transcribe(item, ffmpeg, key):
    import requests

    item["directory"].mkdir(parents=True, exist_ok=True)
    transport = item["directory"] / f'{item["settings"]["sourceSha256"]}-16000-s16.flac'
    if not transport.exists():
        temporary = transport.with_suffix(".tmp.flac")
        subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i",
            str(item["source"]), "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000",
            "-map_metadata", "-1", "-sample_fmt", "s16", "-c:a", "flac", str(temporary)], check=True)
        temporary.replace(transport)
    if transport.stat().st_size > 25_000_000:
        raise ValueError("FLAC exceeds attachment limit; implement offset-preserving chunks before sending")
    data = [("model", MODEL), ("language", item["settings"]["language"]),
            ("response_format", "verbose_json"), ("timestamp_granularities[]", "word"),
            ("timestamp_granularities[]", "segment"), ("temperature", "0"), ("prompt", PROMPT)]
    for attempt in range(4):
        with transport.open("rb") as audio:
            response = requests.post("https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {key}"}, data=data,
                files={"file": (transport.name, audio, "audio/flac")}, timeout=(30, 180))
        if response.status_code != 429:
            break
        if attempt == 3:
            raise RuntimeError("Groq rate limit persisted; rerun to reuse completed chapter caches")
        try:
            delay = max(.5, float(response.headers.get("retry-after", "5")))
        except ValueError:
            delay = 5
        if delay > 60:
            raise RuntimeError("Groq rate limit asks for a long wait; rerun later with cached successes")
        print(f'Chapter {item["chapter"]}: rate limited; retry in {delay:.1f}s', flush=True)
        time.sleep(delay)
    if not response.ok:
        # Do not dump provider responses, requests, headers, or credentials.
        raise RuntimeError(f"Groq STT failed with HTTP {response.status_code}")
    result = response.json()
    payload = {"fingerprint": item["fingerprint"], "settings": item["settings"],
               "sourceDuration": item["duration"], "createdUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
               "reviewStatus": "stt-evidence-unreviewed", "result": result}
    # Preserve paid evidence even if a provider timestamp is invalid. Do not
    # silently discard a successful response and pay for the same upload again.
    raw = item["cache"].with_suffix(".raw.json")
    raw.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    payload["result"], payload["quarantinedWords"] = usable_response(result, item["duration"])
    temporary = item["cache"].with_suffix(".tmp.json")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(item["cache"])
    return len(result["words"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chapters", nargs="+", type=int, choices=range(1, 19), default=[6])
    parser.add_argument("--language", choices=["hi", "sa"], default="hi")
    parser.add_argument("--ffprobe")
    parser.add_argument("--ffmpeg")
    parser.add_argument("--secrets-file", help="Existing private secrets file; never copied to this project")
    parser.add_argument("--transcribe", action="store_true", help="Upload master audio to Groq (paid)")
    parser.add_argument("--max-cost-usd", type=float, help="Ceiling for estimated uncached audio charges")
    args = parser.parse_args()
    ffprobe = binary("ffprobe", args.ffprobe)
    items = [plan(chapter, args.language, ffprobe) for chapter in dict.fromkeys(args.chapters)]
    estimate = sum(item["estimatedUsd"] for item in items)
    for item in items:
        print(f'Chapter {item["chapter"]}: {item["duration"]:.2f}s; '
              f'{"cached" if item["cached"] else "uncached"}; estimated ${item["estimatedUsd"]:.4f}')
    print(f"Estimated total ${estimate:.4f} at ${RATE_PER_HOUR}/audio hour; provider billing is authoritative.")
    if not args.transcribe:
        print("Offline preparation only. No requests sent and no live assets changed.")
        return
    if (args.max_cost_usd is None or not math.isfinite(args.max_cost_usd)
            or args.max_cost_usd < estimate):
        parser.error("--max-cost-usd must cover the estimated uncached audio charges")
    ffmpeg = binary("ffmpeg", args.ffmpeg)
    key = api_key(args.secrets_file) if any(not item["cached"] for item in items) else None
    for item in items:
        if not item["cached"]:
            count = transcribe(item, ffmpeg, key)
            print(f'Chapter {item["chapter"]}: cached {count} measured STT words; canonical mapping/review still required', flush=True)


if __name__ == "__main__":
    main()
