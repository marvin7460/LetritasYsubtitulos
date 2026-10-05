import { expect, test } from '@playwright/test';
import { uploadAndTranscribe } from './helpers';

test.beforeEach(async ({ page }) => {
  await uploadAndTranscribe(page);
});

test('edit text, then undo and redo with the keyboard', async ({ page }) => {
  const first = page.getByTestId('caption-item').first();
  await first.dblclick();
  const textarea = page.getByTestId('caption-textarea');
  await textarea.fill('Hola a todas, bienvenidas a Letritas.');
  await textarea.press('Enter');
  await expect(first).toContainText('Hola a todas, bienvenidas a Letritas.');

  await page.keyboard.press('Control+z');
  await expect(first).toContainText('Hola a todos, bienvenidos a Letritas.');
  await page.keyboard.press('Control+Shift+z');
  await expect(first).toContainText('bienvenidas');
});

test('split and merge captions', async ({ page }) => {
  const items = page.getByTestId('caption-item');
  const before = await items.count();
  await items.first().getByRole('button', { name: 'Dividir a la mitad' }).click();
  await expect(items).toHaveCount(before + 1);
  await items.first().getByRole('button', { name: 'Unir con el siguiente' }).click();
  await expect(items).toHaveCount(before);
  await expect(items.first()).toContainText('Hola a todos, bienvenidos a Letritas.');
});

test('alt+click on a word splits before it', async ({ page }) => {
  const items = page.getByTestId('caption-item');
  const before = await items.count();
  await items
    .first()
    .getByRole('button', { name: 'bienvenidos', exact: true })
    .click({ modifiers: ['Alt'] });
  await expect(items).toHaveCount(before + 1);
  await expect(items.nth(1)).toContainText('bienvenidos a Letritas.');
});

test('find and replace', async ({ page }) => {
  await page.keyboard.press('Control+f');
  await page.getByLabel('Buscar', { exact: true }).fill('letritas');
  await expect(page.getByTestId('find-count')).toHaveText('1 coincidencia(s)');
  await page.getByLabel('Reemplazar con').fill('Letritas Pro');
  await page.getByRole('button', { name: 'Reemplazar todo' }).click();
  await expect(page.getByTestId('caption-item').first()).toContainText('Letritas Pro.');
});

test('delete a caption and get it back with undo', async ({ page }) => {
  const items = page.getByTestId('caption-item');
  const before = await items.count();
  await items.first().getByRole('button', { name: 'Eliminar subtítulo' }).click();
  await expect(items).toHaveCount(before - 1);
  await page.getByRole('button', { name: 'Deshacer (Ctrl+Z)' }).click();
  await expect(items).toHaveCount(before);
});

test('dragging a caption block on the timeline moves it (one undo step)', async ({ page }) => {
  const timeline = page.getByRole('slider', { name: 'Línea de tiempo' });
  await timeline.scrollIntoViewIfNeeded();
  const box = await timeline.boundingBox();
  if (!box) throw new Error('timeline not visible');
  const timeLabel = page.getByTestId('caption-item').last().getByRole('button').first();
  const original = (await timeLabel.textContent()) ?? '';
  // "0:06.7 → 0:07.5" → grab the middle of the last block (80 px per second by default) and
  // move it right, into the free space before the end of the media.
  const seconds = original.split(' → ').map((part) => {
    const [m = '0', s = '0'] = part.split(':');
    return Number(m) * 60 + Number(s);
  });
  const middleX = (((seconds[0] ?? 0) + (seconds[1] ?? 0)) / 2) * 80;

  const y = box.y + 123; // caption lane
  await page.mouse.move(box.x + middleX, y);
  await page.mouse.down();
  await page.mouse.move(box.x + middleX + 16, y, { steps: 5 });
  await page.mouse.up();
  await expect(timeLabel).not.toHaveText(original);

  await page.keyboard.press('Control+z');
  await expect(timeLabel).toHaveText(original);
});

test('keyboard navigation selects captions', async ({ page }) => {
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('caption-item').nth(1)).toHaveClass(/border-brand/);
});
