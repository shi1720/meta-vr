#!/usr/bin/env node
/** Renders every card in cards.html to tools/video/cards/<id>.png (1920×1080, transparent). */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(HERE, 'cards'), { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ['--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(join(HERE, 'cards.html')).href);
await page.evaluate(() => document.fonts.ready);
const ids = await page.$$eval('.card', (els) => els.map((e) => e.id));
for (const id of ids) {
  await page.evaluate((id) => document.querySelectorAll('.card').forEach((c) => c.classList.toggle('on', c.id === id)), id);
  await page.waitForTimeout(100);
  await page.screenshot({ path: join(HERE, 'cards', `${id}.png`), omitBackground: true });
}
console.log(ids.join(' '));
await browser.close();
