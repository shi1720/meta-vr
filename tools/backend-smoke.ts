import {createClient} from '@supabase/supabase-js';
import {createProgress,recordAttempt} from '../packages/signkit/src/index.ts';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const url=process.env.SUPABASE_URL!,anon=process.env.SUPABASE_ANON_KEY!,service=process.env.SUPABASE_SERVICE_ROLE_KEY!;
assert(url&&anon&&service,'Supply test credentials securely in environment variables.');
const admin=createClient(url,service,{auth:{persistSession:false}});
const client=()=>createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
const users:string[]=[];
const check=(error:any)=>{if(error)throw error;};
try{
 const a=client(),b=client();
 for(const sb of [a,b]){const email=`qa-${randomUUID()}@example.invalid`,password=randomUUID()+randomUUID();const r=await admin.auth.admin.createUser({email,password,email_confirm:true});check(r.error);users.push(r.data.user!.id);check((await sb.auth.signInWithPassword({email,password})).error);}
 let doc=createProgress(Date.now());doc=recordAttempt(doc,'hello',{quality:0.95,tries:1,withGhost:false},Date.now(),35);
 check((await a.from('progress').upsert({user_id:users[0],doc})).error);
 const isolated=await b.from('progress').select('*').eq('user_id',users[0]);check(isolated.error);assert.equal(isolated.data!.length,0);
 assert((await b.from('progress').upsert({user_id:users[0],doc})).error,'Other learner cannot write progress');
 const start=await a.functions.invoke('pair',{body:{action:'start'}});check(start.error);const {code,secret}=start.data;
 assert((await b.functions.invoke('pair',{body:{action:'poll',code,secret:'wrong'}})).error);
 check((await a.functions.invoke('pair',{body:{action:'approve',code}})).error);
 assert((await b.functions.invoke('pair',{body:{action:'approve',code}})).error,'Already approved code rejected');
 const polls=await Promise.all([a.functions.invoke('pair',{body:{action:'poll',code,secret}}),a.functions.invoke('pair',{body:{action:'poll',code,secret}})]);
 const tokens=polls.filter(r=>r.data?.token_hash);assert.equal(tokens.length,1,'One-time token released exactly once');
 const headset=client();check((await headset.auth.verifyOtp({token_hash:tokens[0].data.token_hash,type:'magiclink'})).error);
 assert.equal((await headset.auth.getUser()).data.user!.id,users[0]);
 const plan=await a.functions.invoke('coach',{body:{goal:'Bath time and bedtime words'}});check(plan.error);assert(plan.data.signIds.length>0);assert(['gemini','rules'].includes(plan.data.source));console.log('Coach provider:',plan.data.source);
 const synced=await headset.from('progress').select('doc').eq('user_id',users[0]).single();check(synced.error);assert.deepEqual(synced.data!.doc.focus,plan.data.signIds);assert(synced.data!.doc.cards.hello,'Coach preserves practice');
 const stale = { ...synced.data!.doc, focus: [], focusUpdatedAt: 0 };
 check((await headset.from('progress').update({doc:stale}).eq('user_id',users[0])).error);
 const protectedPlan=await headset.from('progress').select('doc').eq('user_id',users[0]).single();check(protectedPlan.error);assert.deepEqual(protectedPlan.data!.doc.focus,plan.data.signIds,'Stale headset sync must preserve queued plan');
 const sh=await a.from('shares').insert({user_id:users[0],label:'QA family'}).select('token').single();check(sh.error);
 const shareUrl=`${url}/functions/v1/share?token=${sh.data!.token}`;
 let res=await fetch(shareUrl);assert.equal(res.status,200);const summary=await res.json();assert(!JSON.stringify(summary).includes('@example.invalid'));
 check((await a.from('shares').update({revoked:true}).eq('token',sh.data!.token)).error);res=await fetch(shareUrl);assert.equal(res.status,404);
 console.log('PASS: real auth, profile, row isolation, pairing, concurrent one-time consume, catalog coach, queued plan, preserved progress, family sharing and revocation.');
}finally{for(const id of users)check((await admin.auth.admin.deleteUser(id)).error);console.log('Temporary test accounts removed.');}
