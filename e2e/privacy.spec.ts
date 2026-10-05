import { expect, test } from '@playwright/test';
import { uploadAndTranscribe } from './helpers';

/**
 * The privacy promise, tested: with the mock engine (no model download), using the whole app
 * must not make a single request to any other origin, and nothing may be uploaded anywhere.
 */
test('no request leaves the origin while working on a video', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? 'http://localhost:4173').origin;
  const offending: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    const local = url.origin === origin || url.protocol === 'blob:' || url.protocol === 'data:';
    const upload = !['GET', 'HEAD'].includes(request.method());
    if (!local || upload) offending.push(`${request.method()} ${request.url()}`);
  });

  await uploadAndTranscribe(page);
  await page.getByRole('tab', { name: 'Exportar' }).click();
  const download = page.waitForEvent('download');
  await page.getByTestId('export-srt').click();
  await download;

  expect(offending).toEqual([]);
});

test('the page is cross-origin isolated (multi-threaded WASM fallback)', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
});
