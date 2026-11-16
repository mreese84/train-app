// Renders the app icon SVG to the PNG sizes the PWA manifest and iOS need.
// Run with `npm run icons` (uses Playwright's Chromium). Output goes to public/.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
// Full-bleed variant (no rounded corners) for iOS + maskable icons; iOS adds its own mask.
const square = svg.replace(/rx="\d+"/, 'rx="0"');

const targets = [
  { file: 'icon-192.png', size: 192, src: svg },
  { file: 'icon-512.png', size: 512, src: svg },
  { file: 'icon-512-maskable.png', size: 512, src: square, pad: 0.12 },
  { file: 'apple-touch-icon.png', size: 180, src: square },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  const inner = Math.round(t.size * (1 - 2 * (t.pad ?? 0)));
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:${t.pad ? '#1E6B48' : 'transparent'};display:flex;align-items:center;justify-content:center;width:${t.size}px;height:${t.size}px">
      <div style="width:${inner}px;height:${inner}px">${t.src.replace('<svg', `<svg width="${inner}" height="${inner}"`)}</div>
    </body></html>`,
  );
  const buf = await page.screenshot({ omitBackground: !t.pad, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  writeFileSync(new URL(`../public/${t.file}`, import.meta.url), buf);
  console.log('wrote', t.file);
}
await browser.close();
