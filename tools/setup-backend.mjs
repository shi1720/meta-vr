#!/usr/bin/env node
/**
 * One-command Supabase setup for Signsprout.
 *
 * Creates (or reuses) a Supabase project, applies the database schema,
 * deploys the three edge functions, configures sign-in redirects, stores the
 * optional Claude key for the coach, and writes the public keys the two web
 * apps need at build time.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... \
 *   SITE_URL=https://signsprout.surge.sh \
 *   [SUPABASE_PROJECT_REF=abcd1234]   # reuse an existing project
 *   [ANTHROPIC_API_KEY=sk-ant-...]    # optional: the coach falls back to rules without it
 *   node tools/setup-backend.mjs
 *
 * Only public values (project URL and anon/publishable key) are written to
 * disk, in apps/web/.env.production.local and apps/xr/.env.production.local.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.supabase.com/v1';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SITE_URL = (process.env.SITE_URL ?? '').replace(/\/$/, '');
let ref = process.env.SUPABASE_PROJECT_REF;

if (!TOKEN) {
  console.error('Set SUPABASE_ACCESS_TOKEN (supabase.com → Account → Access Tokens).');
  process.exit(1);
}
if (!SITE_URL) {
  console.error('Set SITE_URL to where the web app is hosted, e.g. https://signsprout.surge.sh');
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Project -------------------------------------------------------------------
if (!ref) {
  const orgs = await api('GET', '/organizations');
  if (!orgs.length) throw new Error('No Supabase organization found for this token.');
  const dbPass = randomBytes(18).toString('base64url');
  const project = await api('POST', '/projects', {
    name: 'signsprout',
    organization_id: orgs[0].id,
    db_pass: dbPass,
    region: process.env.SUPABASE_REGION ?? 'us-east-1',
  });
  ref = project.id ?? project.ref;
  console.log(`Created project ${ref}. Database password (keep it somewhere safe): ${dbPass}`);
}
process.stdout.write(`Waiting for project ${ref} to be ready`);
for (let i = 0; i < 90; i++) {
  const p = await api('GET', `/projects/${ref}`);
  if (p.status === 'ACTIVE_HEALTHY') break;
  process.stdout.write('.');
  await sleep(5000);
}
console.log(' ready.');

// 2. Schema --------------------------------------------------------------------
const migrations = readdirSync(join(ROOT, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
for (const file of migrations) {
  await api('POST', `/projects/${ref}/database/query`, { query: readFileSync(join(ROOT, 'supabase/migrations', file), 'utf8') });
  console.log(`Applied ${file}`);
}

// 3. Edge functions (Supabase CLI, server-side bundling: no Docker needed) ------
const env = { ...process.env, SUPABASE_ACCESS_TOKEN: TOKEN };
for (const fn of ['pair', 'share', 'coach']) {
  execFileSync('npx', ['--yes', 'supabase@latest', 'functions', 'deploy', fn, '--project-ref', ref, '--use-api', '--no-verify-jwt'], {
    cwd: ROOT,
    env,
    stdio: 'inherit',
  });
}

// 4. Secrets -------------------------------------------------------------------
if (process.env.ANTHROPIC_API_KEY) {
  await api('POST', `/projects/${ref}/secrets`, [{ name: 'ANTHROPIC_API_KEY', value: process.env.ANTHROPIC_API_KEY }]);
  console.log('Stored ANTHROPIC_API_KEY for the coach.');
}

// 5. Auth redirects (magic links from the companion site) -----------------------
await api('PATCH', `/projects/${ref}/config/auth`, {
  site_url: SITE_URL,
  uri_allow_list: [`${SITE_URL}/**`, 'http://localhost:5174/**'].join(','),
});
console.log(`Auth redirects allowed for ${SITE_URL}`);

// 6. Public keys for the web builds ----------------------------------------------
const keys = await api('GET', `/projects/${ref}/api-keys`);
const anon = keys.find((k) => k.name === 'anon' || k.type === 'publishable')?.api_key;
if (!anon) throw new Error('Could not find the anon/publishable key.');
const url = `https://${ref}.supabase.co`;
const lines = [`VITE_SUPABASE_URL=${url}`, `VITE_SUPABASE_ANON_KEY=${anon}`, `VITE_WEB_URL=${SITE_URL}/#/pair`, ''].join('\n');
writeFileSync(join(ROOT, 'apps/web/.env.production.local'), lines);
writeFileSync(join(ROOT, 'apps/xr/.env.production.local'), lines);
console.log(`\nDone. ${url} is ready. Rebuild with \`npm run build\` and redeploy.`);
