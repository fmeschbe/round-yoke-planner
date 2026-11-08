import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { closeDialogs, menuAction, openMenu, saveAs } from './plan-helper';

function sample(name = 'Winter yoke') {
  return {
    format: 'round-yoke-planner', version: 1, layoutModel: 'schematic-v1',
    id: 'sample-plan', name, createdAt: 1000, updatedAt: 2000,
    inputs: { si: 8, ip: 2, sf: 16 }, segments: 4, visibleSegments: 2,
    background: '#fafafa', selected: 'red', colors: [{ id: 'red', value: '#ff0000' }],
    cells: [{ round: 1, column: 0, colorId: 'red' }],
  };
}

async function importJSON(page: Page, value: unknown) {
  await menuAction(page, 'import-plan');
  await page.locator('#import-file').setInputFiles({
    name: 'yoke.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)),
  });
  await expect(page.locator('#choose-json')).toBeEnabled();
}

async function saved(page: Page) {
  await closeDialogs(page);
  await page.locator('#plan-status').click();
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Saved in this browser');
}

async function exported(page: Page) {
  await openMenu(page);
  const pending = page.waitForEvent('download');
  await page.locator('#export-plan').click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

async function dropJSON(page: Page, value: unknown, count = 1) {
  await page.locator('#drop-zone').evaluate((zone, { body, count }) => {
    const transfer = new DataTransfer();
    for (let index = 0; index < count; index++) transfer.items.add(new File([body], `plan-${index}.json`, { type: 'application/json' }));
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  }, { body: JSON.stringify(value), count });
  await expect(page.locator('#choose-json')).toBeEnabled();
}

async function confirm(page: Page, operation: () => Promise<unknown>, accept: boolean) {
  const pending = page.waitForEvent('dialog');
  const performed = operation();
  const dialog = await pending;
  if (accept) await dialog.accept();
  else await dialog.dismiss();
  await performed;
  await expect(page.locator('#show-plans')).toBeEnabled();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('offers exactly seven menu actions with keyboard navigation and light dismissal', async ({ page }) => {
  await expect(page.locator('#show-plans')).toHaveText('☰');
  await expect(page.locator('#plan-menu')).toBeHidden();
  await openMenu(page);
  await expect(page.locator('#show-plans')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('menuitem')).toHaveText([
    'New plan', 'New plan from JSON', 'Load plan', 'Save as',
    'Export current plan as JSON', 'Download printable HTML', 'Manage plans',
  ]);
  await expect(page.locator('#new-plan')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#import-plan')).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.locator('#manage-plans')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#new-plan')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#show-plans')).toBeFocused();
  await expect(page.locator('#show-plans')).toHaveAttribute('aria-expanded', 'false');
  await openMenu(page);
  await page.locator('h1').click();
  await expect(page.locator('#plan-menu')).toBeHidden();
});

test('asks unnamed plans for a name through the same dialog as Save as', async ({ page }) => {
  await page.locator('#add-color').click();
  await expect(page.locator('#plan-status > span[aria-hidden="true"]')).toHaveText('💾');
  await page.locator('#plan-status').click();
  await expect(page.locator('#name-dialog')).toBeVisible();
  await expect(page.locator('#name-heading')).toHaveText('Save plan');
  await expect(page.locator('#plan-name')).toBeFocused();
  expect(await page.locator('#plan-name').evaluate(input => {
    const name = input as HTMLInputElement;
    return name.selectionEnd! - name.selectionStart! === name.value.length;
  })).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#plan-status')).toBeFocused();
  await page.locator('#plan-status').click();
  await page.locator('#plan-name').fill('Quick-save yoke');
  await page.locator('#save-plan').click();
  await expect(page.locator('#name-dialog')).toBeHidden();
  await expect(page.locator('#plan-status')).toBeDisabled();
  expect((await exported(page)).name).toBe('Quick-save yoke');
});

test('saves imported names directly and restores the latest saved plan without retaining unsaved edits', async ({ page }) => {
  await importJSON(page, sample());
  await page.locator('#background').evaluate(input => {
    (input as HTMLInputElement).value = '#eeeeaa';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await saved(page);
  await expect(page.locator('#name-dialog')).toBeHidden();
  await page.reload();
  await expect(page.locator('#plan-name')).toHaveValue('Winter yoke');
  await expect(page.locator('#si')).toHaveValue('8');
  await expect(page.locator('#segments')).toHaveValue('4');
  await expect(page.locator('#background')).toHaveValue('#eeeeaa');
  const cell = page.locator('#chart button[data-round="1"][data-column="0"]');
  await cell.click();
  page.once('dialog', dialog => dialog.accept());
  await page.reload();
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await cell.click();
  await saved(page);
  await page.reload();
  await expect(cell).toHaveAttribute('aria-pressed', 'false');
});

test('Save as creates a separate active copy and canceling does not rename or dirty the current plan', async ({ page }) => {
  await importJSON(page, sample('Original'));
  await saved(page);
  const original = await exported(page);
  await page.locator('#chart button[data-round="1"][data-column="0"]').click();
  await saveAs(page, 'Copy');
  const copy = await exported(page);
  expect(copy.id).not.toBe(original.id);
  expect(copy.name).toBe('Copy');
  expect(copy.cells).toEqual([]);
  await expect(page.locator('#saved-plans option')).toHaveCount(2);
  await menuAction(page, 'load-plan');
  await page.locator('#saved-plans').selectOption(original.id);
  await page.locator('#open-plan').click();
  expect((await exported(page)).cells).toEqual(original.cells);
  await menuAction(page, 'save-as');
  await expect(page.locator('#name-heading')).toHaveText('Save as');
  await expect(page.locator('#name-help')).toContainText('leaves the original untouched');
  await page.locator('#plan-name').fill('Canceled name');
  await page.locator('#close-name').click();
  expect((await exported(page)).name).toBe('Original');
  await expect(page.locator('#plan-status')).toBeDisabled();
});

test('manages inactive plans without replacing the editor and preserves the active pattern when deleting its saved copy', async ({ page }) => {
  await importJSON(page, sample('Original'));
  await saved(page);
  const original = await exported(page);
  await saveAs(page, 'Copy');
  const copy = await exported(page);
  await menuAction(page, 'manage-plans');
  await expect(page.locator('#library-heading')).toHaveText('Manage plans');
  await expect(page.locator('#open-plan')).toBeHidden();
  await page.locator('#saved-plans').selectOption(original.id);
  await page.locator('#rename-plan').click();
  await page.locator('#plan-name').fill('Renamed original');
  await page.locator('#save-plan').click();
  await expect(page.locator('#name-dialog')).toBeHidden();
  await expect(page.locator('#saved-plans')).toContainText('Renamed original');
  expect((await exported(page)).name).toBe('Copy');
  await menuAction(page, 'manage-plans');
  await page.locator('#saved-plans').selectOption(original.id);
  await confirm(page, () => page.locator('#delete-plan').click(), false);
  await expect(page.locator('#saved-plans option')).toHaveCount(2);
  await confirm(page, () => page.locator('#delete-plan').click(), true);
  await expect(page.locator('#saved-plans option')).toHaveCount(1);
  await page.locator('#saved-plans').selectOption(copy.id);
  await confirm(page, () => page.locator('#delete-plan').click(), true);
  await expect(page.locator('#saved-plans option')).toHaveCount(0);
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Unsaved changes');
  await expect(page.locator('#chart button[aria-pressed="true"]')).toHaveCount(1);
  expect((await exported(page)).name).toBe('Copy');
});

test('renaming the active saved plan keeps its unsaved pattern edits and updates its name', async ({ page }) => {
  await importJSON(page, sample());
  await saved(page);
  const before = await exported(page);
  await page.locator('#add-color').click();
  await menuAction(page, 'manage-plans');
  await page.locator('#rename-plan').click();
  await page.locator('#plan-name').fill('Renamed yoke');
  await page.locator('#save-plan').click();
  await expect(page.locator('#name-dialog')).toBeHidden();
  const after = await exported(page);
  expect(after.id).toBe(before.id);
  expect(after.name).toBe('Renamed yoke');
  expect(after.colors).toHaveLength(2);
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Unsaved changes');
  page.once('dialog', dialog => dialog.accept());
  await page.reload();
  await expect(page.locator('#plan-name')).toHaveValue('Renamed yoke');
  await expect(page.locator('#palette-colors .palette-row')).toHaveCount(1);
});

test('exports complete snapshots and imports colliding IDs under fresh identity with literal names', async ({ page }) => {
  await importJSON(page, sample('Original'));
  await saved(page);
  const original = await exported(page);
  await importJSON(page, { ...original, name: '<b>Imported copy</b>' });
  await expect(page.locator('#saved-plans option')).toHaveCount(1);
  await saved(page);
  const copy = await exported(page);
  expect(copy.id).not.toBe(original.id);
  expect(copy.cells).toEqual(original.cells);
  expect(copy.colors).toEqual(original.colors);
  await expect(page.locator('#saved-plans option')).toHaveCount(2);
  await expect(page.locator('#saved-plans b')).toHaveCount(0);
  await expect(page.locator('#saved-plans option').first()).toHaveText('<b>Imported copy</b>');
});

test('validates imports before confirmation and rejects oversized files without losing editor work', async ({ page }) => {
  await importJSON(page, sample());
  await importJSON(page, { ...sample(), version: 99 });
  await expect(page.locator('#import-error')).toContainText('Unsupported plan version');
  await page.locator('#import-file').setInputFiles({
    name: 'oversized.json', mimeType: 'application/json', buffer: Buffer.alloc(1024 * 1024 + 1, ' '),
  });
  await expect(page.locator('#import-error')).toContainText('1 MiB');
  await expect(page.locator('#chart button[aria-pressed="true"]')).toHaveCount(1);
  await page.locator('#close-import').click();
  expect((await exported(page)).name).toBe('Winter yoke');
});

test('supports drag/drop with discard confirmation and rejects multiple dropped files', async ({ page }) => {
  await importJSON(page, sample());
  await menuAction(page, 'import-plan');
  await expect(page.locator('#new-plan-help')).toContainText('saved copies stay untouched');
  await dropJSON(page, sample(), 2);
  await expect(page.locator('#import-error')).toContainText('Choose one JSON file');
  page.once('dialog', dialog => dialog.dismiss());
  await dropJSON(page, sample('Dropped plan'));
  await expect(page.locator('#import-dialog')).toBeVisible();
  await page.locator('#close-import').click();
  expect((await exported(page)).name).toBe('Winter yoke');
  await menuAction(page, 'import-plan');
  page.once('dialog', dialog => dialog.accept());
  await dropJSON(page, sample('Dropped plan'));
  await expect(page.locator('#import-dialog')).toBeHidden();
  expect((await exported(page)).name).toBe('Dropped plan');
  await expect(page.locator('#saved-plans option')).toHaveCount(0);
});

test('offers filesystem upload and leaves validated imported plans unsaved', async ({ page }) => {
  await menuAction(page, 'import-plan');
  const pending = page.waitForEvent('filechooser');
  await page.locator('#choose-json').click();
  await (await pending).setFiles({
    name: 'yoke.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(sample('Uploaded plan'))),
  });
  await expect(page.locator('#import-dialog')).toBeHidden();
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Unsaved changes');
  expect((await exported(page)).name).toBe('Uploaded plan');
});

test('warns before new or load discards edits, including unapplied calculator selections', async ({ page }) => {
  await importJSON(page, sample());
  await saved(page);
  await page.locator('#add-color').click();
  await menuAction(page, 'load-plan');
  await expect(page.locator('#rename-plan')).toBeHidden();
  await expect(page.locator('#delete-plan')).toBeHidden();
  await confirm(page, () => page.locator('#open-plan').click(), false);
  await expect(page.locator('#palette-colors .palette-row')).toHaveCount(2);
  await confirm(page, () => page.locator('#open-plan').click(), true);
  await expect(page.locator('#palette-colors .palette-row')).toHaveCount(1);
  await page.locator('#sf').selectOption('124');
  await confirm(page, () => menuAction(page, 'new-plan'), false);
  await expect(page.locator('#sf')).toHaveValue('124');
  await confirm(page, () => menuAction(page, 'new-plan'), true);
  await expect(page.locator('#sf')).toHaveValue('160');
  await expect(page.locator('#saved-plans option')).toHaveCount(1);
  await page.locator('#plan-status').click();
  await expect(page.locator('#plan-name')).toHaveValue('Untitled yoke');
});

test('keeps invalid naming and unapplied-draft errors in the relevant dialog without mutating the current name', async ({ page }) => {
  await importJSON(page, sample());
  await menuAction(page, 'save-as');
  await page.locator('#plan-name').fill(' ');
  await page.locator('#save-plan').click();
  await expect(page.locator('#name-error')).toBeVisible();
  await page.locator('#close-name').click();
  await page.locator('#sf').selectOption('124');
  await menuAction(page, 'save-as');
  await page.locator('#plan-name').fill('Unapplied copy');
  await page.locator('#save-plan').click();
  await expect(page.locator('#name-error')).toContainText('Calculate / Apply');
  await page.locator('#close-name').click();
  await menuAction(page, 'export-plan');
  await expect(page.locator('#plan-notice')).toContainText('Calculate / Apply');
  await page.locator('#sf').selectOption('16');
  expect((await exported(page)).name).toBe('Winter yoke');
});

test('keeps exporting available when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() { throw new DOMException('Browser storage is unavailable.', 'SecurityError'); },
    });
  });
  await page.reload();
  await expect(page.locator('#plan-notice')).toContainText('storage is unavailable');
  await importJSON(page, sample());
  await page.locator('#plan-status').click();
  await expect(page.locator('#plan-notice')).toContainText('storage is unavailable');
  expect((await exported(page)).cells).toHaveLength(1);
  await menuAction(page, 'load-plan');
  await expect(page.locator('#library-error')).toContainText('storage is unavailable');
});

for (const failure of ['quota', 'abort']) {
  test(`does not claim a save or discard work after a ${failure} failure`, async ({ page }) => {
    await importJSON(page, sample());
    await page.evaluate(failure => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (value, key) {
        if (failure === 'quota') throw new DOMException('Quota exhausted.', 'QuotaExceededError');
        const request = original.call(this, value, key);
        request.addEventListener('success', () => this.transaction.abort());
        return request;
      };
    }, failure);
    await page.locator('#plan-status').click();
    await expect(page.locator('#plan-notice')).toContainText(failure === 'quota' ? 'Browser storage is full' : 'aborted');
    await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Unsaved changes');
    expect((await exported(page)).cells).toHaveLength(1);
    page.once('dialog', dialog => dialog.accept());
    await page.reload();
    await expect(page.locator('#saved-plans option')).toHaveCount(0);
  });
}

test('preserves edits made while a save snapshot is in flight', async ({ page }) => {
  await importJSON(page, sample());
  await page.evaluate(() => {
    document.getElementById('plan-status')!.click();
    document.getElementById('add-color')!.click();
  });
  await expect(page.locator('#library-message')).toContainText('New changes remain unsaved');
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Unsaved changes');
  expect((await exported(page)).colors).toHaveLength(2);
  page.once('dialog', dialog => dialog.accept());
  await page.reload();
  await expect(page.locator('#palette-colors .palette-row')).toHaveCount(1);
});

test('explains persistent-storage permission in Manage plans without promising permanent backups', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', { value: { persist: async () => false } });
  });
  await page.reload();
  await menuAction(page, 'manage-plans');
  await page.getByText('About local storage and backups', { exact: true }).click();
  await page.locator('#persist-storage').click();
  await expect(page.locator('#library-message')).toContainText('not granted');
  await page.evaluate(() => { navigator.storage.persist = async () => true; });
  await page.locator('#persist-storage').click();
  await expect(page.locator('#library-message')).toContainText('keep JSON backups');
});

test('keeps the menu and focused dialogs inside a small viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await openMenu(page);
  const checkBounds = async (selector: string) => {
    const bounds = (await page.locator(selector).boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(500);
  };
  await checkBounds('#plan-menu');
  for (const [action, dialog] of [
    ['load-plan', 'plans-dialog'], ['save-as', 'name-dialog'], ['import-plan', 'import-dialog'],
  ]) {
    await menuAction(page, action);
    await checkBounds(`#${dialog}`);
  }
});
