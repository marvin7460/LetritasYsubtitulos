// Runs /bench.html in a real browser and writes the results to bench/results.md.
//
//   npm run build && npm run bench                      # everything (downloads the models)
//   npm run bench -- --only=export                     # only the video export benchmark
//   npm run bench -- --models=tiny,base --devices=webgpu
//
// It uses your installed Google Chrome (channel "chrome") when available, because Playwright's
// bundled Chromium has no H.264 encoder and runs WebGPU in software.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a) => a.replace(/^--/, '').split('='))
    .map(([k, v]) => [k, v ?? '1']),
);
const port = 4180;
const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 2500));

const launchOptions = {
  headless: args.headed ? false : true,
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--ignore-gpu-blocklist'],
};
let browser;
try {
  browser = await chromium.launch({ ...launchOptions, channel: 'chrome' });
} catch {
  console.warn('Google Chrome not found; using Playwright Chromium (no H.264, software WebGPU).');
  browser = await chromium.launch({
    ...launchOptions,
    ...(process.env.PW_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PW_CHROMIUM_EXECUTABLE }
      : {}),
  });
}

try {
  const page = await browser.newPage();
  page.on('console', (message) => console.log(`  [page] ${message.text()}`));
  const query = new URLSearchParams({ auto: '1' });
  for (const key of ['models', 'devices', 'only']) if (args[key]) query.set(key, args[key]);
  await page.goto(`http://localhost:${port}/bench.html?${query}`);
  await page.waitForFunction(() => window.__benchResults?.done === true, null, {
    timeout: 60 * 60 * 1000,
  });
  const results = await page.evaluate(() => window.__benchResults);
  await mkdir('bench', { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  await writeFile('bench/results.md', `<!-- ${stamp} -->\n${results.markdown}\n`);
  await writeFile(`bench/results/${stamp}.json`, JSON.stringify(results.rows, null, 2)).catch(
    async () => {
      await mkdir('bench/results', { recursive: true });
      await writeFile(`bench/results/${stamp}.json`, JSON.stringify(results.rows, null, 2));
    },
  );
  console.log(`\n${results.markdown}\n\nSaved to bench/results.md`);
} finally {
  await browser.close();
  server.kill();
}
