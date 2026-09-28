import os,subprocess,json,urllib.request,base64,pathlib,re,concurrent.futures
root=pathlib.Path('out/voice');root.mkdir(exist_ok=True)
script=pathlib.Path('docs/submission/VIDEO_SCRIPT.md').read_text();blocks=[]
for line in script.splitlines():
 if re.match(r'\| [012]:',line):
  c=[v.strip() for v in line.split('|')];start,end=c[1].split('–')
  sec=lambda x:int(x.split(':')[0])*60+int(x.split(':')[1])
  blocks.append({'start':sec(start),'end':sec(end),'text':c[3]})
token=subprocess.check_output(['gcloud','auth','print-access-token'],text=True).strip()
def gen(item):
 i,b=item;p=root/f'{i:02}.wav'
 if not p.exists():
  body={'input':{'text':b['text']},'voice':{'languageCode':'en-US','name':'en-US-Chirp3-HD-Charon'},'audioConfig':{'audioEncoding':'LINEAR16'}}
  req=urllib.request.Request('https://texttospeech.googleapis.com/v1/text:synthesize',data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','x-goog-user-project':os.environ['GOOGLE_CLOUD_PROJECT']})
  r=json.load(urllib.request.urlopen(req));p.write_bytes(base64.b64decode(r['audioContent']))
 d=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(p)]))
 b['voiceDuration']=d;print(i,round(d,2),'original',b['end']-b['start'],flush=True);return b
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:result=list(pool.map(gen,enumerate(blocks)))
(root/'blocks.json').write_text(json.dumps(result,indent=2))
