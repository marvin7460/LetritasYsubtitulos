import { expect, test } from '@playwright/test';

/**
 * Transcribes the demo clip with the real tiny Whisper model and checks the words make sense.
 * The demo's speech is synthetic, so we only expect a few key words, not a perfect transcript.
 */
for (const device of ['webgpu', 'wasm'] as const) {
  test(`transcribes the demo clip with whisper-tiny on ${device}`, async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('demo-button').click();
    await page.getByRole('tab', { name: 'Transcribir' }).click();
    await page.getByLabel('Procesador').selectOption(device);
    await page.getByLabel('Idioma').selectOption('auto');
    await page.getByRole('radio', { name: /Tiny/ }).check();
    await page.getByRole('button', { name: /Volver a transcribir/ }).click();

    await expect(page.getByTestId('caption-item').first()).toBeVisible({ timeout: 10 * 60 * 1000 });
    const text = (await page.getByTestId('caption-list').textContent())?.toLowerCase() ?? '';
    console.log(`[${device}] ${text.slice(0, 200)}`);
    expect(text).toMatch(/hola|letritas|video|subt[ií]tulos|servidor/);
  });
}
