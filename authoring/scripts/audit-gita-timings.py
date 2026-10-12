"""Audit all canonical Gita cues, source cuts and optionally decoded MP3s.

Flags require acoustic/listening review. A successful structural/media audit
does not certify Sanskrit word identity or exact recitation synchronization.
"""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import math
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
COUNTS = [47, 72, 43, 42, 29, 47, 30, 28, 34, 42, 55, 20, 34, 27, 20, 24, 28, 78]


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def assignment(path):
    return json.loads(path.read_text(encoding='utf-8').split('=', 1)[1].strip().removesuffix(';'))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def audit(chapters, candidate, decoder):
    report = {'version': 1, 'thresholds': {'shortCue': .12, 'lowAcousticScore': .5,
              'longGap': .6, 'transcriptBeyondCut': .35, 'largeCueMove': .75, 'tightCutMargin': .08},
              'reviewStatus': 'machine-aligned', 'chapters': [], 'flags': [], 'errors': [], 'media': []}
    media_jobs = []
    for chapter in chapters:
        live = ROOT / 'gita' / str(chapter)
        base = ROOT / '.gita-work' / f'chapter-{chapter}' / candidate if candidate else live
        try:
            manifest = load(base / 'timings.json')
            verses = assignment(live / 'data.js')
            assert manifest == assignment(base / 'timings.js'), 'JS and JSON differ'
            assert manifest['chapter'] == chapter and len(verses) == len(manifest['verses']) == COUNTS[chapter - 1], 'Verse count/identity'
            assert digest(ROOT / 'authoring/gita' / f'chapter-{chapter}.mp3') == manifest['sourceSha256'], 'Master hash'
            decisions = None
            validation = None
            prior = None
            identity = manifest.get('alignmentFingerprint')
            work_context = ROOT / '.gita-work' / f'chapter-{chapter}' / 'context-repair'
            contextual_report = base / 'report.json' if candidate else work_context / 'report.json'
            if candidate:
                validation = load(contextual_report)
                assert not validation['errors'] and validation['fingerprint'] == identity, 'Candidate cuts are disputed'
                alignment = load(base / 'alignment.json')
                assert alignment['fingerprint'] == identity, 'Candidate alignment fingerprint differs'
                assert alignment['recipe']['scriptSha256'] == digest(Path(__file__).with_name('repair-gita-context.py')), 'Candidate uses an older context repair script'
                assert alignment['recipe']['repairScriptSha256'] == digest(Path(__file__).with_name('repair-gita-timings.py')), 'Candidate uses older reconciliation rules'
                assert digest(live / 'timings.json') == validation['priorManifestSha256'], 'Live manifest changed after staging'
                prior = load(live / 'timings.json')
                identity = validation.get('priorAlignmentFingerprint', prior.get('alignmentFingerprint'))
            elif contextual_report.exists():
                saved = load(contextual_report)
                if saved.get('fingerprint') == identity and not saved.get('errors'):
                    alignment = load(work_context / 'alignment.json')
                    if alignment['fingerprint'] == identity and \
                            alignment['recipe']['sourceSha256'] == manifest['sourceSha256'] and \
                            alignment['recipe']['textSha256'] == digest(live / 'data.js'):
                        validation = saved
                        identity = saved.get('priorAlignmentFingerprint')
            evidence_path = ROOT / '.gita-work' / f'chapter-{chapter}' / 'groq-repair' / f'aligned-{identity}.json'
            evidence_ends = {}
            if identity and evidence_path.exists():
                decisions = load(evidence_path)['decisions']
                for decision in decisions:
                    number = decision['verse']
                    end = max(g['sourceEnd'] for g in decision['groups'])
                    evidence_ends[number] = max(evidence_ends.get(number, 0), end)
            elif validation and validation.get('lineAnchors'):
                for line in validation['lineAnchors']:
                    number = line['verse']
                    if line.get('windowMethod', '').startswith('retained-'):
                        evidence_ends.pop(number, None)
                        report['flags'].append({'chapter': chapter, 'verse': number,
                            'text': ' '.join(line['tokens']), 'flags': ['ASR-omitted-line-retained-search-window']})
                        continue
                    evidence_ends[number] = max(evidence_ends.get(number, 0), line['end'])
            row = {'chapter': chapter, 'verses': len(verses), 'words': 0, 'shortCues': 0, 'lowScoreCues': 0,
                   'longGaps': 0, 'suspectCuts': 0, 'zeroScoreCues': 0, 'zeroDurationCues': 0,
                   'transcriptSeamsChecked': 0, 'largeCueMoves': 0, 'tightCutMargins': 0,
                   'manifestSha256': digest(base / 'timings.json'), 'sourceSha256': manifest['sourceSha256']}
            for index, (text, verse) in enumerate(zip(verses, manifest['verses'])):
                tokens = [t for t in text['sanskrit'].split() if any('\u0900' <= c <= '\u0963' for c in t)]
                assert verse['verse'] == index + 1 and tokens == [w['text'] for w in verse['words']], f'{chapter}.{index+1}: canonical tokens'
                assert abs(verse['sourceEnd'] - verse['sourceStart'] - verse['duration']) < .003, 'Duration mismatch'
                media = base / verse['audio']
                assert media.is_file() and media.stat().st_size, 'Missing clip'
                media_jobs.append((chapter, verse, media))
                row['words'] += len(tokens)
                for wi, word in enumerate(verse['words']):
                    assert all(isinstance(word[k], (int, float)) and math.isfinite(word[k]) for k in ('start', 'end')), 'Invalid timestamp'
                    if 'score' in word:
                        assert isinstance(word['score'], (int, float)) and math.isfinite(word['score']) and 0 <= word['score'] <= 1, 'Invalid acoustic score'
                    assert 0 <= word['start'] <= word['end'] <= verse['duration'] + .01, f'{chapter}.{index+1}: cue out of bounds'
                    if wi:
                        assert verse['words'][wi-1]['end'] <= word['start'] + .05, 'Cue overlap'
                    reasons = []
                    if word['end'] == word['start']:
                        reasons.append('zero-duration-cue'); row['zeroDurationCues'] += 1
                        if candidate:
                            report['errors'].append({'chapter': chapter, 'verse': index+1, 'word': wi+1, 'error': 'Zero-duration candidate cue'})
                    if word['end'] - word['start'] < .12:
                        reasons.append('cue-under-120ms'); row['shortCues'] += 1
                    if word.get('score', 1) < .5:
                        reasons.append('acoustic-score-under-0.5'); row['lowScoreCues'] += 1
                    if word.get('score') == 0:
                        reasons.append('zero-acoustic-score'); row['zeroScoreCues'] += 1
                    if wi and word['start'] - verse['words'][wi-1]['end'] > .6:
                        reasons.append('gap-over-600ms'); row['longGaps'] += 1
                    if prior:
                        old = prior['verses'][index]
                        old_word = old['words'][wi]
                        movement = max(abs(verse['sourceStart'] + word[key] - old['sourceStart'] - old_word[key]) for key in ('start', 'end'))
                        if movement > .75:
                            reasons.append('cue-moved-over-750ms'); row['largeCueMoves'] += 1
                    if reasons:
                        report['flags'].append({'chapter': chapter, 'verse': index+1, 'word': wi+1,
                            'text': word['text'], 'sourceStart': round(verse['sourceStart'] + word['start'], 3),
                            'sourceEnd': round(verse['sourceStart'] + word['end'], 3), 'score': word.get('score'), 'flags': reasons})
                if index:
                    assert manifest['verses'][index-1]['sourceEnd'] <= verse['sourceStart'] + verse['words'][0]['start'] + .001, 'Neighbor contamination according to cues'
                if index + 1 < len(verses):
                    following = manifest['verses'][index + 1]
                    last_end = verse['sourceStart'] + verse['words'][-1]['end']
                    next_start = following['sourceStart'] + following['words'][0]['start']
                    if min(verse['sourceEnd'] - last_end, next_start - verse['sourceEnd']) < .08:
                        row['tightCutMargins'] += 1
                        report['flags'].append({'chapter': chapter, 'verse': index+1,
                            'flags': ['cut-with-under-80ms-cue-margin'], 'clipEnd': verse['sourceEnd'],
                            'lastCueEnd': round(last_end, 3), 'nextCueStart': round(next_start, 3)})
                if index + 1 in evidence_ends and index + 1 < len(verses):
                    row['transcriptSeamsChecked'] += 1
                    evidence_end = evidence_ends[index + 1]
                    if evidence_end - verse['sourceEnd'] > .35:
                        row['suspectCuts'] += 1
                        report['flags'].append({'chapter': chapter, 'verse': index+1,
                            'flags': ['transcript-extends-beyond-cut'], 'clipEnd': verse['sourceEnd'], 'evidenceEnd': evidence_end})
            report['chapters'].append(row)
            print(f"Chapter {chapter}: {row['verses']} verses, {row['shortCues']} short cues, {row['lowScoreCues']} low scores", flush=True)
        except (AssertionError, KeyError, ValueError, OSError) as error:
            report['errors'].append({'chapter': chapter, 'error': str(error)})
    if decoder:
        def decode(job):
            chapter, verse, path = job
            result = subprocess.run([decoder, '-v', 'error', '-i', str(path), '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1'], capture_output=True)
            length = len(result.stdout) / (4 * 16000)
            if result.returncode or abs(length - verse['duration']) > .08 or verse['words'][-1]['end'] > length + .01:
                return {'chapter': chapter, 'verse': verse['verse'], 'error': 'Decoded audio duration/cue check failed', 'decodedDuration': length}
            return {'chapter': chapter, 'verse': verse['verse'], 'decodedDuration': length, 'sha256': digest(path)}
        with ThreadPoolExecutor(max_workers=4) as pool:
            for result in pool.map(decode, media_jobs):
                if 'error' in result:
                    report['errors'].append(result)
                report['media'].append(result)
    report['totals'] = {key: sum(row[key] for row in report['chapters']) for key in
                        ('verses', 'words', 'shortCues', 'lowScoreCues', 'zeroScoreCues', 'zeroDurationCues', 'longGaps', 'suspectCuts', 'transcriptSeamsChecked', 'largeCueMoves', 'tightCutMargins')}
    report['totals']['flaggedVerses'] = len({(flag['chapter'], flag['verse']) for flag in report['flags']})
    for flag in report['flags']:
        flag['readerPath'] = f"/gita/{flag['chapter']}/#{flag['chapter']}-{flag['verse']}"
    report['limitations'] = ['Flags are review candidates, not counts of confirmed errors.',
        'Automated structure, decoding and acoustic scores do not certify word identity.',
        'A complete human listening review is still required for a manually verified status.']
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chapters', type=int, nargs='+', default=list(range(1,19)), choices=range(1,19))
    parser.add_argument('--candidate', help='Candidate directory under each chapter work folder, e.g. context-repair')
    parser.add_argument('--decode', help='FFmpeg executable: decode and check every clip')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.candidate and (Path(args.candidate).name != args.candidate or args.candidate in ('.', '..')):
        parser.error('--candidate must be one directory name')
    report = audit(args.chapters, args.candidate, args.decode)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'totals': report['totals'], 'errors': len(report['errors']), 'decodedClips': len(report['media'])}))
    if report['errors']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
