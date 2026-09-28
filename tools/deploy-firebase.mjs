#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('..',import.meta.url));
const run=(cmd,args)=>execFileSync(cmd,args,{cwd,stdio:'inherit'});
run('npm',['run','typecheck']);
run('npm',['test']);
run('npm',['run','build:site']);
run('npx',['--yes','firebase-tools','deploy','--only','hosting:signsprout','--non-interactive']);
console.log('Live: https://signsprout.web.app');
