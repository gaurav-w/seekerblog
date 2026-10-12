"""Refresh all chapter pages' content-hashed reader asset URLs; --check is read-only."""
import argparse
import hashlib
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]


def version(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    plans = []
    for chapter in range(1, 19):
        page = ROOT / 'gita' / str(chapter) / 'index.html'
        before = page.read_text(encoding='utf-8')
        after = before
        for url, asset in (
            ('../../assets/css/gita-reader.css', ROOT / 'assets/css/gita-reader.css'),
            ('../../assets/js/gita-reader.js', ROOT / 'assets/js/gita-reader.js'),
            ('timings.js', page.with_name('timings.js')),
        ):
            pattern = re.escape(url) + r'(?:\?[^"\s]*)?(?=")'
            after, count = re.subn(pattern, f'{url}?v={version(asset)}', after)
            if count != 1:
                raise ValueError(f'Chapter {chapter}: expected one reference to {url}, found {count}')
        if after != before:
            plans.append((page, after))
    if args.check:
        if plans:
            raise SystemExit(f'Stale asset versions in {len(plans)} chapter pages; rerun without --check.')
        print('PASS: all 18 chapter pages reference current reader, CSS and timing content hashes.')
        return
    for page, text in plans:
        page.write_text(text, encoding='utf-8')
    print(f'Refreshed asset versions in {len(plans)} chapter pages.')


if __name__ == '__main__':
    main()
