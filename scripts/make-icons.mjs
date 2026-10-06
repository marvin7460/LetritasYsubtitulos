// Renders public/favicon.svg into the PNG icons the PWA manifest needs (uses Playwright's Chromium).
// Usage: node scripts/make-icons.mjs
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch(
  process.env.PW_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PW_CHROMIUM_EXECUTABLE } : {},
);
const page = await browser.newPage();
const icons = [
  { file: 'pwa-192.png', size: 192, padding: 0 },
  { file: 'pwa-512.png', size: 512, padding: 0 },
  // Maskable icons need a safe area: the OS may crop up to 20% around the edges.
  { file: 'pwa-maskable-512.png', size: 512, padding: 0.12 },
  { file: 'apple-touch-icon.png', size: 180, padding: 0.06 },
];
for (const { file, size, padding } of icons) {
  const inner = Math.round(size * (1 - padding * 2));
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;background:#0b0b12;display:grid;place-items:center;height:${size}px">
       <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div>
     </body>`,
  );
  await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname });
  console.log('wrote', file);
}
await browser.close();
