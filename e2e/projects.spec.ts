import { expect, test } from '@playwright/test';
import { uploadAndTranscribe } from './helpers';

test('the demo opens instantly with precomputed captions', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('demo-button').click();
  await expect(page.getByText('Video de ejemplo.')).toBeVisible();
  await page.getByRole('tab', { name: 'Texto' }).click();
  await expect(page.getByTestId('caption-item').first()).toContainText('¡Hola!');
  // TikTok preset: short captions.
  for (const text of await page.getByTestId('caption-item').locator('p').allTextContents()) {
    expect(text.trim().split(/\s+/).length).toBeLessThanOrEqual(3);
  }
});

test('the demo is not saved as a project', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('demo-button').click();
  await expect(page.getByText('Video de ejemplo.')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.getByTestId('projects-list')).toHaveCount(0);
});

test('projects are autosaved and reopen after a reload', async ({ page }) => {
  await uploadAndTranscribe(page);
  const first = page.getByTestId('caption-item').first();
  await first.dblclick();
  await page.getByTestId('caption-textarea').fill('Texto guardado en el navegador.');
  await page.getByTestId('caption-textarea').press('Enter');
  await expect(page.getByTestId('save-status')).toHaveText('Guardado en este navegador');

  await page.reload();
  const list = page.getByTestId('projects-list');
  await expect(list).toContainText('vertical-8s');
  await list.getByRole('button', { name: /^vertical-8s/ }).click();
  await page.getByRole('tab', { name: 'Texto' }).click();
  await expect(page.getByTestId('caption-item').first()).toContainText(
    'Texto guardado en el navegador.',
  );
});

test('projects can be deleted', async ({ page }) => {
  await uploadAndTranscribe(page);
  await expect(page.getByTestId('save-status')).toHaveText('Guardado en este navegador');
  await page.reload();
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: /Eliminar vertical-8s/ }).click();
  await expect(page.getByTestId('projects-list')).toHaveCount(0);
});
