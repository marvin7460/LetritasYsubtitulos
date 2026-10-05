import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { upload, uploadAndTranscribe } from './helpers';

test('upload → transcribe → captions → export SRT and VTT', async ({ page }) => {
  await uploadAndTranscribe(page);

  const items = page.getByTestId('caption-item');
  await expect(items.first()).toContainText('Hola a todos,');
  expect(await items.count()).toBeGreaterThan(2);

  await page.getByRole('tab', { name: 'Exportar' }).click();

  const srtDownload = page.waitForEvent('download');
  await page.getByTestId('export-srt').click();
  const srt = await srtDownload;
  expect(srt.suggestedFilename()).toBe('vertical-8s.srt');
  const srtText = await readFile(await srt.path(), 'utf8');
  expect(srtText).toMatch(/^1\n00:00:00,\d{3} --> /);
  expect(srtText).toContain('bienvenidos a Letritas.');

  const vttDownload = page.waitForEvent('download');
  await page.getByTestId('export-vtt').click();
  const vttText = await readFile(await (await vttDownload).path(), 'utf8');
  expect(vttText.startsWith('WEBVTT')).toBe(true);
});

test('clicking a word seeks the video', async ({ page }) => {
  await uploadAndTranscribe(page);
  const word = page.getByTestId('caption-item').nth(1).getByRole('button').nth(1);
  await word.click();
  const time = await page
    .getByTestId('preview-video')
    .evaluate((v: HTMLVideoElement) => v.currentTime);
  expect(time).toBeGreaterThan(0.5);
});

test('draws captions on the preview canvas', async ({ page }) => {
  await uploadAndTranscribe(page);
  await page.getByTestId('caption-item').first().getByRole('button').nth(1).click();
  await expect
    .poll(() =>
      page.getByTestId('caption-canvas').evaluate((canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return 0;
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let painted = 0;
        for (let i = 3; i < data.length; i += 4) if ((data[i] ?? 0) > 0) painted++;
        return painted;
      }),
    )
    .toBeGreaterThan(100);
});

test('audio files work too', async ({ page }) => {
  await page.goto('/');
  await upload(page, 'voice-5s.wav');
  await page.getByRole('button', { name: /^Transcribir/ }).click();
  await expect(page.getByTestId('caption-item').first()).toBeVisible({ timeout: 15_000 });
});

test('unsupported files show a clear error with a way out', async ({ page }) => {
  await page.goto('/');
  await upload(page, 'document.avi');
  const banner = page.getByTestId('error-banner');
  await expect(banner).toContainText('Formato no soportado');
  await expect(banner.getByRole('button', { name: 'Elegir otro archivo' })).toBeVisible();
});
