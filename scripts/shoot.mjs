// Renders the built dashboard in headless Chromium and takes the four screenshots the gate counts:
//   1-board.png (the board), 2-detail.png (a detail view), 3-filtered.png (a filtered view),
//   4-model.png (the model and calibration). Run after main.ts, from the repository root:
//   node scripts/shoot.mjs out
// Each shot is 1440x900; the gate allows at most 512 KiB per image.
// A fresh page per shot: a same-document hash change would not reload the page, so each shot gets
// its own page (and its own query string, so the document is never shared between shots).

import { createRequire } from 'node:module';
import { statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/hatch/workspace/code-videos/yawning/node_modules/playwright-core');

const out = resolve(process.argv[2] ?? 'out');
const shots = [
  ['1-board.png', '#tab=board', null],
  ['2-detail.png', '#tab=board&p=steakhouse-financial', null],
  ['3-filtered.png', '#tab=board&cat=Lending', null],
  // The calibration table is the evidence for the model, so the model shot is scrolled to it.
  ['4-model.png', '#tab=model', '#calHead'],
];

const browser = await chromium.launch({
  executablePath: '/home/hatch/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  args: ['--no-sandbox'],
});
let i = 0;
for (const [name, hash, scrollTo] of shots) {
  i++;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`file://${join(out, 'dashboard', 'index.html')}?shot=${i}${hash}`, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  if (scrollTo) {
    await page.evaluate((sel) => { const el = document.querySelector(sel); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70); }, scrollTo);
    await page.waitForTimeout(400);
  }
  const path = join('screenshots', name);
  await page.screenshot({ path, type: 'png' });
  const bytes = statSync(path).size;
  console.log(`${name}: ${bytes} bytes${bytes > 524_288 ? ' — OVER THE 512 KiB CAP' : ''}`);
  await page.close();
}
await browser.close();
console.log('done');
