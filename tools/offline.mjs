import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
export function buildOffline(out) {
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir,e.name)) : [join(dir,e.name)]);
  const files = walk(out).filter(p=>!p.endsWith('/200.html'));
  const version = createHash('sha256');
  for (const path of files) version.update(readFileSync(path));
  const name = `signsprout-${version.digest('hex').slice(0,12)}`;
  const urls = files.map(p=>'./'+relative(out,p));
  writeFileSync(join(out,'sw.js'), `const CACHE=${JSON.stringify(name)};\nconst URLS=${JSON.stringify(urls)};
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c=>c.addAll(URLS))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('signsprout-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', e => {
 const url=new URL(e.request.url);
 if(e.request.method!=='GET'||url.origin!==self.location.origin)return;
 e.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  if(e.request.mode==='navigate'){
   try{return await fetch(e.request);}catch{
    const root=new URL('./',self.location).pathname;
    const route=url.pathname.startsWith(root+'app')?'./app/index.html':'./index.html';
    return (await cache.match(new URL(route,self.location)))||Response.error();
   }
  }
  return (await cache.match(e.request,{ignoreSearch:true}))||fetch(e.request);
 })());
});`);
  // Relative registration works at the domain root and on GitHub Pages.
  for(const [path,sw] of [['index.html','./sw.js'],['app/index.html','../sw.js']]){
    const file=join(out,path);
    writeFileSync(file,readFileSync(file,'utf8').replace('</body>', `<script>if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('${sw}').catch(()=>{}));</script></body>`));
  }
}
