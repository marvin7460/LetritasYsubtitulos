import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { upload, uploadAndTranscribe } from './helpers';

// EBML header that starts every WebM file.
const WEBM_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];

async function exportWebm(page: import('@playwright/test').Page): Promise<Buffer> {
  await page.getByRole('tab', { name: 'Exportar' }).click();
  const webm = page.getByTestId('export-webm');
  await expect(webm).toBeEnabled({ timeout: 10_000 });
  const download = page.waitForEvent('download', { timeout: 120_000 });
  await webm.click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/-subtitulado\.webm$/);
  await expect(page.getByTestId('export-done')).toBeVisible();
  return readFile(await file.path());
}

test('burns captions into a WebM when the browser has no H.264 encoder', async ({ page }) => {
  test.setTimeout(150_000);
  await uploadAndTranscribe(page);
  await page.getByRole('tab', { name: 'Exportar' }).click();
  // Playwright's Chromium ships without H.264: the MP4 button explains it's unavailable.
  const mp4Supported = await page.getByTestId('export-mp4').isEnabled();
  if (!mp4Supported) await expect(page.getByText(/no puede codificar H\.264/)).toBeVisible();

  const bytes = await exportWebm(page);
  expect([...bytes.subarray(0, 4)]).toEqual(WEBM_MAGIC);
  expect(bytes.length).toBeGreaterThan(50_000);
});

test('audio files export as an audiogram video', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/');
  await upload(page, 'voice-5s.wav');
  await page.getByRole('button', { name: /^Transcribir/ }).click();
  await expect(page.getByTestId('caption-item').first()).toBeVisible({ timeout: 15_000 });
  const bytes = await exportWebm(page);
  expect([...bytes.subarray(0, 4)]).toEqual(WEBM_MAGIC);
});

test('export can be cancelled', async ({ page }) => {
  test.setTimeout(60_000);
  await uploadAndTranscribe(page);
  await page.getByRole('tab', { name: 'Exportar' }).click();
  await expect(page.getByTestId('export-webm')).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId('export-webm').click();
  await page.getByRole('button', { name: 'Cancelar' }).click({ timeout: 10_000 });
  await expect(page.getByTestId('export-webm')).toBeVisible();
  await expect(page.getByTestId('export-done')).toHaveCount(0);
});
