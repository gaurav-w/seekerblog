"""Stage Sanskrit acoustic alignment constrained by cached Groq word spans.

Never invent word boundaries by dividing a recognized group evenly. Exact
one-to-one STT matches retain measured provider spans; merged or noisy groups
are acoustically aligned. Raw responses and every chosen method are retained.
"""
from __future__ import annotations
import argparse
import difflib
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
VERSION = 2


def reconciliation_issues(before, after):
    """A nonoverlapping result alone is insufficient evidence for a new cut."""
    if [w['word'] for w in before] != [w.get('word') for w in after]:
        return ['canonical-token-mismatch']
    issues = []
    for old, new in zip(before, after):
        start, end, score = new.get('start'), new.get('end'), new.get('score', 0)
        if not all(isinstance(x, (int, float)) and math.isfinite(x) for x in (start, end, score)):
            issues.append('invalid-acoustic-result')
            continue
        if end <= start or score < .25:
            issues.append('unsupported-acoustic-boundary')
        if len(normalize(new['word'])) >= 5 and end - start < .12:
            issues.append('collapsed-compound')
        # Short words can inherit a preceding pause in an older alignment.
        # Reserve the severe-compression guard for genuinely long tokens;
        # zero-score and collapsed-word checks still apply to every boundary.
        if len(normalize(old['word'])) >= 8 and \
                (old.get('timingMethod') == 'groq-word' or old.get('score', 0) >= .5) and \
                old['end'] - old['start'] > .5 and end - start < .4 * (old['end'] - old['start']):
            issues.append('stronger-evidence-was-compressed')
    return sorted(set(issues))


def normalize(text):
    for a, b in [('श','स'), ('ष','स'), ('ण','न'), ('ँ','ं'), ('ी','ि'), ('ू','ु'), ('ृ','्रि')]:
        text = text.replace(a,b)
    return ''.join(c for c in text if '\u0900' <= c <= '\u0963' and c not in 'ः्ऽ')


def measured_match(tokens, recognition, provider, start, end):
    if not provider.startswith('groq') or len(tokens)!=1 or not .08<=end-start<=8:
        return False
    canonical=normalize(tokens[0])
    # Whisper often writes the audible final visarga as हा (e.g. मतः -> मतहा).
    # Retain that measured interval when the rest of the token matches exactly.
    visarga='ः' in tokens[0] and recognition in (canonical+'ह',canonical+'हा')
    return visarga or difflib.SequenceMatcher(None,canonical,recognition,autojunk=False).ratio()>=.75


def text_data(chapter):
    text = (ROOT / 'gita' / str(chapter) / 'data.js').read_text(encoding='utf-8')
    verses = json.loads(text.split('=',1)[1].strip().removesuffix(';'))
    ref, lines = '', []
    for verse, data in enumerate(verses, 1):
        for line in data['sanskrit'].splitlines():
            tokens, offsets = [], []
            for token in line.split():
                if re.search('[\u0900-\u0963]', token):
                    start = len(ref)
                    ref += normalize(token)
                    tokens.append(token)
                    offsets.append((start, len(ref)))
            if tokens:
                lines.append({'verse':verse, 'tokens':tokens, 'offsets':offsets})
    return verses, ref, lines


def match_characters(reference, words):
    heard, word_ids = '', []
    for index, word in enumerate(words):
        text = normalize(word['word'])
        heard += text
        word_ids.extend([index] * len(text))
    mapping = {}
    for block in difflib.SequenceMatcher(None, reference, heard, autojunk=False).get_matching_blocks():
        if block.size >= 3:
            for offset in range(block.size):
                mapping[block.a + offset] = word_ids[block.b + offset]
    return mapping


def line_support(line, mapping, words):
    ids = [[mapping[c] for c in range(start,end) if c in mapping] for start,end in line['offsets']]
    coverage = sum(map(len, ids)) / sum(end-start for start,end in line['offsets'])
    found = [index for group in ids for index in group]
    if not found:
        return {'coverage':0, 'ids':ids}
    return {'coverage':coverage, 'ids':ids, 'start':words[min(found)]['start'], 'end':words[max(found)]['end']}


def groups_for(line, support):
    # Tokens touching the same recognized word share one acoustic window.
    groups = []
    for index, found in enumerate(support['ids']):
        ids = set(found)
        if groups and (not ids or not groups[-1]['ids'] or ids & groups[-1]['ids']):
            groups[-1]['tokens'].append(index)
            groups[-1]['ids'].update(ids)
        else:
            groups.append({'tokens':[index], 'ids':ids})
    if len(groups)>1 and not groups[0]['ids']:
        groups[1]['tokens'] = groups[0]['tokens']+groups[1]['tokens']
        groups.pop(0)
    return groups


def load_evidence(chapter):
    files = [p for p in (ROOT/'.gita-work'/f'chapter-{chapter}'/'groq').glob('*.json') if '.raw.' not in p.name]
    choices = [json.loads(p.read_text(encoding='utf-8')) for p in files]
    choices = [r for r in choices if r['settings']['language']=='hi']
    if not choices:
        raise ValueError(f'Chapter {chapter}: no validated Groq cache')
    evidence = max(choices, key=lambda r:r['createdUtc'])
    source = ROOT/'authoring'/'gita'/f'chapter-{chapter}.mp3'
    if hashlib.sha256(source.read_bytes()).hexdigest() != evidence['settings']['sourceSha256']:
        raise ValueError('STT provenance mismatch')
    secondary = ROOT/'.gita-work'/f'chapter-{chapter}'/'transcription.json'
    fallback = []
    if secondary.exists():
        for segment in json.loads(secondary.read_text(encoding='utf-8')):
            fallback.extend(segment['words'])
    return evidence, fallback


def align_chapter(chapter, model, metadata, whisperx, ffmpeg, promote):
    verses, ref, lines = text_data(chapter)
    evidence, fallback = load_evidence(chapter)
    heard = evidence['result']['words']
    mappings = [match_characters(ref, heard), match_characters(ref, fallback)]
    slices = {}
    for path in (ROOT/'.gita-work'/f'chapter-{chapter}'/'groq-slices').glob('*.json'):
        if '.raw.' in path.name:continue
        saved=json.loads(path.read_text(encoding='utf-8'))
        if saved['sourceSha256']!=evidence['settings']['sourceSha256']:raise ValueError('Slice provenance mismatch')
        # Isolate repeated speaker labels to their own verse during matching.
        number=saved['verse'];local_ref='';local_lines=[]
        for line in lines:
            if line['verse']==number:
                offsets=[]
                for token in line['tokens']:
                    start=len(local_ref);local_ref+=normalize(token);offsets.append((start,len(local_ref)))
                local_lines.append({**line,'offsets':offsets})
        slices.setdefault(number,[]).append({'words':saved['result']['words'],
            'mapping':match_characters(local_ref,saved['result']['words']),'lines':local_lines})
    source = ROOT/'authoring'/'gita'/f'chapter-{chapter}.mp3'
    audio = whisperx.load_audio(str(source))
    old = json.loads((ROOT/'gita'/str(chapter)/'timings.json').read_text(encoding='utf-8'))
    if old['sourceSha256']!=evidence['settings']['sourceSha256']:
        raise ValueError('Prior acoustic cues refer to a different source')
    override_path=ROOT/'authoring'/'scripts'/f'gita-alignment-windows-chapter-{chapter}.json'
    overrides=json.loads(override_path.read_text(encoding='utf-8')) if override_path.exists() else {}
    candidate = ROOT/'.gita-work'/f'chapter-{chapter}'/'groq-repair'
    candidate.mkdir(parents=True, exist_ok=True)
    identity = hashlib.sha256(json.dumps({'version':VERSION, 'algorithmSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'evidence':evidence,
        'text':verses,'fallback':fallback,'slices':slices,'overrides':overrides,'priorTimings':old,'model':metadata['dictionary']},sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    cache = candidate/f'aligned-{identity}.json'
    line_cache=candidate/'lines'
    line_cache.mkdir(exist_ok=True)
    def decision_key(decision):
        return hashlib.sha256(json.dumps({'version':VERSION,'source':evidence['settings']['sourceSha256'],
            'model':'theainerd/Wav2Vec2-large-xlsr-hindi','decision':decision},sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    # Reuse only line inputs that match exactly, including their canonical
    # tokens and measured bounds; changed slices invalidate affected lines.
    for previous_cache in candidate.glob('aligned-*.json'):
        saved=json.loads(previous_cache.read_text(encoding='utf-8'))
        cursors={}
        for decision in saved['decisions']:
            number=decision['verse'];cursor=cursors.get(number,0)
            length=sum(len(group['tokens'])for group in decision['groups'])
            words=saved['aligned'][number-1][cursor:cursor+length]
            cursors[number]=cursor+length
            target=line_cache/(decision_key(decision)+'.json')
            if not target.exists():target.write_text(json.dumps(words,ensure_ascii=False),encoding='utf-8')
    if cache.exists():
        saved = json.loads(cache.read_text(encoding='utf-8'))
        aligned, decisions = saved['aligned'], saved['decisions']
    else:
        aligned = [[] for _ in verses]
        decisions = []
        for line in lines:
            primary = line_support(line,mappings[0],heard)
            secondary = line_support(line,mappings[1],fallback)
            support, observed, provider = primary, heard, 'groq'
            if primary['coverage']<.65 and secondary['coverage']>primary['coverage']:
                support, observed, provider = secondary, fallback, 'local-asr'
            if line['verse']in slices:
                choices=[]
                for slice in slices[line['verse']]:
                    local_line=next(l for l in slice['lines']if l['tokens']==line['tokens'])
                    recovered=line_support(local_line,slice['mapping'],slice['words'])
                    choices.append((recovered['coverage'],recovered,slice['words']))
                _,recovered,recovered_words=max(choices,key=lambda choice:choice[0])
                if recovered['coverage']>=.6 or recovered['coverage']>=support['coverage'] or provider=='local-asr':
                    support,observed,provider=recovered,recovered_words,'groq-slice'
            if support['coverage']<.45:
                # Insufficient evidence must remain an explicit repair blocker.
                raise ValueError(f"Chapter {chapter}.{line['verse']}: line lacks usable STT anchors: {' '.join(line['tokens'])}")
            descriptors=[]
            for group in groups_for(line,support):
                ids=sorted(group['ids']);tokens=[line['tokens'][i]for i in group['tokens']]
                if not ids:raise ValueError('Unanchored acoustic group')
                start=observed[ids[0]]['start'];end=max(observed[i]['end']for i in ids)
                recognition=''.join(normalize(observed[i]['word'])for i in ids)
                canonical=''.join(normalize(t)for t in tokens)
                exact=measured_match(tokens,recognition,provider,start,end)
                descriptors.append({'tokens':tokens,'sourceStart':start,'sourceEnd':end,
                    'method':'groq-word'if exact else provider+'-constrained-acoustic'})
            decision={'verse':line['verse'],'line':' '.join(line['tokens']),'provider':provider,
                      'coverage':round(support['coverage'],3),'groups':descriptors}
            saved_line=line_cache/(decision_key(decision)+'.json')
            if saved_line.exists():
                aligned[line['verse']-1].extend(json.loads(saved_line.read_text(encoding='utf-8')))
                decisions.append(decision)
                continue
            line_words, methods = [], []
            for group in groups_for(line,support):
                ids = sorted(group['ids'])
                tokens = [line['tokens'][i] for i in group['tokens']]
                if not ids:
                    raise ValueError('Unanchored acoustic group')
                start = observed[ids[0]]['start']
                end = max(observed[i]['end'] for i in ids)
                recognition = ''.join(normalize(observed[i]['word']) for i in ids)
                canonical = ''.join(normalize(token) for token in tokens)
                exact = measured_match(tokens,recognition,provider,start,end)
                if exact:
                    # No fabricated confidence: the acoustic score is absent for
                    # a measured STT interval. The manifest records its method.
                    words = [{'word':tokens[0],'start':start,'end':end,'timingMethod':'groq-word'}]
                else:
                    bounds = [{'start':max(0,start-.15),'end':min(len(audio)/16000,end+.15), 'text':' '.join(tokens)}]
                    result = whisperx.align(bounds,model,metadata,audio,'cpu',return_char_alignments=False,print_progress=False)
                    words = result['word_segments']
                    if [w['word'] for w in words]!=tokens or any('start'not in w or 'end'not in w for w in words):
                        raise ValueError(f"Chapter {chapter}.{line['verse']}: incomplete acoustic alignment")
                    for word in words:
                        word['timingMethod']=provider+'-constrained-acoustic'
                line_words.extend(words)
                methods.append({'tokens':tokens,'sourceStart':start,'sourceEnd':end,'method':words[0]['timingMethod']})
            aligned[line['verse']-1].extend(line_words)
            decisions.append(decision)
            saved_line.write_text(json.dumps(line_words,ensure_ascii=False),encoding='utf-8')
            print(f"Chapter {chapter}.{line['verse']}: {provider} anchored line",flush=True)
        cache.write_text(json.dumps({'aligned':aligned,'decisions':decisions},ensure_ascii=False,indent=2),encoding='utf-8')
    # A recognized compound can straddle an authored line break. Align its
    # canonical words once in the shared measured window, rather than letting
    # two independent line alignments compete for the same speech.
    shared_spans=[]
    grouped=[]
    cursors={}
    for decision in decisions:
        number=decision['verse'];cursor=cursors.get(number,0)
        for descriptor in decision['groups']:
            size=len(descriptor['tokens'])
            grouped.append({**descriptor,'verse':number,'words':aligned[number-1][cursor:cursor+size]})
            cursor+=size
        cursors[number]=cursor
    components=[]
    for group in grouped:
        if components and group['verse']==components[-1]['verse'] and group['sourceStart']<components[-1]['end']-.001:
            components[-1]['groups'].append(group)
            components[-1]['end']=max(components[-1]['end'],group['sourceEnd'])
        else:
            components.append({'verse':group['verse'],'start':group['sourceStart'],'end':group['sourceEnd'],'groups':[group]})
    for component in components:
        if len(component['groups'])<2:continue
        targets=[w for group in component['groups']for w in group['words']]
        bounds=[{'start':max(0,component['start']-.15),'end':min(len(audio)/16000,component['end']+.15),
                 'text':' '.join(w['word']for w in targets)}]
        key=hashlib.sha256(json.dumps({'source':evidence['settings']['sourceSha256'],'bounds':bounds,
                                     'model':'theainerd/Wav2Vec2-large-xlsr-hindi'},sort_keys=True,ensure_ascii=False).encode()).hexdigest()
        cached=candidate/('shared-'+key+'.json')
        if cached.exists():result=json.loads(cached.read_text(encoding='utf-8'))
        else:
            result=whisperx.align(bounds,model,metadata,audio,'cpu',return_char_alignments=False,print_progress=False)['word_segments']
            cached.write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
        if [w['word']for w in result]!=[w['word']for w in targets]or any('start'not in w or 'end'not in w for w in result):
            raise ValueError('Incomplete alignment of a shared STT span')
        for target,revised in zip(targets,result):
            target.update(start=revised['start'],end=revised['end'],score=revised.get('score',0),
                          timingMethod='shared-stt-span-acoustic')
        shared_spans.append({'bounds':bounds,'words':result})
    preserved=[]
    for number, established in overrides.get('_cueOverrides',{}).items():
        index=int(number)-1
        if [w['word']for w in established]!=[w['word']for w in aligned[index]]:
            raise ValueError('Established source-supported cue token mismatch')
        for target,measured,prior in zip(aligned[index],established,old['verses'][index]['words']):
            target.update(start=measured['start'],end=measured['end'],score=prior.get('score',0),
                          timingMethod='preserved-source-supported')
        preserved.append(int(number))
    for number, endpoint in overrides.get('_lastCueEndOverrides',{}).items():
        word=aligned[int(number)-1][-1]
        if endpoint<=word['start'] or endpoint>len(audio)/16000:
            raise ValueError('Invalid source-supported final cue endpoint')
        word.update(end=float(endpoint),timingMethod='source-supported-endpoint')
        word.pop('score',None)
    # When independent provider/acoustic groups dispute a boundary, acoustically
    # align the adjacent canonical pair together. Never split at an average
    # merely to make the validation pass.
    flat=[word for verse in aligned for word in verse]
    reconciliations=[]
    rejected_reconciliations=[]
    for _ in range(3):
        disputed=[(left,right)for left,right in zip(flat,flat[1:])if left['end']>right['start']+.001]
        if not disputed:break
        for left,right in disputed:
            bounds=[{'start':max(0,min(left['start'],right['start'])-.08),
                     'end':min(len(audio)/16000,max(left['end'],right['end'])+.08),
                     'text':left['word']+' '+right['word']}]
            result=whisperx.align(bounds,model,metadata,audio,'cpu',return_char_alignments=False,print_progress=False)['word_segments']
            issues=reconciliation_issues([left,right],result)
            if issues:
                rejected_reconciliations.append({'before':[dict(left),dict(right)],'after':result,'issues':issues})
                continue
            if len(result)==2 and all('start'in w and 'end'in w for w in result):
                reconciliations.append({'before':[dict(left),dict(right)],'after':result})
                for target,revised in zip([left,right],result):
                    target.update(start=revised['start'],end=revised['end'],score=revised.get('score',0),
                                  timingMethod='joint-boundary-acoustic')
    # Do not truncate measured spoken intervals to make structural checks pass.
    errors=[]
    for _ in range(2):
        disputed=[i for i,(left,right)in enumerate(zip(flat,flat[1:]))if left['end']>right['start']+.05]
        if not disputed:break
        for index in disputed:
            cluster=flat[max(0,index-1):min(len(flat),index+3)]
            bounds=[{'start':max(0,min(w['start']for w in cluster)-.08),
                     'end':min(len(audio)/16000,max(w['end']for w in cluster)+.08),
                     'text':' '.join(w['word']for w in cluster)}]
            result=whisperx.align(bounds,model,metadata,audio,'cpu',return_char_alignments=False,print_progress=False)['word_segments']
            issues=reconciliation_issues(cluster,result)
            if issues:
                rejected_reconciliations.append({'before':[dict(w)for w in cluster],'after':result,'issues':issues})
                continue
            if len(result)==len(cluster)and all('start'in w and 'end'in w for w in result):
                reconciliations.append({'before':[dict(w)for w in cluster],'after':result})
                for target,revised in zip(cluster,result):
                    target.update(start=revised['start'],end=revised['end'],score=revised.get('score',0),
                                  timingMethod='joint-boundary-acoustic')
    # Narrow acoustic crops can collapse a short word that an earlier, wider
    # context aligned reliably. Retain that earlier measured cue only when it
    # fits the new STT window and both neighboring intervals. This never
    # expands an interval by interpolation or replaces a measured Groq word.
    supported_prior=[]
    bounds={};cursors={}
    for decision in decisions:
        number=decision['verse'];cursor=cursors.get(number,0)
        for group in decision['groups']:
            for _ in group['tokens']:
                bounds[number,cursor]=(group['sourceStart']-.15,group['sourceEnd']+.15)
                cursor+=1
        cursors[number]=cursor
    flat_index=0
    for number,(words,prior_verse)in enumerate(zip(aligned,old['verses']),1):
        for index,(word,prior)in enumerate(zip(words,prior_verse['words'])):
            if prior['text']!=word['word']:raise ValueError('Prior cue token mismatch')
            start=prior_verse['sourceStart']+prior['start'];end=prior_verse['sourceStart']+prior['end']
            lo,hi=bounds[number,index];score=prior.get('score',0)
            eligible=word['timingMethod'].endswith('acoustic') and \
                (word['end']-word['start']<.12 or word.get('score',1)<.5) and score>=.5 and \
                (score>word.get('score',1)+.1 or end-start>=.12) and start>=lo and end<=hi and \
                (not flat_index or flat[flat_index-1]['end']<=start+.001) and \
                (flat_index==len(flat)-1 or end<=flat[flat_index+1]['start']+.001)
            if eligible:
                supported_prior.append({'verse':number,'word':index+1,'before':dict(word),
                                        'sourceStart':start,'sourceEnd':end,'score':score,'sttWindow':[lo,hi]})
                word.update(start=start,end=end,score=score,timingMethod='prior-acoustic-in-stt-window')
            flat_index+=1
    for i, words in enumerate(aligned):
        for left,right in zip(words,words[1:]):
            if left['end']>right['start']+.05:
                errors.append({'verse':i+1,'type':'overlap','left':left,'right':right})
        if i and aligned[i-1][-1]['end']>words[0]['start']:
            errors.append({'verse':i+1,'type':'verse-overlap'})
    report={'chapter':chapter,'alignmentFingerprint':identity,'decisions':decisions,'errors':errors,
            'quarantinedProviderWords':evidence.get('quarantinedWords',[]),'reconciliations':reconciliations,
            'rejectedReconciliations':rejected_reconciliations,
            'preservedSourceSupportedVerses':preserved,'sharedSttSpans':shared_spans,
            'sourceSupportedEndingOverrides':overrides.get('_lastCueEndOverrides',{}),
            'retainedPriorAcousticCues':supported_prior}
    (candidate/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    if errors:
        raise ValueError(f'Chapter {chapter}: {len(errors)} disputed intervals; see candidate report, no promotion')
    boundaries=[]
    import numpy as np
    for left,right in zip(aligned,aligned[1:]):
        lo,hi=left[-1]['end'],right[0]['start']
        # Pick a measured low-energy 30 ms region between the two spoken cues.
        centers=np.arange(lo+.025,hi-.025,.01)
        if len(centers):
            rms=[np.mean(audio[int((c-.015)*16000):int((c+.015)*16000)]**2) for c in centers]
            boundary=float(centers[int(np.argmin(rms))])
        else:
            boundary=(lo+hi)/2
        boundaries.append(boundary)
    output={'version':1,'chapter':chapter,'sourceSha256':evidence['settings']['sourceSha256'],
        'method':'Groq Whisper Large V3 measured words with canonical Sanskrit acoustic alignment; raw evidence and decisions cached locally.',
        'reviewStatus':'machine-aligned','alignmentFingerprint':identity,'verses':[]}
    (candidate/'audio').mkdir(exist_ok=True)
    prior_manifest=json.loads((candidate/'timings.json').read_text(encoding='utf-8'))if(candidate/'timings.json').exists()else{}
    for index,words in enumerate(aligned):
        start=max(0,words[0]['start']-.18) if not index else boundaries[index-1]
        end=min(len(audio)/16000,words[-1]['end']+.28) if index==len(aligned)-1 else boundaries[index]
        if index==len(aligned)-1:
            explicit_end=overrides.get('_clipEndOverrides',{}).get(str(index+1))
            if explicit_end is not None:
                end=float(explicit_end)
            else:
                # Use the observed start of the following colophon when it is
                # separately recognized, rather than adding voice from it.
                last_observed_end=[g['sourceEnd']for d in decisions if d['verse']==index+1 for g in d['groups']][-1]
                # A colophon onset that overlaps the recognized final word is
                # contradictory evidence and cannot justify shortening it.
                after=[w for w in heard if w['start']>=max(words[-1]['end'],last_observed_end) and
                       normalize(w['word']).startswith(('ओम','ओम्','ॐ'))]
                if after and min(w['start']for w in after)<end:
                    end=min(w['start']for w in after)-.02
            if end<words[-1]['end']:
                raise ValueError('Final cut conflicts with the aligned last syllable')
        expected=[t for t in verses[index]['sanskrit'].split() if re.search('[\u0900-\u0963]',t)]
        if [w['word']for w in words]!=expected or not 4<end-start<45:
            raise ValueError(f'Invalid candidate verse {chapter}.{index+1}')
        path=f'audio/{index+1:02}.mp3'
        prior=prior_manifest.get('verses',[])[index]if len(prior_manifest.get('verses',[]))>index else {}
        unchanged=prior_manifest.get('sourceSha256')==output['sourceSha256'] and (candidate/path).exists() and \
            abs(prior.get('sourceStart',-1)-start)<.0005 and abs(prior.get('sourceEnd',-1)-end)<.0005
        if not unchanged:
            subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-ss',str(start),'-i',str(source),
                '-t',str(end-start),'-vn','-map_metadata','-1','-codec:a','libmp3lame','-b:a','96k',str(candidate/path)],check=True)
        cues=[]
        for w in words:
            cue={'text':w['word'],'start':round(w['start']-start,3),'end':round(w['end']-start,3),'timingMethod':w['timingMethod']}
            if 'score'in w:cue['score']=w['score']
            cues.append(cue)
        output['verses'].append({'verse':index+1,'audio':path,'sourceStart':round(start,3),'sourceEnd':round(end,3),
                                'highlightMode':'word',
                                'duration':round(end-start,3),'words':cues})
    payload=json.dumps(output,ensure_ascii=False,indent=2)
    (candidate/'timings.json').write_text(payload+'\n',encoding='utf-8')
    (candidate/'timings.js').write_text(f'window.GITA_CHAPTER_{chapter}_TIMINGS = '+payload+';\n',encoding='utf-8')
    if promote:
        for item in (candidate/'audio').glob('*.mp3'):
            shutil.copy2(item,ROOT/'gita'/str(chapter)/'audio'/item.name)
        for name in ['timings.json','timings.js']:
            shutil.copy2(candidate/name,ROOT/'gita'/str(chapter)/name)
    print(f'Chapter {chapter}: {len(verses)} candidate clips {"promoted"if promote else "staged"}',flush=True)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--chapters',nargs='+',type=int,choices=range(1,19),default=[6])
    p.add_argument('--ffmpeg',required=True)
    p.add_argument('--promote',action='store_true')
    args=p.parse_args()
    os.environ['HF_HUB_OFFLINE']='1'
    os.environ['TRANSFORMERS_OFFLINE']='1'
    import torch,whisperx
    torch.set_num_threads(6)
    model,metadata=whisperx.load_align_model('hi','cpu',model_cache_only=True)
    failures=[]
    for chapter in args.chapters:
        try:align_chapter(chapter,model,metadata,whisperx,args.ffmpeg,args.promote)
        except ValueError as error:
            print(f'REVIEW REQUIRED: {error}',flush=True)
            failures.append(str(error))
    if failures:raise SystemExit(1)


if __name__=='__main__':main()
