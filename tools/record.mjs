#!/usr/bin/env node
/**
 * Deterministic capture of Signsprout running in headless Chromium.
 *
 * Installs a paused Playwright fake clock before the page loads, then advances
 * time one video frame at a time and screenshots each frame. This decouples the
 * app's timeline from how slowly software rendering runs, which gives smooth
 * footage and a reproducible end-to-end test.
 *
 * Usage:
 *   node tools/record.mjs --url "https://localhost:8081/?demo&fresh" --seconds 90 --fps 30 --out out/frames [--every 1] [--until summary]
 *   node tools/record.mjs --url ... --video out/clip.mp4 [--stills 15]   # encode with ffmpeg; also keep every 15th frame as a PNG
 *   node tools/record.mjs --url ... --at 3 --eval "window.__app..."           # run a snippet in the page at t = 3 s
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? true : arr[i + 1]]] : acc), []),
);
const url = args.url ?? 'https://localhost:8081/?demo&fresh';
const seconds = +(args.seconds ?? 60);
const fps = +(args.fps ?? 30);
const every = +(args.every ?? 1);
const out = args.out ?? 'out/frames';
const width = +(args.width ?? 1920);
const height = +(args.height ?? 1080);
const until = args.until;
const video = typeof args.video === 'string' ? args.video : null;
const stills = +(args.stills ?? 0);
const shots = !args['no-shots'] && !video;
mkdirSync(out, { recursive: true });
let encoder = null;
if (video) {
  mkdirSync(dirname(video), { recursive: true });
  encoder = spawn(
    process.env.FFMPEG ?? 'ffmpeg',
    ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', video],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--ignore-certificate-errors', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width, height }, ignoreHTTPSErrors: true, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
// Pause the fake clock so time only moves when we step it. Otherwise it also
// flows in real time, and slow frames would speed the app up.
const t0 = new Date('2026-11-01T17:00:00Z');
await page.clock.install({ time: t0 });
await page.clock.pauseAt(new Date(t0.getTime() + 1000));
await page.goto(url, { waitUntil: 'load' });
// Let modules initialise with a little real time, then take over the clock.
for (let i = 0; i < 60; i++) {
  await page.clock.runFor(100);
  const ready = await page.evaluate(() => !!window.__app).catch(() => false);
  if (ready) break;
}
const total = Math.round(seconds * fps);
const evalAt = args.at !== undefined ? Math.round(+args.at * fps) : -1;
let lastState = '';
const log = [];
for (let f = 0; f < total; f++) {
  if (f === evalAt && typeof args.eval === 'string') await page.evaluate(args.eval).catch((e) => console.log('eval failed:', e.message));
  await page.clock.runFor(1000 / fps);
  if (shots && f % every === 0) await page.screenshot({ path: `${out}/${String(f / every).padStart(5, '0')}.png`, type: 'png' });
  if (encoder) {
    const png = await page.screenshot({ type: 'png' });
    if (!encoder.stdin.write(png)) await new Promise((r) => encoder.stdin.once('drain', r));
    if (stills && f % stills === 0) writeFileSync(`${out}/${String(f).padStart(5, '0')}.png`, png);
  }
  if (f % Math.round(fps / 2) === 0) {
    const st = await page
      .evaluate(() => {
        const a = window.__app;
        return a ? `${a.screen}|${a.lesson.currentSign?.id ?? ''}|${a.lesson.currentStep}` : 'boot';
      })
      .catch(() => 'reloading');
    if (st !== lastState) {
      log.push(`${(f / fps).toFixed(1)}s ${st}`);
      console.log(`${(f / fps).toFixed(1)}s ${st}`);
      lastState = st;
    }
    if (until && st.startsWith(until)) {
      console.log(`reached "${until}" at ${(f / fps).toFixed(1)}s`);
      break;
    }
  }
}
if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].slice(0, 20).join('\n'));
await browser.close();
if (encoder) {
  encoder.stdin.end();
  await new Promise((r) => encoder.on('close', r));
  console.log(`wrote ${video}`);
}
