#!/usr/bin/env node
/**
 * Scripted, frame-accurate captures of the companion site for the demo video.
 *
 *   node tools/record-web.mjs --base http://127.0.0.1:8093/ --out out/web [--only coach]
 *
 * Scenes:
 *   coach       the family dashboard: type a goal, "Plan my week", the plan appears
 *   dictionary  a sign in the 3D dictionary, switching from "Sprout’s view" to "Your view"
 *
 * Uses the same paused-clock approach as tools/record.mjs and pipes PNG frames
 * into ffmpeg (set FFMPEG if it isn't on PATH).
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? true : arr[i + 1]]] : acc), []),
);
const base = args.base ?? 'http://127.0.0.1:8093/';
const out = args.out ?? 'out/web';
const fps = 30;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

async function scene(name, url, script) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const t0 = new Date('2026-11-01T17:00:00Z');
  await page.clock.install({ time: t0 });
  await page.clock.pauseAt(new Date(t0.getTime() + 1000));
  await page.goto(url, { waitUntil: 'load' });
  for (let i = 0; i < 30; i++) await page.clock.runFor(100);
  await page.evaluate(() => document.fonts.ready);
  const ff = spawn(process.env.FFMPEG ?? 'ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}/${name}.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
  let frames = 0;
  const frame = async (n = 1) => {
    for (let i = 0; i < n; i++) {
      await page.clock.runFor(1000 / fps);
      const png = await page.screenshot({ type: 'png' });
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      frames++;
    }
  };
  await script(page, frame);
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log(`${name}: ${frames} frames (${(frames / fps).toFixed(1)} s)`);
  await context.close();
}

const only = args.only;

if (!only || only === 'coach') {
  await scene('web-coach', `${base}#/dashboard?sample=1`, async (page, frame) => {
    const card = page.locator('section.coach');
    await card.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const el = document.querySelector('section.coach');
      if (el) window.scrollBy(0, el.getBoundingClientRect().top - 110);
    });
    await frame(30);
    const box = page.locator('section.coach textarea');
    await box.click();
    for (const ch of 'Words for bath time and bedtime') {
      await box.type(ch);
      await frame(2);
    }
    await frame(15);
    await page.locator('section.coach button[type=submit]').click();
    await frame(24);
    await page.evaluate(() => {
      const el = document.querySelector('.coach-plan');
      if (el) el.scrollIntoView({ block: 'center' });
    });
    await frame(120);
  });
}

if (!only || only === 'dictionary') {
  await scene('web-dictionary', `${base}#/dictionary/milk`, async (page, frame) => {
    await frame(75);
    await page.getByRole('radio', { name: /your view/i }).first().click();
    await frame(120);
  });
}

await browser.close();
