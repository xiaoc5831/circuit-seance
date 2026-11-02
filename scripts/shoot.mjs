// Headless screenshots of the built app using system Chromium.
// Usage: node scripts/shoot.mjs <url> <outdir>
import { chromium } from 'playwright-core';
const url = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'docs/screenshots';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const logs = [];
await page.route('**/*', (r) => (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(r.request().url()) ? r.continue() : r.abort()));
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/01-landing.png` });
const steps = JSON.parse(process.env.STEPS ?? '[]');
let i = 2;
for (const s of steps) {
  try {
    if (s.click) await page.click(s.click, { timeout: 5000 });
    if (s.waitFor) await page.waitForSelector(s.waitFor, { timeout: s.timeout ?? 30000 });
    if (s.wait) await page.waitForTimeout(s.wait);
    if (s.shot) await page.screenshot({ path: `${out}/${String(i++).padStart(2, '0')}-${s.shot}.png`, fullPage: !!s.full });
  } catch (e) {
    logs.push(`[step-fail] ${JSON.stringify(s)} ${e.message.split('\n')[0]}`);
  }
}
console.log(logs.join('\n'));
await browser.close();
