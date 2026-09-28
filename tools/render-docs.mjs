#!/usr/bin/env node
/**
 * Renders the submission documents with headless Chromium:
 *   docs/submission/deck/deck.html         → Signsprout-deck.pdf + deck/slides/NN.png (not committed)
 *   docs/submission/one-pager/one-pager.html → Signsprout-one-pager.pdf
 *   docs/submission/BUSINESS_PLAN.md       → Signsprout-business-plan.pdf
 *
 * The business plan is converted with Python-Markdown (`pip install markdown`).
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SUB = join(ROOT, 'docs/submission');
const only = process.argv[2];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ['--allow-file-access-from-files'],
});

async function open(file, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return page;
}

if (!only || only === 'deck') {
  const page = await open(join(SUB, 'deck/deck.html'), { width: 1920, height: 1080 });
  await page.pdf({ path: join(SUB, 'Signsprout-deck.pdf'), width: '1920px', height: '1080px', printBackground: true });
  const slides = await page.$$('section.slide');
  mkdirSync(join(SUB, 'deck/slides'), { recursive: true });
  for (let i = 0; i < slides.length; i++) {
    await slides[i].screenshot({ path: join(SUB, `deck/slides/${String(i + 1).padStart(2, '0')}.png`) });
  }
  console.log(`deck: ${slides.length} slides`);
  await page.close();
}

if (!only || only === 'one-pager') {
  const page = await open(join(SUB, 'one-pager/one-pager.html'), { width: 816, height: 1056 });
  await page.pdf({ path: join(SUB, 'Signsprout-one-pager.pdf'), width: '8.5in', height: '11in', printBackground: true });
  await page.screenshot({ path: join(SUB, 'one-pager/one-pager.png'), fullPage: true });
  console.log('one-pager done');
  await page.close();
}

if (!only || only === 'plan') {
  const md = readFileSync(join(SUB, 'BUSINESS_PLAN.md'), 'utf8');
  const body = execFileSync('python3', ['-c', 'import sys, markdown; print(markdown.markdown(sys.stdin.read(), extensions=["tables"]))'], { input: md }).toString();
  const fonts = pathToFileURL(join(ROOT, 'node_modules/@fontsource-variable')).href;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: 'Fraunces'; src: url('${fonts}/fraunces/files/fraunces-latin-wght-normal.woff2'); font-weight: 100 900; }
    @font-face { font-family: 'Inter'; src: url('${fonts}/inter/files/inter-latin-wght-normal.woff2'); font-weight: 100 900; }
    @page { size: 8.5in 11in; margin: 0.8in 0.85in; }
    body { font-family: 'Inter', sans-serif; color: #16232B; font-size: 10.5pt; line-height: 1.55; }
    h1 { font-family: 'Fraunces', serif; font-size: 30pt; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 4pt; color: #1E8C63; }
    h2 { font-family: 'Fraunces', serif; font-size: 16pt; font-weight: 600; margin: 20pt 0 6pt; padding-top: 10pt; border-top: 1px solid #eadfcd; }
    p, li { margin: 0 0 6pt; }
    em { color: #5f707a; }
    a { color: #1E8C63; text-decoration: none; }
    table { border-collapse: collapse; width: 100%; margin: 8pt 0 10pt; font-size: 9pt; page-break-inside: avoid; }
    th, td { text-align: left; padding: 5pt 7pt; border-bottom: 1px solid #eadfcd; vertical-align: top; }
    th { background: #F6EDDF; font-weight: 700; }
    strong { color: #0f1a20; }
  </style></head><body>${body}</body></html>`;
  const tmp = join(SUB, '.business-plan.html');
  writeFileSync(tmp, html);
  const page = await open(tmp, { width: 816, height: 1056 });
  await page.pdf({
    path: join(SUB, 'Signsprout-business-plan.pdf'),
    format: 'Letter',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="font-size:8px;color:#8b979d;width:100%;text-align:center;">Signsprout · Business plan · <span class="pageNumber"></span></div>',
    margin: { top: '0.75in', bottom: '0.75in', left: '0.85in', right: '0.85in' },
  });
  execFileSync('rm', ['-f', tmp]);
  console.log('business plan done');
  await page.close();
}

await browser.close();
