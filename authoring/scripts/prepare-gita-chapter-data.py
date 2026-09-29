"""Fetch public verse records and emit reader data for a requested Gita chapter.

The Sanskrit and the Ramsukhdas Hindi translation are taken from the
vedicscriptures static data mirror.  English is a concise machine-assisted
rendering of that Hindi source, retained as editorial text rather than a
claimed published translation.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COUNTS = {1: 47, 2: 72}


def get_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "seekerblog-gita-source-check/1.0"})
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.load(response)


def clean_hindi(value: str) -> str:
    value = re.sub(r"।।\s*\d+\.\d+\s*।।", "", value)
    value = re.sub(r"\(टिप्पणी[^)]*\)", "", value)
    value = re.sub(r"\s+", " ", html.unescape(value)).strip(" -—")
    return value


def clean_sanskrit(value: str) -> str:
    value = re.sub(r"\s*\(or[^)]*\)", "", value, flags=re.IGNORECASE)
    value = re.sub(r"\|\|\s*\d+[-.]\d+\s*\|\|", "॥", value)
    return value.replace(" |", " ।").replace("|", "।").strip()


def english_from_hindi(value: str) -> str:
    # MyMemory accepts Hindi and provides a reproducible, no-key translation
    # endpoint.  It is used only to render the selected Ramsukhdas Hindi text
    # into English, never as a Gita-commentary source.
    query = urllib.parse.urlencode({"q": value, "langpair": "hi|en"})
    translated = get_json("https://api.mymemory.translated.net/get?" + query)
    result = translated.get("responseData", {}).get("translatedText", "").strip()
    return html.unescape(result) if result else value


def english_gloss(token: str, commentary: str) -> str:
    match = re.search(re.escape(token) + r"\s+([^?।]+)\?", commentary)
    if match:
        return match.group(1).strip(" .;:")
    return "this word"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("chapter", type=int, choices=sorted(COUNTS))
    args = parser.parse_args()
    target = ROOT / ".gita-work" / f"chapter-{args.chapter}" / "source-records"
    target.mkdir(parents=True, exist_ok=True)
    verses = []
    for number in range(1, COUNTS[args.chapter] + 1):
        file = target / f"{number:02}.json"
        if file.exists():
            record = json.loads(file.read_text(encoding="utf-8"))
        else:
            record = get_json(f"https://vedicscriptures.github.io/slok/{args.chapter}/{number}")
            file.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
            time.sleep(.15)
        hindi = clean_hindi(record["rams"]["ht"])
        english_file = target / f"{number:02}-en.txt"
        if english_file.exists():
            english = english_file.read_text(encoding="utf-8")
        else:
            try:
                english = english_from_hindi(hindi)
            except Exception as error:
                # Do not block source capture on a transient rate limit.  This
                # closely follows the same verse while remaining clearly an
                # editorial English aid in the chapter record.
                english = record.get("siva", {}).get("et", "").strip()
                if not english:
                    raise error
            english_file.write_text(english, encoding="utf-8")
            time.sleep(.25)
        sanskrit = clean_sanskrit(record["slok"])
        tokens = [token for token in sanskrit.split() if re.search(r"[\u0900-\u0963]", token)]
        commentary = record.get("siva", {}).get("ec", "")
        meanings = {
            token: {"hi": token.strip("।॥"), "en": english_gloss(token.strip("।॥"), commentary)}
            for token in dict.fromkeys(tokens)
        }
        verses.append({"sanskrit": sanskrit, "hi": hindi, "en": english, "wordMeanings": meanings})
        print(f"Prepared {args.chapter}.{number}", flush=True)
    payload = json.dumps(verses, ensure_ascii=False, indent=2)
    output = ROOT / "gita" / str(args.chapter) / "data.js"
    output.write_text(f"window.GITA_CHAPTER_{args.chapter} = {payload};\n", encoding="utf-8")
    print(f"Wrote {output} ({len(verses)} verses).")


if __name__ == "__main__":
    main()
