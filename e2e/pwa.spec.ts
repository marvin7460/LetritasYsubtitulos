import { expect, test } from '@playwright/test';

test('works offline after the first visit (service worker precache)', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByTestId('offline-ready')).toBeVisible({ timeout: 20_000 });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Subtítulos animados');
  // Self-hosted fonts come from the precache too.
  expect(await page.evaluate(() => document.fonts.check('900 16px Montserrat'))).toBeDefined();
});

test('exposes an installable web app manifest', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = (await (await request.get(href ?? '')).json()) as {
    name: string;
    icons: unknown[];
  };
  expect(manifest.name).toContain('Letritas');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
});
