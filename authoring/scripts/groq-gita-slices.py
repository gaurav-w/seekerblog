"""Recover omitted verses from bounded master slices; preserve absolute offsets."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import time

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('stt',Path(__file__).with_name('groq-gita-timings.py'))
stt=importlib.util.module_from_spec(spec);spec.loader.exec_module(stt)


def capture(chapter,verse,ffmpeg,key,language='hi',canonical_prompt=False):
    import requests
    source=ROOT/'authoring'/'gita'/f'chapter-{chapter}.mp3'
    digest=hashlib.sha256(source.read_bytes()).hexdigest()
    manifest=json.loads((ROOT/'gita'/str(chapter)/'timings.json').read_text(encoding='utf-8'))
    v=manifest['verses'][verse-1]
    start=max(0,v['sourceStart']-2)
    end=v['sourceEnd']+2
    directory=ROOT/'.gita-work'/f'chapter-{chapter}'/'groq-slices'
    directory.mkdir(parents=True,exist_ok=True)
    script=json.loads((ROOT/'gita'/str(chapter)/'data.js').read_text(encoding='utf-8').split('=',1)[1].strip().removesuffix(';'))[verse-1]['sanskrit']
    prompt=script if canonical_prompt else ''
    identity=hashlib.sha256(f'{digest}:{start}:{end}:{language}:{stt.MODEL}:{prompt}:slice-v1'.encode()).hexdigest()
    cache=directory/f'{verse:02}-{identity}.json'
    if cache.exists():return
    transport=directory/f'{identity}.flac'
    subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-ss',str(start),'-i',str(source),
        '-t',str(end-start),'-vn','-map_metadata','-1','-ac','1','-ar','16000','-sample_fmt','s16','-c:a','flac',str(transport)],check=True)
    for attempt in range(4):
        with transport.open('rb')as audio:
            response=requests.post('https://api.groq.com/openai/v1/audio/transcriptions',
                headers={'Authorization':f'Bearer {key}'},files={'file':(transport.name,audio,'audio/flac')},
                data=[('model',stt.MODEL),('language',language),('prompt',prompt),('response_format','verbose_json'),
                      ('timestamp_granularities[]','word'),('timestamp_granularities[]','segment'),('temperature','0')],timeout=(30,120))
        if response.status_code!=429:break
        delay=min(60,max(.5,float(response.headers.get('retry-after','5'))))
        time.sleep(delay)
    if not response.ok:raise RuntimeError(f'Slice STT HTTP {response.status_code}')
    raw=response.json()
    payload={'chapter':chapter,'verse':verse,'sourceSha256':digest,'sourceStart':start,'sourceEnd':end,'model':stt.MODEL,'language':language,'prompt':prompt,'raw':raw}
    (cache.with_suffix('.raw.json')).write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
    result,rejected=stt.usable_response(raw,end-start)
    result={**result,'words':[{**w,'start':w['start']+start,'end':w['end']+start}for w in result['words']]}
    payload.update(result=result,quarantinedWords=rejected)
    cache.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Cached slice {chapter}.{verse}: {len(result["words"])} words',flush=True)


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--targets',nargs='+',required=True,help='Chapter.verse identifiers')
    p.add_argument('--ffmpeg',required=True)
    p.add_argument('--secrets-file',required=True)
    p.add_argument('--language',choices=['hi','sa'],default='hi')
    p.add_argument('--canonical-prompt',action='store_true',help='Provide canonical spellings/spacing as STT context, not as replacement output')
    args=p.parse_args()
    targets=[tuple(map(int,t.split('.')))for t in args.targets]
    if any(not 1<=c<=18 or v<1 for c,v in targets):p.error('Invalid verse target')
    key=stt.api_key(args.secrets_file)
    for chapter,verse in targets:capture(chapter,verse,args.ffmpeg,key,args.language,args.canonical_prompt)
