import os, json, subprocess
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from scipy.signal import butter, sosfilt

os.environ['HF_HUB_OFFLINE']='1'
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'gita/5/timings.json').exists())
OUT=Path(__file__).resolve().parent
master=ROOT/'authoring/gita/chapter-5.mp3'
t=json.loads((ROOT/'gita/5/timings.json').read_text(encoding='utf-8'))
def decode(path):
    data=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-ac','1','-ar','16000','-f','f32le','pipe:1'])
    return np.frombuffer(data,dtype='<f4')
audio=decode(master)
filtered=sosfilt(butter(4,[300,3000],btype='bandpass',fs=16000,output='sos'),audio)
frame=160
def rms_db(values):
    return round(float(20*np.log10(np.sqrt(np.mean(values*values))+1e-12)),2)
stats=[]
for v in t['verses']:
    clip=decode(ROOT/'gita/5'/v['audio'])
    stats.append({'verse':v['verse'],'decodedDuration':len(clip)/16000,
                  'manifestDuration':v['duration'],'last100msDbFS':rms_db(clip[-1600:]),
                  'last500msDbFS':rms_db(clip[-8000:]),
                  'cueTail':round(v['duration']-v['words'][-1]['end'],3),
                  'lead':v['words'][0]['start']})
regions=[(260,283,'5.16 to 5.17: boundary based on a low-confidence next cue'),
         (405,421.8,'5.26: marker disappears 3.343-7.944 seconds into clip'),
         (465,470,'5.29: cut at 467.624s; source continues')]
fig,axes=plt.subplots(3,1,figsize=(13,8),layout='constrained')
for ax,(start,end,title) in zip(axes,regions):
    lo=int(start*16000); hi=int(end*16000)
    x=filtered[lo:hi]; n=len(x)//frame
    energy=np.sqrt(np.mean(x[:n*frame].reshape(n,frame)**2,axis=1))
    times=start+np.arange(n)*.01
    ax.plot(times,20*np.log10(energy+1e-8),color='#185a8d',linewidth=.7,label='300-3000 Hz RMS (includes voice and other sound)')
    for v in t['verses']:
        if v['sourceStart']<end and v['sourceEnd']>start:
            for w in v['words']:
                a=v['sourceStart']+w['start'];b=v['sourceStart']+w['end']
                if b>=start and a<=end:ax.axvspan(a,b,color='#dca633',alpha=.18)
            if start<v['sourceEnd']<end:
                ax.axvline(v['sourceEnd'],color='#bc3131',linewidth=1.5)
                ax.text(v['sourceEnd']+.03,-20,f"clip {v['verse']} end",color='#bc3131',fontsize=8,rotation=90)
    ax.set(title=title,xlim=(start,end),ylim=(-75,-8),ylabel='dBFS',xlabel='Master recording time (seconds)')
    ax.grid(alpha=.15)
axes[0].legend(fontsize=8,loc='lower left')
fig.savefig(OUT/'waveforms.png',dpi=150)
(OUT/'review-audio-metrics.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
print('Audio decoded for all 29 clips; waveform evidence saved.',flush=True)

from faster_whisper import WhisperModel
model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=6)
fresh=[]
for start,end,title in [(260,283,'master-16-17'),(405,422,'master-26'),(461,471,'master-29-ending')]:
    segments,_=model.transcribe(audio[int(start*16000):int(end*16000)],language='hi',beam_size=5,word_timestamps=True,condition_on_previous_text=False,no_speech_threshold=None,vad_filter=False)
    rows=[{'start':s.start+start,'end':s.end+start,'text':s.text,
           'words':[{'text':w.word,'start':w.start+start,'end':w.end+start} for w in s.words]} for s in segments]
    fresh.append({'region':title,'start':start,'end':end,'segments':rows})
    (OUT/'review-fresh-transcription.json').write_text(json.dumps(fresh,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(fresh[-1]),flush=True)
