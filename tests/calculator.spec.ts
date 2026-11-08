import { expect, test } from '@playwright/test';
import { importInputs } from './calculator-helper';
import { menuAction } from './plan-helper';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('leads with increase presets and derives bounded, valid stitch selections', async ({ page }) => {
  await expect(page.locator('.input-fields select')).toHaveCount(3);
  expect(await page.locator('.input-fields select').evaluateAll(selects => selects.map(select => select.id)))
    .toEqual(['ip', 'si', 'sf']);
  await expect(page.locator('#ip option')).toHaveText(['4', '8', '16', '32']);
  await expect(page.locator('#ip')).toHaveValue('16');
  await expect(page.locator('#si')).toHaveValue('64');
  await expect(page.locator('#sf')).toHaveValue('160');
  await expect(page.locator('#si option')).toHaveText(['16', '32', '48', '64', '80', '96']);
  await expect(page.locator('#sf option')).toHaveText(['128', '160', '192', '224', '256', '288']);
  await page.locator('#ip').selectOption('32');
  await expect(page.locator('#si')).toHaveValue('64');
  await expect(page.locator('#sf')).toHaveValue('128');
  await expect(page.locator('#si option')).toHaveText(['32', '64', '96']);
  await expect(page.locator('#sf option')).toHaveText(['128', '192', '256']);
  await expect(page.locator('.round-total strong')).toHaveText('24');
  await page.locator('#calculator button').click();
  await expect(page.locator('.round-total strong')).toHaveText('16');
});

test('cascades to smallest valid choices without applying or discarding the current pattern', async ({ page }) => {
  await page.locator('#add-color').click();
  const painted = page.locator('#chart button[data-round="1"][data-column="158"]');
  await painted.click();
  await page.locator('#si').selectOption('48');
  await expect(page.locator('#sf')).toHaveValue('112');
  await page.locator('#ip').selectOption('32');
  await expect(page.locator('#si')).toHaveValue('32');
  await expect(page.locator('#sf')).toHaveValue('160');
  await expect(painted).toHaveAttribute('aria-pressed', 'true');
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#calculator button').click();
  await expect(page.locator('.round-total strong')).toHaveText('24');
  await expect(painted).toHaveAttribute('aria-pressed', 'true');
  await menuAction(page, 'save-as');
  await expect(page.locator('#save-plan')).toBeEnabled();
  await page.locator('#save-plan').click();
  await expect(page.locator('#name-error')).toContainText('Calculate / Apply');
  await page.locator('#close-name').click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#calculator button').click();
  await expect(page.locator('.round-total strong')).toHaveText('32');
  await expect(page.locator('#chart button[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('#palette-colors .palette-row')).toHaveCount(1);
});

test('preserves imported legacy selections on save, reload, and language changes', async ({ page }) => {
  await importInputs(page, { ip: 2, si: 8, sf: 16 });
  await expect(page.locator('#ip option[value="2"]')).toHaveText('2 (from current plan)');
  await expect(page.locator('#si')).toHaveValue('8');
  await expect(page.locator('#sf')).toHaveValue('16');
  await page.locator('#plan-status').click();
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Saved in this browser');
  await page.reload();
  await expect(page.locator('#ip')).toHaveValue('2');
  await expect(page.locator('#si')).toHaveValue('8');
  await expect(page.locator('#sf')).toHaveValue('16');
  await page.locator('#language').selectOption('de');
  await expect(page.locator('#si option[value="8"]')).toHaveText('8 (aus aktuellem Plan)');
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'In diesem Browser gespeichert');
  await page.locator('#ip').selectOption('32');
  await expect(page.locator('#si')).toHaveValue('32');
  await expect(page.locator('#sf')).toHaveValue('160');
  await expect(page.locator('#si option[value="8"]')).toHaveCount(0);
  await expect(page.locator('#sf option[value="16"]')).toHaveCount(0);
});

test('retains larger imported counts and resets empty plans to the guided defaults', async ({ page }) => {
  await importInputs(page, { ip: 128, si: 256, sf: 512 });
  await expect(page.locator('#ip')).toHaveValue('128');
  await expect(page.locator('#si')).toHaveValue('256');
  await expect(page.locator('#sf')).toHaveValue('512');
  await page.locator('#show-plans').click();
  await expect(page.locator('#new-plan')).toBeEnabled();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#new-plan').click();
  await expect(page.locator('#ip')).toHaveValue('16');
  await expect(page.locator('#si')).toHaveValue('64');
  await expect(page.locator('#sf')).toHaveValue('160');
  await expect(page.locator('#ip option')).toHaveCount(4);
});
