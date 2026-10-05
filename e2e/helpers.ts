import { expect, type Page } from '@playwright/test';
import path from 'node:path';

export const fixture = (name: string) => path.join(import.meta.dirname, 'fixtures', name);

/** Uploads a file through the drop zone's hidden input. */
export async function upload(page: Page, name: string): Promise<void> {
  await page.getByTestId('file-input').setInputFiles(fixture(name));
}

/** Uploads the vertical sample and runs the (mock) transcription until captions appear. */
export async function uploadAndTranscribe(page: Page): Promise<void> {
  await page.goto('/');
  await upload(page, 'vertical-8s.webm');
  await expect(page.getByRole('button', { name: /^Transcribir/ })).toBeVisible();
  await page.getByRole('button', { name: /^Transcribir/ }).click();
  await expect(page.getByTestId('caption-item').first()).toBeVisible({ timeout: 15_000 });
}
