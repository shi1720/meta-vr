#!/usr/bin/env node
/**
 * Builds the deployable site into ./dist:
 *   /        companion web (landing, dictionary, pairing, dashboard)
 *   /app/    the headset app (open this in Meta Quest Browser)
 */
import { execSync } from 'node:child_process';
import { cpSync, rmSync, writeFileSync } from 'node:fs';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
run('npm run build --workspace apps/xr');
run('npm run build --workspace apps/web');
rmSync('dist', { recursive: true, force: true });
cpSync('apps/web/dist', 'dist', { recursive: true });
cpSync('apps/xr/dist', 'dist/app', { recursive: true });
// Static hosts that support it (e.g. Surge) serve this for unknown paths.
cpSync('dist/index.html', 'dist/200.html');
writeFileSync('dist/robots.txt', 'User-agent: *\nAllow: /\n');
console.log('\nSite ready in ./dist (web at /, headset app at /app/).');
