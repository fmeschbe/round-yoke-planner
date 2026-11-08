import { expect, test } from '@playwright/test';
import { applyInputs } from './calculator-helper';
import { saveAs } from './plan-helper';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await applyInputs(page, { si: 8, ip: 2, sf: 16 });
  await page.locator('#segments').selectOption('4');
});

test('expands the yoke preview beside its indicator without changing the saved pattern', async ({ page }) => {
  await page.locator('#add-color').click();
  await page.locator('#chart button[data-round="1"][data-column="0"]').click();
  await saveAs(page, 'Expanded preview');
  const placement = await page.locator('.preview-heading-actions').evaluate(actions => {
    const indicator = actions.querySelector('#preview-mode')!.getBoundingClientRect();
    const button = actions.querySelector('button')!.getBoundingClientRect();
    return { indicatorRight: indicator.right, indicatorTop: indicator.top, indicatorBottom: indicator.bottom, buttonLeft: button.left, buttonTop: button.top, buttonBottom: button.bottom };
  });
  expect(placement.buttonLeft).toBeGreaterThan(placement.indicatorRight);
  expect(placement.buttonTop).toBeLessThan(placement.indicatorBottom);
  expect(placement.buttonBottom).toBeGreaterThan(placement.indicatorTop);
  const normalHeight = (await page.locator('#preview svg').boundingBox())!.height;
  await page.locator('#expand-preview').click();
  await expect(page.locator('#preview-fullscreen')).toBeVisible();
  await expect(page.locator('#expand-preview')).toHaveAttribute('aria-label', 'Exit full-screen preview');
  expect((await page.locator('#preview svg').boundingBox())!.height).toBeGreaterThan(normalHeight);
  await expect(page.locator('#preview-fullscreen #visible-segments')).toBeVisible();
  await expect(page.locator('#preview .preview-stitches path[data-round="1"][data-column="0"]')).toHaveAttribute('fill', '#ba5365');
  await page.keyboard.press('Escape');
  await expect(page.locator('#preview-fullscreen')).toBeHidden();
  await expect(page.locator('#expand-preview')).toBeFocused();
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Saved in this browser');
  await expect(page.locator('#chart button[data-round="1"][data-column="0"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#preview-mode')).toHaveText('Sector');
});

test('retains preview controls and scales the expanded preview on mobile', async ({ page }) => {
  await page.locator('#expand-preview').click();
  await page.locator('#visible-segments').fill('2');
  await page.locator('#visible-segments').blur();
  await expect(page.locator('#preview .preview-stitches path[data-round="1"][data-column="0"]')).toHaveCount(2);
  await page.locator('#full-circle').click();
  await expect(page.locator('#preview-mode')).toHaveText('Full circle');
  await page.locator('#expand-preview').click();
  await expect(page.locator('#visible-segments')).toHaveValue('4');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#expand-preview').click();
  const box = (await page.locator('#preview-fullscreen').boundingBox())!;
  expect(box.width).toBe(390);
  expect(box.height).toBe(844);
  expect((await page.locator('#preview svg').boundingBox())!.height).toBeGreaterThan(300);
  await page.locator('#expand-preview').click();
  await expect(page.locator('#preview-fullscreen')).toBeHidden();
  await expect(page.locator('#preview-mode')).toHaveText('Full circle');
});

test('localizes preview expansion and safely expands an empty preview', async ({ page }) => {
  for (const [locale, expand, exit, dialog] of [
    ['de', 'Rundpassen-Vorschau vergrößern', 'Vollbild der Vorschau verlassen', 'Rundpassen-Vorschau im Vollbild'],
    ['nb', 'Utvid forhåndsvisningen av bærestykket', 'Avslutt fullskjermvisning av forhåndsvisningen', 'Forhåndsvisning av bærestykket i fullskjerm'],
  ]) {
    await page.locator('#language').selectOption(locale);
    await expect(page.locator('#expand-preview')).toHaveAttribute('aria-label', expand);
    await page.locator('#expand-preview').click();
    await expect(page.locator('#preview-fullscreen')).toHaveAttribute('aria-label', dialog);
    await expect(page.locator('#expand-preview')).toHaveAttribute('aria-label', exit);
    await page.keyboard.press('Escape');
    await expect(page.locator('#expand-preview')).toHaveAttribute('aria-label', expand);
  }
  await applyInputs(page, { si: 8, ip: 2, sf: 8 });
  await page.locator('#expand-preview').click();
  await expect(page.locator('#preview-fullscreen')).toBeVisible();
  await expect(page.locator('#preview svg')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#preview-fullscreen')).toBeHidden();
});
