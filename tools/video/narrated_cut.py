import pathlib,json,subprocess,re,textwrap,os
root=pathlib.Path('out/video');root.mkdir(exist_ok=True)
blocks=json.loads(pathlib.Path('out/voice/blocks.json').read_text());entries=[];offset=0
font=os.environ.get('VIDEO_FONT', '/System/Library/Fonts/Supplemental/Arial.ttf')
def run(args):subprocess.run([os.environ.get('FFMPEG', 'ffmpeg'),'-hide_banner','-loglevel','error','-y']+args,check=True)
def tc(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
for i,b in enumerate(blocks):
 # A short breath between sentences; retain the full visual sequence.
 dur=round(b['voiceDuration']/0.90+0.70,3)
 speed=(b['end']-b['start'])/dur
 source=['-ss',str(b['start']),'-t',str(b['end']-b['start']),'-i','signsprout-demo-share.mp4']
 visual=f'setpts=PTS/{speed},fps=30,scale=1920:1080,drawbox=x=0:y=830:w=iw:h=250:color=0x101b20:t=fill'
 if i==12:
  source=['-f','lavfi','-i','color=c=0x101b20:s=1920x1080:r=30']
  visual=f"drawtext=fontfile={font}:text='Signsprout':fontsize=100:fontcolor=0xfff8ee:x=(w-tw)/2:y=345,drawtext=fontfile={font}:text='Your first signs. Your own two hands.':fontsize=42:fontcolor=0xfff8ee:x=(w-tw)/2:y=485,drawtext=fontfile={font}:text='signsprout.web.app':fontsize=48:fontcolor=0x7ff2e1:x=(w-tw)/2:y=585,drawtext=fontfile={font}:text='Created by Shivam Gupta':fontsize=27:fontcolor=0xa9b8bf:x=(w-tw)/2:y=680"
 elif i>=2:
  label='QUEST 3 EMULATOR  |  SIMULATED LEARNER' if i<9 else 'BROWSER CAPTURE  |  SAMPLE PROGRESS'
  visual+=f",drawtext=fontfile={font}:text='{label}':fontsize=22:fontcolor=0x7ff2e1:x=(w-tw)/2:y=856"
 if i==9:
  visual+=f",drawbox=x=65:y=64:w=940:h=127:color=0x101b20:t=fill,drawtext=fontfile={font}:text='Built-in coach. A plan for real life.':fontsize=35:fontcolor=white:x=102:y=106"
 audio='[1:a]atempo=0.90,adelay=200,apad,atrim=duration='+str(dur)+'[a]'
 if True:  # Rebuild every segment so narration changes cannot leave stale footage.
  run(source+['-i',f'out/voice/{i:02}.wav','-filter_complex',f'[0:v]{visual}[v];{audio}','-map','[v]','-map','[a]','-t',str(dur),'-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-ar','48000',str(root/f'part-{i:02}.mp4')])
 words=b['text'].split();chunks=[];chunk=[]
 for word in words:
  chunk.append(word)
  if len(' '.join(chunk))>62 or word.endswith(('.', '?', '!')):
   chunks.append(' '.join(chunk));chunk=[]
 if chunk:chunks.append(' '.join(chunk))
 total=sum(len(x) for x in chunks);cursor=offset+0.2
 for chunk in chunks:
  length=(dur-.7)*len(chunk)/total
  entries.append(f'{len(entries)+1}\n{tc(cursor)} --> {tc(cursor+length)}\n'+textwrap.fill(chunk,46)+'\n')
  cursor+=length
 b['finalStart']=offset;b['finalDuration']=dur;offset+=dur
 print('Rendered',i,'total',round(offset,1),flush=True)
(root/'concat.txt').write_text('\n'.join(f"file 'part-{i:02}.mp4'" for i in range(len(blocks))))
(root/'signsprout-final.srt').write_text('\n'.join(entries));(root/'timeline.json').write_text(json.dumps(blocks,indent=2))
run(['-f','concat','-safe','0','-i',str(root/'concat.txt'),'-c','copy',str(root/'voice-cut.mp4')])
# Keep a quiet bed from the source video under the narrator.
run(['-i',str(root/'voice-cut.mp4'),'-i','signsprout-demo-share.mp4','-filter_complex',f"[0:v]subtitles={root}/signsprout-final.srt:force_style='FontName=Arial,FontSize=14,PrimaryColour=&H00FFFFFF,Outline=0,Shadow=0,Alignment=2,MarginV=14'[v];[0:a]loudnorm=I=-16:TP=-1.5:LRA=7[vo];[1:a]volume=0.18[bed];[vo][bed]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]",'-map','[v]','-map','[a]','-c:v','libx264','-preset','fast','-crf','20','-c:a','aac','-b:a','192k','-movflags','+faststart',str(root/'signsprout-final.mp4')])
print('Final duration',offset)
