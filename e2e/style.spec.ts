import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { uploadAndTranscribe } from './helpers';

test.beforeEach(async ({ page }) => {
  await uploadAndTranscribe(page);
  await page.getByRole('tab', { name: 'Estilo' }).click();
});

test('the TikTok preset regroups captions into short chunks (undoable)', async ({ page }) => {
  const items = page.getByTestId('caption-item');
  await page.getByRole('tab', { name: 'Texto' }).click();
  const before = await items.count();

  await page.getByRole('tab', { name: 'Estilo' }).click();
  await page.getByTestId('preset-tiktok').click();
  await expect(page.getByTestId('preset-tiktok')).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('tab', { name: 'Texto' }).click();
  expect(await items.count()).toBeGreaterThan(before);
  for (const text of await items.locator('p').allTextContents()) {
    expect(text.trim().split(/\s+/).length).toBeLessThanOrEqual(3);
  }

  await page.keyboard.press('Control+z');
  await expect(items).toHaveCount(before);
});

test('changing the font size updates the style', async ({ page }) => {
  const slider = page.getByLabel('Tamaño');
  await slider.fill('8');
  await expect(page.getByText('8.0%')).toBeVisible();
});

test('safe zones overlay can be toggled', async ({ page }) => {
  await page.getByLabel('Mostrar zonas seguras (TikTok, Reels, Shorts)').check();
  await expect(page.getByTestId('safe-zones')).toBeVisible();
});

test('exports ASS with the chosen style', async ({ page }) => {
  await page.getByTestId('preset-karaoke').click();
  await page.getByRole('tab', { name: 'Exportar' }).click();
  const download = page.waitForEvent('download');
  await page.getByTestId('export-ass').click();
  const ass = await readFile(await (await download).path(), 'utf8');
  expect(ass).toContain('Style: Default,Poppins,');
  expect(ass).toMatch(/\{\\kf\d+\}/);
});
