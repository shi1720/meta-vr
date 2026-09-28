#!/usr/bin/env node
/**
 * Builds the deployable site into ./dist:
 *   /        companion web (landing, dictionary, pairing, dashboard)
 *   /app/    the headset app (open this in Meta Quest Browser)
 */
import { execSync } from 'node:child_process';
import { copyFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve('dist');
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true });
run(`npm run build --workspace apps/web -- --outDir "${out}" --emptyOutDir`);
run(`npm run build --workspace apps/xr -- --outDir "${out}/app" --emptyOutDir`);
// Static hosts that support it (e.g. Surge) serve this for unknown paths.
copyFileSync(`${out}/index.html`, `${out}/200.html`);
writeFileSync(`${out}/robots.txt`, 'User-agent: *\nAllow: /\n');
console.log('\nSite ready in ./dist (web at /, headset app at /app/).');
