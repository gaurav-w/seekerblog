"""Stage a source-hashed, offline Gita alignment with neighboring-line context.

No cloud requests or publication. --promote requires a successful staged media
audit. Low scores and short clitics remain a listening queue, never certification.
"""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
VERSION = 1
MODEL = 'theainerd/Wav2Vec2-large-xlsr-hindi'
spec = importlib.util.spec_from_file_location('repair', Path(__file__).with_name('repair-gita-timings.py'))
repair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repair)


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def evidence_for(chapter, manifest, source, local_only=False, cache_only=False):
    """Use only evidence for this exact recording; refresh uncached local ASR."""
    work = ROOT / '.gita-work' / f'chapter-{chapter}'
    choices = []
    for path in (work / 'groq').glob('*.json'):
        if '.raw.' in path.name:
            continue
        saved = read_json(path)
        if saved.get('settings', {}).get('sourceSha256') == manifest['sourceSha256'] and \
                saved['settings'].get('language') == 'hi':
            choices.append(saved)
    if choices and not local_only:
        saved = max(choices, key=lambda value: value.get('createdUtc', ''))
        return saved['result']['words'], 'cached-groq', fingerprint(saved)
    cache = work / 'context-repair' / 'local-evidence.json'
    settings = {'sourceSha256': manifest['sourceSha256'], 'model': 'faster-whisper-small',
                'language': 'hi', 'beamSize': 5, 'conditionOnPreviousText': False, 'vad': False}
    if cache.exists() and read_json(cache).get('settings') == settings:
        saved = read_json(cache)
        return saved['words'], 'local-asr', fingerprint(saved)
    if cache_only:
        raise ValueError(f'Chapter {chapter}: no matching cached transcript')
    from faster_whisper import WhisperModel
    model = WhisperModel('small', device='cpu', compute_type='int8', local_files_only=True, cpu_threads=6)
    segments, _ = model.transcribe(str(source), language='hi', beam_size=5, word_timestamps=True,
        condition_on_previous_text=False, no_speech_threshold=None, vad_filter=False)
    words = []
    for segment in segments:
        words.extend({'word': w.word, 'start': w.start, 'end': w.end} for w in segment.words)
    saved = {'settings': settings, 'words': words}
    write_json(cache, saved)
    print(f'Chapter {chapter}: fresh local ASR, {len(words)} anchors', flush=True)
    return words, 'local-asr', fingerprint(saved)


def locate_lines(chapter, manifest, verses, lines, words):
    """Recover current cached decisions by fingerprint, including chapters 9/10."""
    work = ROOT / '.gita-work' / f'chapter-{chapter}'
    identity = manifest.get('alignmentFingerprint')
    cache = work / 'groq-repair' / f'aligned-{identity}.json'
    report = work / 'groq-repair' / 'report.json'
    decisions = None
    if identity and cache.exists():
        decisions = read_json(cache)['decisions']
    elif identity and report.exists() and read_json(report).get('alignmentFingerprint') == identity:
        decisions = read_json(report)['decisions']
    if decisions:
        if len(decisions) != len(lines) or any(d['line'].split() != line['tokens'] or
                d['verse'] != line['verse'] for d, line in zip(decisions, lines)):
            raise ValueError('Cached line decisions do not match current canonical text')
        return [{'verse': d['verse'], 'tokens': d['line'].split(),
                 'start': min(g['sourceStart'] for g in d['groups']),
                 'end': max(g['sourceEnd'] for g in d['groups']), 'coverage': d['coverage']}
                for d in decisions]
    # The replacement chapter-14 master has no compatible Groq cache. Its
    # freshly hashed local transcript supplies independent line windows.
    ref = ''.join(repair.normalize(token) for line in lines for token in line['tokens'])
    mapping = repair.match_characters(ref, words)
    located, offsets = [], {}
    for line in lines:
        support = repair.line_support(line, mapping, words)
        number = line['verse']
        offset = offsets.get(number, 0)
        offsets[number] = offset + len(line['tokens'])
        if support['coverage'] < .45:
            # ASR can omit an entire chanted line. Retain only its rough search
            # window from the exact current master, not its old word cues.
            # Neighboring spoken lines still constrain the acoustic alignment.
            old = manifest['verses'][number - 1]
            cues = old['words'][offset:offset + len(line['tokens'])]
            if [cue['text'] for cue in cues] != line['tokens']:
                raise ValueError(f'Chapter {chapter}.{number}: incompatible retained line window')
            start = old['sourceStart'] + cues[0]['start'] - .3
            end = old['sourceStart'] + cues[-1]['end'] + .3
            method = 'retained-search-window-ASR-omission'
        else:
            start, end = support['start'], support['end']
            method = 'local-ASR-line-support'
        located.append({'verse': number, 'tokens': line['tokens'],
                        'start': max(0, start), 'end': end, 'coverage': support['coverage'],
                        'windowMethod': method})
    return located


def context_jobs(verses, located, audio_duration):
    jobs = []
    for number in range(1, len(verses) + 1):
        own = [i for i, line in enumerate(located) if line['verse'] == number]
        first, last = own[0], own[-1]
        lo = max(0, first - 1)
        hi = min(len(located), last + 2)
        # Include a spoken line beyond a short speaker announcement.
        if hi < len(located) and len(''.join(located[hi - 1]['tokens'])) < 12:
            hi += 1
        chosen = located[lo:hi]
        tokens = [token for line in chosen for token in line['tokens']]
        offset = sum(len(line['tokens']) for line in located[lo:first])
        count = sum(len(line['tokens']) for line in located[first:last + 1])
        jobs.append({'verse': number, 'start': max(0, min(line['start'] for line in chosen) - .25),
                     'end': min(audio_duration, max(line['end'] for line in chosen) + .35),
                     'tokens': tokens, 'offset': offset, 'count': count,
                     'ownStart': min(located[i]['start'] for i in own),
                     'ownEnd': max(located[i]['end'] for i in own)})
    return jobs


def valid_word(word):
    return all(isinstance(word.get(k), (int, float)) and math.isfinite(word[k]) for k in ('start', 'end')) \
        and 0 <= word['start'] < word['end']


def choose_words(prior, proposed, job, overrides):
    """Keep stronger established cues when a new context fails a word."""
    if len(proposed) != len(prior['words']) or [w.get('word') for w in proposed] != [w['text'] for w in prior['words']]:
        raise ValueError(f"Verse {prior['verse']}: incomplete canonical alignment")
    selected, decisions = [], []
    for old, new in zip(prior['words'], proposed):
        previous = {'word': old['text'], 'start': prior['sourceStart'] + old['start'],
                    'end': prior['sourceStart'] + old['end'], 'timingMethod': old.get('timingMethod', 'prior-acoustic')}
        if 'score' in old:
            previous['score'] = old['score']
        score = new.get('score', 0)
        collapsed = valid_word(new) and len(repair.normalize(new['word'])) >= 5 and new['end'] - new['start'] < .12
        usable = valid_word(new) and score > 0 and not collapsed
        stronger_prior = valid_word(previous) and previous.get('score', 0) >= .5 and score < previous['score'] - .2
        # Score comparisons do not certify word identity. They only prevent a
        # clearly weaker context from replacing an established acoustic cue.
        pick = previous if not usable or stronger_prior else {**new, 'timingMethod': 'neighbor-context-acoustic'}
        selected.append(pick)
        decisions.append('retained-prior' if pick is previous else 'neighbor-context-acoustic')
    # A fallback cue is usable only inside its new neighbors. Resolve conflicts
    # with the complete contextual sequence, never by clipping word intervals.
    if any(a['end'] > b['start'] + .05 for a, b in zip(selected, selected[1:])):
        if all(valid_word(w) and w.get('score', 0) > 0 for w in proposed) and \
                all(a['end'] <= b['start'] + .05 for a, b in zip(proposed, proposed[1:])):
            selected = [{**w, 'timingMethod': 'neighbor-context-acoustic'} for w in proposed]
            decisions = ['neighbor-context-acoustic'] * len(selected)
        else:
            selected = [{'word': w['text'], 'start': prior['sourceStart'] + w['start'],
                         'end': prior['sourceStart'] + w['end'],
                         'timingMethod': w.get('timingMethod', 'prior-acoustic'),
                         **({'score': w['score']} if 'score' in w else {})} for w in prior['words']]
            decisions = ['retained-prior-context-conflict'] * len(selected)
    explicit = overrides.get('_cueOverrides', {}).get(str(prior['verse']))
    if explicit:
        if [w['word'] for w in explicit] != [w['word'] for w in selected]:
            raise ValueError('Established cue override has different tokens')
        selected = [{**word, 'timingMethod': 'preserved-source-supported',
                     **({'score': prior['words'][i]['score']} if 'score' in prior['words'][i] else {})}
                    for i, word in enumerate(explicit)]
        decisions = ['preserved-source-supported'] * len(selected)
    endpoint = overrides.get('_lastCueEndOverrides', {}).get(str(prior['verse']))
    if endpoint is not None:
        selected[-1]['end'] = endpoint
        selected[-1]['timingMethod'] = 'source-supported-endpoint'
        selected[-1].pop('score', None)
    return selected, decisions


def quiet_cut(audio, left_end, right_start):
    import numpy as np
    if right_start < left_end:
        raise ValueError('Spoken boundaries overlap; cannot choose a cut')
    centers = np.arange(left_end + .05, right_start - .05, .01)
    if not len(centers):
        return (left_end + right_start) / 2
    rms = np.array([np.mean(audio[int((c - .04) * 16000):int((c + .04) * 16000)] ** 2) for c in centers])
    # Prefer the middle of a sustained quiet region. A single lowest-energy
    # frame can fall near a faint initial consonant or a background-music dip.
    threshold = float(rms.min() + .2 * (np.percentile(rms, 90) - rms.min()))
    runs, run = [], []
    for index, quiet in enumerate(rms <= threshold):
        if quiet:
            run.append(index)
        elif run:
            runs.append(run); run = []
    if run:
        runs.append(run)
    longest = max(runs, key=len)
    if len(longest) >= 8:
        return float(centers[longest[len(longest) // 2]])
    return float(centers[int(np.argmin(rms))])


class CachedRuntime:
    """Rebuild from saved acoustic results without loading an alignment model."""
    def __init__(self, ffmpeg):
        self.ffmpeg = ffmpeg

    def load_audio(self, source):
        import numpy as np
        decoded = subprocess.run([self.ffmpeg, '-v', 'error', '-i', str(source),
            '-ac', '1', '-ar', '16000', '-f', 's16le', 'pipe:1'], check=True, capture_output=True)
        return np.frombuffer(decoded.stdout, dtype=np.int16).astype(np.float32) / 32768

    def align(self, *args, **kwargs):
        raise ValueError('Acoustic cache missing: rerun without --cached-only')


def align_chapter(chapter, model, metadata, whisperx, ffmpeg, workers, threads, cache_only=False):
    base = ROOT / 'gita' / str(chapter)
    manifest = read_json(base / 'timings.json')
    source = ROOT / 'authoring' / 'gita' / f'chapter-{chapter}.mp3'
    if sha(source) != manifest['sourceSha256']:
        raise ValueError('Master hash differs from current manifest')
    verses, _, lines = repair.text_data(chapter)
    words, provider, evidence_hash = evidence_for(chapter, manifest, source, cache_only=cache_only)
    located = locate_lines(chapter, manifest, verses, lines, words)
    audio = whisperx.load_audio(str(source))
    jobs = context_jobs(verses, located, len(audio) / 16000)
    output_dir = ROOT / '.gita-work' / f'chapter-{chapter}' / 'context-repair'
    output_dir.mkdir(parents=True, exist_ok=True)
    recipe = {'version': VERSION, 'scriptSha256': sha(Path(__file__)),
              'repairScriptSha256': sha(Path(repair.__file__)), 'model': MODEL,
              'sourceSha256': manifest['sourceSha256'], 'textSha256': sha(base / 'data.js'),
              'evidenceSha256': evidence_hash, 'jobs': jobs}
    identity = fingerprint(recipe)
    override_path = ROOT / 'authoring' / 'scripts' / f'gita-alignment-windows-chapter-{chapter}.json'
    if chapter == 3:
        override_path = ROOT / 'authoring' / 'scripts' / 'gita-alignment-windows.json'
    overrides = read_json(override_path) if override_path.exists() else {}
    print(f'Chapter {chapter}: {len(jobs)} contexts; anchors {provider}', flush=True)

    def align(job):
        key = fingerprint({'source': manifest['sourceSha256'], 'model': MODEL, 'job': job, 'version': VERSION})
        cache = output_dir / 'contexts' / f'{key}.json'
        if cache.exists():
            result = read_json(cache)
        else:
            result = whisperx.align([{'start': job['start'], 'end': job['end'], 'text': ' '.join(job['tokens'])}],
                model, metadata, audio, 'cpu', return_char_alignments=False, print_progress=False)['word_segments']
            write_json(cache, result)
        own = result[job['offset']:job['offset'] + job['count']]
        selected, decisions = choose_words(manifest['verses'][job['verse'] - 1], own, job, overrides)
        return {'verse': job['verse'], 'words': selected, 'choices': decisions,
                'context': job, 'rawWords': result}

    results = []
    initializer = None
    if not cache_only:
        import torch
        initializer = lambda: torch.set_num_threads(threads)
    with ThreadPoolExecutor(max_workers=workers, initializer=initializer) as pool:
        for result in pool.map(align, jobs):
            results.append(result)
            if len(results) % 5 == 0 or len(results) == len(jobs):
                print(f'Chapter {chapter}: {len(results)}/{len(jobs)} contexts aligned', flush=True)
    write_json(output_dir / 'alignment.json', {'fingerprint': identity, 'recipe': recipe, 'results': results})
    joint_repairs = []
    for left, right in zip(results, results[1:]):
        last, first = left['words'][-1], right['words'][0]
        old_cut = manifest['verses'][left['verse'] - 1]['sourceEnd']
        if last['end'] <= first['start'] and (last['end'] <= old_cut <= first['start'] or
                min(last.get('score', 1), first.get('score', 1)) >= .25):
            continue
        left_line = [line for line in located if line['verse'] == left['verse']][-1]
        right_lines = [line for line in located if line['verse'] == right['verse']]
        context = [left_line, *right_lines]
        following = next((line for line in located if line['verse'] == right['verse'] + 1), None)
        if following:
            context.append(following)
        bounds = {'start': max(0, min(line['start'] for line in context) - .25),
                  'end': min(len(audio) / 16000, max(line['end'] for line in context) + .35),
                  'text': ' '.join(token for line in context for token in line['tokens'])}
        joint_key = fingerprint({'source': manifest['sourceSha256'], 'model': MODEL, 'bounds': bounds, 'version': VERSION})
        joint_cache = output_dir / 'contexts' / f'joint-{joint_key}.json'
        if joint_cache.exists():
            revised = read_json(joint_cache)
        else:
            revised = whisperx.align([bounds], model, metadata, audio, 'cpu',
                return_char_alignments=False, print_progress=False)['word_segments']
            write_json(joint_cache, revised)
        count = len(left_line['tokens'])
        before = [last, first]
        established = []
        for number, position in ((left['verse'], -1), (right['verse'], 0)):
            old_verse = manifest['verses'][number - 1]
            word = old_verse['words'][position]
            established.append({'word': word['text'], 'start': old_verse['sourceStart'] + word['start'],
                'end': old_verse['sourceStart'] + word['end'], 'timingMethod': word.get('timingMethod'),
                **({'score': word['score']} if 'score' in word else {})})
        pair = [revised[count - 1], revised[count]] if len(revised) > count else []
        issues = repair.reconciliation_issues(established, pair)
        if not issues and pair[0]['end'] <= pair[1]['start']:
            # Resolve complete sequences without letting an unsupported inner
            # clitic replace its established cue. The boundary itself still
            # needs positive acoustic evidence on both sides.
            left_proposed = left['words'][:-count] + revised[:count]
            right_proposed = revised[count:count + len(right['words'])]
            left_words, left_choices = choose_words(manifest['verses'][left['verse'] - 1], left_proposed, left['context'], overrides)
            right_words, right_choices = choose_words(manifest['verses'][right['verse'] - 1], right_proposed, right['context'], overrides)
            # These two words passed the dedicated reconciliation guard. An
            # older pause-inflated cue must not reintroduce their overlap via
            # the conservative fallback used for unrelated inner words.
            left_words[-1] = {**pair[0], 'timingMethod': 'joint-context-acoustic'}
            right_words[0] = {**pair[1], 'timingMethod': 'joint-context-acoustic'}
            left_choices[-1] = right_choices[0] = 'joint-context-boundary'
            affected = left_words[-count:] + right_words
            if all(valid_word(w) for w in affected) and \
                    all(a['end'] <= b['start'] + .05 for a, b in zip(affected, affected[1:])) and \
                    left_words[-1]['end'] <= right_words[0]['start']:
                for sequence, choices in ((left_words, left_choices), (right_words, right_choices)):
                    for word, choice in zip(sequence, choices):
                        if choice == 'neighbor-context-acoustic':
                            word['timingMethod'] = 'joint-context-acoustic'
                left['words'], left['choices'] = left_words, left_choices
                right['words'], right['choices'] = right_words, right_choices
                joint_repairs.append({'afterVerse': left['verse'], 'bounds': bounds, 'before': before,
                                      'after': [left_words[-1], right_words[0]]})
    # Joint alignment must not undo established source-supported corrections.
    for result, prior in zip(results, manifest['verses']):
        if str(result['verse']) in overrides.get('_cueOverrides', {}) or \
                str(result['verse']) in overrides.get('_lastCueEndOverrides', {}):
            result['words'], result['choices'] = choose_words(prior, result['words'], result['context'], overrides)
    errors, seams = [], []
    boundaries = []
    for left, right, old_left in zip(results, results[1:], manifest['verses']):
        last, first = left['words'][-1], right['words'][0]
        if last['end'] > first['start']:
            errors.append({'type': 'neighbor-overlap', 'afterVerse': left['verse'], 'left': last, 'right': first})
            continue
        old_cut = old_left['sourceEnd']
        inside = last['end'] <= old_cut <= first['start']
        strong_boundary = min(last.get('score', 1), first.get('score', 1)) >= .25
        gap = first['start'] - last['end']
        recenter = inside and strong_boundary and gap > .25 and \
            min(old_cut - last['end'], first['start'] - old_cut) < .08
        keep = inside and not recenter
        margin = .05 if gap > .3 else 0
        cut = old_cut if keep else quiet_cut(audio, last['end'] + margin, first['start'] - margin)
        if not keep and (last.get('score', 1) < .25 or first.get('score', 1) < .25):
            errors.append({'type': 'unsupported-new-cut', 'afterVerse': left['verse'], 'left': last, 'right': first})
        boundaries.append(cut)
        seams.append({'afterVerse': left['verse'], 'oldCut': old_cut, 'newCut': round(cut, 3),
                      'lastCueEnd': last['end'], 'nextCueStart': first['start'], 'changed': not keep,
                      'recenteredForTailMargin': recenter})
    if errors:
        write_json(output_dir / 'report.json', {'chapter': chapter, 'fingerprint': identity, 'errors': errors,
                   'seams': seams, 'jointRepairs': joint_repairs, 'reviewStatus': 'machine-aligned'})
        raise ValueError(f'Chapter {chapter}: {len(errors)} disputed cuts; staged evidence retained')
    output = {**manifest, 'method': 'Canonical Sanskrit aligned with neighboring spoken lines and source-hashed ASR anchors; uncertain cues retained for listening review.',
              'reviewStatus': 'machine-aligned', 'alignmentFingerprint': identity, 'verses': []}
    changed_cues, changed_audio = 0, 0
    for index, (result, prior) in enumerate(zip(results, manifest['verses'])):
        start = manifest['verses'][0]['sourceStart'] if index == 0 else boundaries[index - 1]
        if index == 0:
            start = min(start, max(0, result['words'][0]['start'] - .18))
        end = boundaries[index] if index + 1 < len(results) else max(prior['sourceEnd'], result['words'][-1]['end'] + .15)
        if index + 1 == len(results):
            end = overrides.get('_clipEndOverrides', {}).get(str(index + 1), end)
        start, end = round(start, 3), round(end, 3)
        cue_words = []
        for old, word in zip(prior['words'], result['words']):
            cue = {'text': word['word'], 'start': round(word['start'] - start, 3),
                   'end': round(word['end'] - start, 3), 'timingMethod': word['timingMethod']}
            if 'score' in word:
                cue['score'] = word['score']
            if cue['start'] < 0 or cue['end'] > end - start + .002:
                raise ValueError(f"Chapter {chapter}.{index + 1}: cue outside source cut")
            if abs((prior['sourceStart'] + old['start']) - word['start']) > .05 or \
                    abs((prior['sourceStart'] + old['end']) - word['end']) > .05:
                changed_cues += 1
            cue_words.append(cue)
        output['verses'].append({'verse': index + 1, 'audio': prior['audio'], 'sourceStart': start,
            'sourceEnd': end, 'duration': round(end - start, 3), 'highlightMode': 'word', 'words': cue_words})
        destination = output_dir / prior['audio']
        destination.parent.mkdir(exist_ok=True)
        if abs(start - prior['sourceStart']) < .0005 and abs(end - prior['sourceEnd']) < .0005:
            shutil.copy2(base / prior['audio'], destination)
        else:
            changed_audio += 1
            subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(start), '-i', str(source),
                '-t', str(end - start), '-vn', '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', '96k', str(destination)], check=True)
    write_json(output_dir / 'timings.json', output)
    payload = json.dumps(output, ensure_ascii=False, indent=2)
    (output_dir / 'timings.js').write_text(f'window.GITA_CHAPTER_{chapter}_TIMINGS = {payload};\n', encoding='utf-8')
    write_json(output_dir / 'report.json', {'chapter': chapter, 'fingerprint': identity, 'errors': [], 'seams': seams,
        'changedCues': changed_cues, 'changedAudio': changed_audio, 'jointRepairs': joint_repairs,
        'priorManifestSha256': sha(base / 'timings.json'),
        'priorAlignmentFingerprint': manifest.get('alignmentFingerprint'),
        'choices': {str(result['verse']): result['choices'] for result in results},
        'lineAnchors': located, 'anchorProvider': provider,
        'reviewStatus': 'machine-aligned'})
    print(f'Chapter {chapter}: staged {changed_cues} changed cues, {changed_audio} recut clips', flush=True)


def promote(chapters, audit_path):
    audit = read_json(audit_path)
    if audit.get('errors') or not audit.get('media'):
        raise ValueError('Promotion requires a successful decoded candidate audit')
    audited = {row['chapter']: row for row in audit['chapters']}
    media = {(row['chapter'], row['verse']): row for row in audit['media']}
    staged = []
    # Check every chapter and file before writing any live asset.
    for chapter in chapters:
        live = ROOT / 'gita' / str(chapter)
        candidate = ROOT / '.gita-work' / f'chapter-{chapter}' / 'context-repair'
        report = read_json(candidate / 'report.json')
        manifest = read_json(candidate / 'timings.json')
        if report['errors'] or report['fingerprint'] != manifest['alignmentFingerprint']:
            raise ValueError(f'Chapter {chapter}: unresolved candidate errors')
        if sha(live / 'timings.json') != report['priorManifestSha256']:
            raise ValueError(f'Chapter {chapter}: live timings changed after staging')
        if sha(candidate / 'timings.json') != audited[chapter]['manifestSha256']:
            raise ValueError(f'Chapter {chapter}: candidate changed after audit')
        script_payload = (candidate / 'timings.js').read_text(encoding='utf-8').split('=', 1)[1].strip().removesuffix(';')
        if json.loads(script_payload) != manifest:
            raise ValueError(f'Chapter {chapter}: candidate JS differs from audited JSON')
        if sha(ROOT / 'authoring/gita' / f'chapter-{chapter}.mp3') != manifest['sourceSha256']:
            raise ValueError(f'Chapter {chapter}: master changed after audit')
        for verse in manifest['verses']:
            if sha(candidate / verse['audio']) != media[chapter, verse['verse']]['sha256']:
                raise ValueError(f'Chapter {chapter}.{verse["verse"]}: candidate audio changed after audit')
            staged.append((chapter, candidate / verse['audio'], live / verse['audio']))
        staged.extend((chapter, candidate / name, live / name) for name in ('timings.json', 'timings.js'))
    changed = 0
    for chapter, source, target in staged:
        if sha(source) == sha(target):
            continue
        backup = ROOT / '.gita-work/pre-context-repair' / f'chapter-{chapter}' / target.relative_to(ROOT / 'gita' / str(chapter))
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            shutil.copy2(target, backup)
        with tempfile.NamedTemporaryFile(dir=target.parent, suffix='.tmp', delete=False) as temporary:
            temporary.write(source.read_bytes())
            name = temporary.name
        os.replace(name, target)
        changed += 1
    print(f'Promoted {len(chapters)} validated chapters; {changed} files changed; originals retained in .gita-work/pre-context-repair.', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chapters', type=int, nargs='+', default=list(range(1, 19)), choices=range(1, 19))
    parser.add_argument('--ffmpeg')
    parser.add_argument('--workers', type=int, default=2)
    parser.add_argument('--threads', type=int, default=3)
    parser.add_argument('--cached-only', action='store_true', help='Refuse uncached ASR/alignment; rebuild saved results only')
    parser.add_argument('--promote', action='store_true')
    parser.add_argument('--audit', type=Path)
    args = parser.parse_args()
    if args.promote:
        if args.audit is None:
            parser.error('--promote requires --audit with a successful decoded candidate report')
        promote(args.chapters, args.audit)
        return
    if not args.ffmpeg:
        parser.error('Alignment requires --ffmpeg')
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    os.environ['OMP_NUM_THREADS'] = str(args.threads)
    os.environ['MKL_NUM_THREADS'] = str(args.threads)
    if args.cached_only:
        whisperx, model, metadata = CachedRuntime(args.ffmpeg), None, None
    else:
        import torch, whisperx
        torch.set_num_threads(args.threads)
        model, metadata = whisperx.load_align_model('hi', 'cpu', model_cache_only=True)
    errors = []
    for chapter in args.chapters:
        try:
            align_chapter(chapter, model, metadata, whisperx, args.ffmpeg, args.workers, args.threads, args.cached_only)
        except (ValueError, OSError) as error:
            print(f'REVIEW REQUIRED: {error}', flush=True)
            errors.append(str(error))
    if errors:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
