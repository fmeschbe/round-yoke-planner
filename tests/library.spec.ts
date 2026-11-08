import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { applyInputs } from './calculator-helper';

async function openPlans(page: Page) {
  if (!await page.locator('#plans-dialog').isVisible()) {
    await page.getByRole('button', { name: 'Your Plans', exact: true }).click();
  }
  await expect(page.locator('#plans-dialog')).toBeVisible();
  await expect(page.locator('#plans-dialog').getByRole('button', { name: 'Save plan', exact: true })).toBeEnabled();
}

async function closePlans(page: Page) {
  if (await page.locator('#plans-dialog').isVisible()) {
    await page.getByRole('button', { name: 'Close Your Plans', exact: true }).click();
  }
  await expect(page.locator('#plans-dialog')).toBeHidden();
}

async function example(page: Page, name = 'Winter yoke') {
  await closePlans(page);
  await applyInputs(page, { si: 8, ip: 2, sf: 16 });
  await page.locator('#segments').selectOption('4');
  await page.getByRole('button', { name: 'Add color', exact: true }).click();
  await page.locator('#chart button[data-round="1"][data-column="0"]').click();
  await openPlans(page);
  await page.locator('#plan-name').fill(name);
  await closePlans(page);
}

async function save(page: Page) {
  await openPlans(page);
  await page.locator('#plans-dialog').getByRole('button', { name: 'Save plan', exact: true }).click();
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Saved in this browser');
}

async function exported(page: Page) {
  await openPlans(page);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export current plan as JSON', exact: true }).click();
  const download = await pending;
  return JSON.parse(await readFile((await download.path())!, 'utf8'));
}

async function importJSON(page: Page, data: unknown) {
  await openPlans(page);
  await page.locator('#import-file').setInputFiles({
    name: 'yoke.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)),
  });
}

async function confirmAction(page: Page, action: () => Promise<unknown>, accept: boolean) {
  await openPlans(page);
  const pending = page.waitForEvent('dialog');
  const performed = action();
  const dialog = await pending;
  if (accept) await dialog.accept();
  else await dialog.dismiss();
  await performed;
  await expect(page.locator('#save-plan')).toBeEnabled();
}

function sample() {
  return {
    format: 'round-yoke-planner', version: 1, layoutModel: 'schematic-v1',
    id: 'sample-plan', name: 'Imported yoke', createdAt: 1000, updatedAt: 2000,
    inputs: { si: 8, ip: 2, sf: 16 }, segments: 4, visibleSegments: 2,
    background: '#fafafa', selected: 'red', colors: [{ id: 'red', value: '#ff0000' }],
    cells: [{ round: 1, column: 0, colorId: 'red' }],
  };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('prompts unnamed plans from the save shortcut and restores its focus on dismissal', async ({ page }) => {
  await page.getByRole('button', { name: 'Add color', exact: true }).click();
  await expect(page.locator('#plan-status > span[aria-hidden="true"]')).toHaveText('💾');
  await page.locator('.page-header').getByRole('button', { name: 'Save plan', exact: true }).click();
  await expect(page.locator('#plans-dialog')).toBeVisible();
  await expect(page.locator('#plan-name')).toBeFocused();
  expect(await page.locator('#plan-name').evaluate(input => {
    const name = input as HTMLInputElement;
    return name.selectionEnd! - name.selectionStart! === name.value.length;
  })).toBe(true);
  await expect(page.locator('#saved-plans option')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#plan-status')).toBeFocused();
  await page.locator('#plan-status').click();
  await page.locator('#plan-name').fill('Quick-save yoke');
  await page.locator('#plans-dialog').getByRole('button', { name: 'Save plan', exact: true }).click();
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Saved in this browser');
});

test('saves named and restored plans directly from the status button without opening the library', async ({ page }) => {
  await example(page);
  await page.locator('#plan-status').click();
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Saved in this browser');
  await expect(page.locator('#plan-status')).toBeDisabled();
  await expect(page.locator('#plans-dialog')).toBeHidden();
  await page.reload();
  await expect(page.locator('#plan-name')).toHaveValue('Winter yoke');
  const cell = page.locator('#chart button[data-round="1"][data-column="0"]');
  await cell.click();
  await page.locator('#plan-status').click();
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Saved in this browser');
  await expect(page.locator('#plans-dialog')).toBeHidden();
  await page.reload();
  await expect(cell).toHaveAttribute('aria-pressed', 'false');
});

test('saves imported names directly but asks for a name again for new empty plans', async ({ page }) => {
  await importJSON(page, sample());
  await expect(page.locator('#plans-dialog')).toBeHidden();
  await page.locator('#plan-status').click();
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Saved in this browser');
  await expect(page.locator('#plans-dialog')).toBeHidden();
  await openPlans(page);
  await expect(page.locator('#saved-plans option')).toHaveText(['Imported yoke']);
  await page.locator('#new-plan').click();
  await page.locator('#plan-status').click();
  await expect(page.locator('#plan-name')).toHaveValue('Untitled yoke');
  await expect(page.locator('#plan-name')).toBeFocused();
  await expect(page.locator('#saved-plans option')).toHaveCount(1);
});

test('keeps draft save errors visible outside the library and prompts for a cleared name', async ({ page }) => {
  await openPlans(page);
  await page.locator('#plan-name').fill('Draft yoke');
  await closePlans(page);
  await page.locator('#si').selectOption('32');
  await page.locator('#plan-status').click();
  await expect(page.locator('#plan-notice')).toContainText('Calculate / Apply');
  await expect(page.locator('#plans-dialog')).toBeHidden();
  await expect(page.locator('#saved-plans option')).toHaveCount(0);
  await openPlans(page);
  await page.locator('#plan-name').fill(' ');
  await closePlans(page);
  await page.locator('#plan-status').click();
  await expect(page.locator('#plan-name')).toBeFocused();
  await expect(page.locator('#saved-plans option')).toHaveCount(0);
});

test('saves manually and reopens the most recently saved snapshot on reload', async ({ page }) => {
  await example(page);
  await page.locator('#visible-segments').fill('2');
  await page.locator('#visible-segments').blur();
  await page.locator('#background').evaluate(input => {
    (input as HTMLInputElement).value = '#eeeeaa';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Unsaved changes');
  await expect(page.locator('#saved-plans option')).toHaveCount(0);
  await save(page);
  await page.reload();
  await expect(page.locator('#plan-name')).toHaveValue('Winter yoke');
  await expect(page.locator('#si')).toHaveValue('8');
  await expect(page.locator('#segments')).toHaveValue('4');
  await expect(page.locator('#visible-segments')).toHaveValue('2');
  await expect(page.locator('#background')).toHaveValue('#eeeeaa');
  const cell = page.locator('#chart button[data-round="1"][data-column="0"]');
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await cell.click();
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Unsaved changes');
  page.once('dialog', dialog => dialog.accept());
  await page.reload();
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Saved in this browser');
});

test('keeps named plans separate, renames on Save, and confirms deletion', async ({ page }) => {
  await example(page, 'First yoke');
  await save(page);
  const firstId = (await exported(page)).id;
  await page.getByRole('button', { name: 'New empty plan', exact: true }).click();
  await openPlans(page);
  await page.locator('#plan-name').fill('Second yoke');
  await save(page);
  const secondId = (await exported(page)).id;
  expect(secondId).not.toBe(firstId);
  await expect(page.locator('#saved-plans option')).toHaveCount(2);
  await page.locator('#saved-plans').selectOption(firstId);
  expect((await exported(page)).id).toBe(secondId);
  await page.getByRole('button', { name: 'Open plan', exact: true }).click();
  await expect(page.locator('#plan-name')).toHaveValue('First yoke');
  await expect(page.locator('#palette-colors .palette-row')).toHaveCount(1);
  await openPlans(page);
  await page.locator('#plan-name').fill('Renamed yoke');
  await save(page);
  expect((await exported(page)).id).toBe(firstId);
  await page.reload();
  await expect(page.locator('#plan-name')).toHaveValue('Renamed yoke');
  await openPlans(page);
  await page.locator('#saved-plans').selectOption(secondId);
  await confirmAction(page, () => page.getByRole('button', { name: 'Delete saved plan', exact: true }).click(), false);
  await expect(page.locator('#saved-plans option')).toHaveCount(2);
  await confirmAction(page, () => page.getByRole('button', { name: 'Delete saved plan', exact: true }).click(), true);
  await expect(page.locator('#saved-plans option')).toHaveCount(1);
  await expect(page.locator('#plan-name')).toHaveValue('Renamed yoke');
  await confirmAction(page, () => page.getByRole('button', { name: 'Delete saved plan', exact: true }).click(), true);
  await expect(page.locator('#saved-plans option')).toHaveCount(0);
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Unsaved changes');
  await expect(page.locator('#palette-colors .palette-row')).toHaveCount(1);
  page.once('dialog', dialog => dialog.accept());
  await page.reload();
  await expect(page.locator('#plan-name')).toHaveValue('Untitled yoke');
});

test('exports complete documents and imports colliding IDs as a new local plan', async ({ page }) => {
  await example(page, 'Original');
  await save(page);
  const original = await exported(page);
  expect(original).toMatchObject({
    format: 'round-yoke-planner', version: 1, layoutModel: 'schematic-v1',
    inputs: { si: 8, ip: 2, sf: 16 }, segments: 4,
  });
  original.name = '<b>Imported copy</b>';
  await importJSON(page, original);
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Unsaved changes');
  await expect(page.locator('#plan-name')).toHaveValue('<b>Imported copy</b>');
  await expect(page.locator('#saved-plans option')).toHaveCount(1);
  await save(page);
  const copy = await exported(page);
  expect(copy.id).not.toBe(original.id);
  expect(copy.cells).toEqual(original.cells);
  expect(copy.colors).toEqual(original.colors);
  await expect(page.locator('#saved-plans option')).toHaveCount(2);
  await expect(page.locator('#saved-plans option').first()).toHaveText('<b>Imported copy</b>');
  await expect(page.locator('#saved-plans b')).toHaveCount(0);
  await page.locator('#saved-plans').selectOption(original.id);
  await page.getByRole('button', { name: 'Open plan', exact: true }).click();
  await expect(page.locator('#plan-name')).toHaveValue('Original');
});

test('validates imports before discarding work and supports canceling valid imports', async ({ page }) => {
  await example(page);
  const painted = page.locator('#chart button[data-round="1"][data-column="0"]');
  await importJSON(page, { ...sample(), version: 99 });
  await expect(page.locator('#library-error')).toContainText('Unsupported plan version');
  await expect(painted).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#import-file').setInputFiles({
    name: 'oversized.json', mimeType: 'application/json', buffer: Buffer.alloc(1024 * 1024 + 1, ' '),
  });
  await expect(page.locator('#library-error')).toContainText('1 MiB');
  await expect(painted).toHaveAttribute('aria-pressed', 'true');
  await confirmAction(page, () => importJSON(page, sample()), false);
  await expect(page.locator('#plan-name')).toHaveValue('Winter yoke');
  await confirmAction(page, () => importJSON(page, sample()), true);
  await expect(page.locator('#plan-name')).toHaveValue('Imported yoke');
  await expect(page.locator('#background')).toHaveValue('#fafafa');
  await expect(page.locator('#saved-plans option')).toHaveCount(0);
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Unsaved changes');
});

test('warns before opening another plan or discarding unapplied inputs', async ({ page }) => {
  await example(page);
  await save(page);
  await closePlans(page);
  await page.getByRole('button', { name: 'Add color', exact: true }).click();
  await confirmAction(page, () => page.getByRole('button', { name: 'Open plan', exact: true }).click(), false);
  await expect(page.locator('#palette-colors .palette-row')).toHaveCount(2);
  await confirmAction(page, () => page.getByRole('button', { name: 'Open plan', exact: true }).click(), true);
  await expect(page.locator('#palette-colors .palette-row')).toHaveCount(1);
  await page.locator('#sf').selectOption('124');
  await openPlans(page);
  await page.locator('#plans-dialog').getByRole('button', { name: 'Save plan', exact: true }).click();
  await expect(page.locator('#library-error')).toContainText('Calculate / Apply');
  await confirmAction(page, () => page.getByRole('button', { name: 'New empty plan', exact: true }).click(), false);
  await expect(page.locator('#sf')).toHaveValue('124');
  await confirmAction(page, () => page.getByRole('button', { name: 'New empty plan', exact: true }).click(), true);
  await expect(page.locator('#sf')).toHaveValue('160');
});

test('keeps editing and exporting available when IndexedDB is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() { throw new DOMException('Browser storage is unavailable.', 'SecurityError'); },
    });
  });
  await page.reload();
  await expect(page.locator('#plan-notice')).toContainText('storage is unavailable');
  await expect(page.locator('#plan-notice')).toBeVisible();
  await example(page);
  await openPlans(page);
  await page.locator('#plans-dialog').getByRole('button', { name: 'Save plan', exact: true }).click();
  await expect(page.locator('#library-error')).toContainText('storage is unavailable');
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Unsaved changes');
  expect((await exported(page)).cells).toHaveLength(1);
});

test('reports quota failures without losing work or claiming a save', async ({ page }) => {
  await example(page);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => { throw new DOMException('Quota exhausted.', 'QuotaExceededError'); };
  });
  await openPlans(page);
  await page.locator('#plans-dialog').getByRole('button', { name: 'Save plan', exact: true }).click();
  await expect(page.locator('#library-error')).toContainText('Browser storage is full');
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Unsaved changes');
  expect((await exported(page)).cells).toHaveLength(1);
  page.once('dialog', dialog => dialog.accept());
  await page.reload();
  await expect(page.locator('#saved-plans option')).toHaveCount(0);
});

test('waits for transaction completion instead of claiming success on request success', async ({ page }) => {
  await example(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const request = original.call(this, value, key);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    };
  });
  await openPlans(page);
  await page.locator('#plans-dialog').getByRole('button', { name: 'Save plan', exact: true }).click();
  await expect(page.locator('#library-error')).toContainText('aborted');
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Unsaved changes');
  expect((await exported(page)).cells).toHaveLength(1);
  page.once('dialog', dialog => dialog.accept());
  await page.reload();
  await expect(page.locator('#saved-plans option')).toHaveCount(0);
});

test('preserves edits made while a save snapshot is in flight', async ({ page }) => {
  await example(page);
  await openPlans(page);
  await expect(page.locator('#plans-dialog').getByRole('button', { name: 'Save plan', exact: true })).toBeEnabled();
  await page.evaluate(() => {
    document.getElementById('save-plan')!.click();
    document.getElementById('close-plans')!.click();
    document.getElementById('add-color')!.click();
  });
  await expect(page.locator('#library-message')).toContainText('New changes remain unsaved');
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Unsaved changes');
  expect((await exported(page)).colors).toHaveLength(2);
  page.once('dialog', dialog => dialog.accept());
  await page.reload();
  await expect(page.locator('#palette-colors .palette-row')).toHaveCount(1);
});

test('explains persistent-storage permission without promising permanent backups', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', {
      value: { persist: async () => false },
    });
  });
  await page.reload();
  await openPlans(page);
  await page.getByText('About local storage and backups', { exact: true }).click();
  await page.getByRole('button', { name: 'Request persistent storage', exact: true }).click();
  await expect(page.locator('#library-message')).toContainText('not granted');
  await page.evaluate(() => {
    navigator.storage.persist = async () => true;
  });
  await page.getByRole('button', { name: 'Request persistent storage', exact: true }).click();
  await expect(page.locator('#library-message')).toContainText('Persistent storage granted');
  await expect(page.locator('#library-message')).toContainText('keep JSON backups');
});

test('opens Your Plans as a keyboard-accessible overlay without permanently occupying the page', async ({ page }) => {
  const dialog = page.getByRole('dialog', { name: 'Your Plans', exact: true });
  await expect(page.locator('#plans-dialog')).toBeHidden();
  await openPlans(page);
  await expect(dialog).toBeVisible();
  await expect(page.locator('#plan-name')).toBeFocused();
  await page.evaluate(() => document.getElementById('si')!.focus());
  await expect(page.locator('#plan-name')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#plans-dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Your Plans', exact: true })).toBeFocused();
  await openPlans(page);
  await page.locator('#plan-name').fill('My draft');
  await closePlans(page);
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Unsaved changes');
  await openPlans(page);
  await expect(page.locator('#plan-name')).toHaveValue('My draft');
});

test('offers empty and JSON creation and explains that imported data replaces the current editor', async ({ page }) => {
  await example(page);
  await openPlans(page);
  await expect(page.getByRole('button', { name: 'New empty plan', exact: true })).toBeVisible();
  await expect(page.locator('#new-plan-help')).toContainText('replace the current plan in the editor');
  await expect(page.locator('#new-plan-help')).toContainText('saved copies stay untouched');
  const pending = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New plan from JSON', exact: true }).click();
  const chooser = await pending;
  await confirmAction(page, () => chooser.setFiles({
    name: 'yoke.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(sample())),
  }), true);
  await expect(page.locator('#plans-dialog')).toBeHidden();
  await expect(page.locator('#plan-name')).toHaveValue('Imported yoke');
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Unsaved changes');
  await expect(page.locator('#saved-plans option')).toHaveCount(0);
});

test('keeps the overlay inside a small viewport and scrolls its contents', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await openPlans(page);
  const bounds = await page.locator('#plans-dialog').evaluate(dialog => {
    const rect = dialog.getBoundingClientRect();
    return {
      left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
      scrollable: dialog.scrollHeight > dialog.clientHeight,
    };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(390);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(500);
  expect(bounds.scrollable).toBe(true);
  await closePlans(page);
});
