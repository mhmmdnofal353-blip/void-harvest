// Capture the entry's screenshots: serve game/ locally, open each scene from
// shots.json in headless Chromium at exactly 1280x720, wait for the game to flag
// its first frame, and save a JPEG (kept under the gate's 256 KiB cap).
// Run: node take-screenshots.mjs   (needs the playwright package + its Chromium)

import { spawn } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = fileURLToPath(new URL('.', import.meta.url));
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
const PORT = 8901;

const server = spawn('node', [join(here, 'serve.ts'), '--port', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));

try {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/meta-chromium/chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE:', m.text()); });
  for (const shot of shots) {
    await page.goto(`http://localhost:${PORT}/${shot.query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 15000 });
    await page.waitForTimeout(120);
    const out = join(here, 'screenshots', shot.name);
    await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
    console.log(shot.name, statSync(out).size, 'bytes');
  }
  await browser.close();
} finally {
  server.kill();
}
