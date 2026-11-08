import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { catalogs } from '../src/i18n';
import { readFile } from 'node:fs/promises';

test.use({ locale: 'de-DE' });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

async function exportJSON(page: Page) {
  const pending = page.waitForEvent('download');
  await page.locator('#export-plan').click();
  const path = await (await pending).path();
  return JSON.parse(await readFile(path!, 'utf8'));
}

test('uses German browser preferences and translates instructions, accessibility labels, and static copy', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('combobox', { name: 'Sprache', exact: true })).toHaveValue('de');
  await expect(page.locator('#language option')).toHaveText(['🇬🇧', '🇩🇪', '🇳🇴']);
  await expect(page.getByRole('option', { name: 'Norsk (bokmål)', exact: true })).toHaveAttribute('value', 'nb');
  await expect(page.locator('.page-header')).not.toContainText('Sprache');
  await expect(page.getByRole('button', { name: 'Berechnen / Anwenden' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Strickschrift', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Scrollbare Strickschrift' })).toBeVisible();
  await expect(page.locator('#preview title')).toHaveText('Farbige Rundpassen-Vorschau');
  await expect(page.locator('#preview-description')).toContainText('keine physikalische Stricksimulation');
  await expect(page.locator('#chart-instructions')).toContainText('schematisch hinzugefügte Maschen');
  await expect(page.locator('#chart-instructions p')).toBeHidden();
  await page.getByRole('button', { name: 'Deine Pläne', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Deine Pläne' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aktuellen Plan als JSON exportieren' })).toBeVisible();
  await expect(page.locator('#new-plan-help')).toContainText('gespeicherte Kopien bleiben unverändert');

  const html = await (await page.request.get('/')).text();
  const missing = await page.evaluate(({ html, keys }) => {
    const document = new DOMParser().parseFromString(html, 'text/html');
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    const sources: string[] = [];
    while (walker.nextNode()) {
      if (walker.currentNode.parentElement?.closest('script, style')) continue;
      const text = walker.currentNode.textContent?.trim().replace(/\s+/g, ' ');
      if (text) sources.push(text);
    }
    for (const element of document.querySelectorAll('[aria-label], [title]')) {
      for (const attribute of ['aria-label', 'title']) {
        const text = element.getAttribute(attribute);
        if (text) sources.push(text);
      }
    }
    const unchanged = ['Round Yoke', 'English', 'Deutsch', 'Norsk (bokmål)', '🇬🇧', '🇩🇪', '🇳🇴', 'SI', 'IP', 'SF'];
    return sources.filter(text => !keys.includes(text) && !unchanged.includes(text));
  }, { html, keys: Object.keys(catalogs.en) });
  expect(missing).toEqual([]);
});

test('switches live without changing saved plan data, names, colors, preview settings, or save status', async ({ page }) => {
  await page.locator('#si').fill('8');
  await page.locator('#ip').fill('2');
  await page.locator('#sf').fill('16');
  await page.locator('#calculator button').click();
  await page.locator('#segments').selectOption('4');
  await page.locator('#add-color').click();
  await page.locator('#chart button[data-round="1"][data-column="0"]').click();
  await page.locator('#full-circle').click();
  await page.locator('#show-plans').click();
  await page.locator('#plan-name').fill('Meine Passe <b>rot</b>');
  await expect(page.locator('#save-plan')).toBeEnabled();
  await page.locator('#save-plan').click();
  await expect(page.locator('#plan-status')).toHaveText('In diesem Browser gespeichert');
  const before = await exportJSON(page);
  await page.locator('#close-plans').click();
  await page.locator('#preview-instructions summary').click();
  await page.locator('#language').selectOption('en');
  await expect(page.locator('#plan-status')).toHaveText('Saved in this browser');
  await expect(page.locator('#segments')).toHaveValue('4');
  await expect(page.locator('#visible-segments')).toHaveValue('4');
  await expect(page.locator('#chart button[data-round="1"][data-column="0"]')).toHaveAttribute('aria-label', /Round 1, column 1: color/);
  await expect(page.locator('#preview-instructions p').first()).toBeVisible();
  await expect(page.locator('#chart-instructions p')).toBeHidden();
  await page.locator('#show-plans').click();
  await expect(page.locator('#plan-name')).toHaveValue('Meine Passe <b>rot</b>');
  await expect(page.locator('#saved-plans option')).toHaveText('Meine Passe <b>rot</b>');
  expect({ ...await exportJSON(page), updatedAt: before.updatedAt }).toEqual(before);
  await page.locator('#close-plans').click();
  await page.locator('#language').selectOption('de');
  await expect(page.locator('#chart button[data-round="1"][data-column="0"]')).toHaveAttribute('aria-label', /Runde 1, Spalte 1: Farbe/);
  await expect(page.locator('#plan-status')).toHaveText('In diesem Browser gespeichert');
  await expect(page.locator('#preview .preview-stitches path[fill="#ba5365"]')).toHaveCount(4);
  await page.locator('#language').selectOption('nb');
  await expect(page.locator('#chart button[data-round="1"][data-column="0"]')).toHaveAttribute('aria-label', /Omgang 1, kolonne 1: farge/);
  await expect(page.locator('#plan-status')).toHaveText('Lagret i denne nettleseren');
  await page.locator('#show-plans').click();
  expect({ ...await exportJSON(page), updatedAt: before.updatedAt }).toEqual(before);
});

test('retains unapplied input and translates existing errors when switching language', async ({ page }) => {
  await page.locator('#ip').fill('3');
  await page.locator('#calculator button').click();
  await expect(page.locator('#ip-error')).toHaveText('Die Anzahl der Zunahmestellen muss gerade sein.');
  await page.locator('#language').selectOption('en');
  await expect(page.locator('#ip')).toHaveValue('3');
  await expect(page.locator('#ip')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#ip-error')).toHaveText('Increase points must be even.');
  await expect(page.locator('#plan-status')).toHaveText('Unsaved changes');
  await page.locator('#show-plans').click();
  await expect(page.locator('#save-plan')).toBeEnabled();
  await page.locator('#import-file').setInputFiles({
    name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{}'),
  });
  await expect(page.locator('#library-error')).toContainText('not a Round Yoke Planner document');
  await page.locator('#close-plans').click();
  await page.locator('#language').selectOption('de');
  await expect(page.locator('#plan-notice')).toContainText('kein Round-Yoke-Planner-Dokument');
  await expect(page.locator('#ip-error')).toHaveText('Die Anzahl der Zunahmestellen muss gerade sein.');
  await expect(page.locator('#ip')).toHaveValue('3');
  await page.locator('#language').selectOption('nb');
  await expect(page.locator('#plan-notice')).toContainText('ikke et Round Yoke Planner-dokument');
  await expect(page.locator('#ip-error')).toHaveText('Antallet økningspunkter må være et partall.');
});

test('localizes destructive confirmations and preserves unsaved work on cancellation', async ({ page }) => {
  await page.locator('#add-color').click();
  await page.locator('#chart button:not(:disabled)').first().click();
  const pending = page.waitForEvent('dialog');
  const changing = page.locator('#segments').selectOption('2');
  const confirmation = await pending;
  expect(confirmation.message()).toContain('wird dein Muster gelöscht');
  await confirmation.dismiss();
  await changing;
  await expect(page.locator('#segments')).toHaveValue('1');
  await expect(page.locator('#chart button[aria-pressed="true"]')).toHaveCount(1);
  await page.locator('#show-plans').click();
  const importing = page.waitForEvent('dialog');
  const creating = page.locator('#new-plan').click();
  const discard = await importing;
  expect(discard.message()).toContain('Gespeicherte Kopien bleiben unverändert');
  await discard.dismiss();
  await creating;
  await expect(page.locator('#plans-dialog')).toBeVisible();
  await expect(page.locator('#chart button[aria-pressed="true"]')).toHaveCount(1);
});

test('remembers manual selection across reload without saving or dirtying a plan', async ({ page }) => {
  await page.locator('#language').selectOption('en');
  await expect(page.locator('#plan-status')).toHaveText('Browser only - not saved');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#language')).toHaveValue('en');
  await expect(page.locator('#saved-plans option')).toHaveCount(0);
  await page.locator('#language').selectOption('de');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.locator('#language').selectOption('nb');
  await expect(page.locator('#plan-status')).toHaveText('Bare i nettleseren – ikke lagret');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'nb');
  await expect(page.locator('#language')).toHaveValue('nb');
});

test('keeps German mobile controls usable and works when preference storage is unavailable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Unavailable', 'SecurityError'); },
    });
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('#show-plans').click();
  await expect(page.getByRole('button', { name: 'Aktuellen Plan als JSON exportieren' })).toBeVisible();
  await page.locator('#close-plans').click();
  await page.locator('#language').selectOption('en');
  await expect(page.getByRole('button', { name: 'Your Plans', exact: true })).toBeVisible();
});

test.describe('Norwegian Bokmål', () => {
  test.use({ locale: 'nb-NO' });

  test('detects Norwegian and translates planner controls, instructions, and library actions', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'nb');
    await expect(page.getByRole('combobox', { name: 'Språk', exact: true })).toHaveValue('nb');
    await expect(page.getByRole('button', { name: 'Beregn / Bruk', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Strikkediagram', exact: true })).toBeVisible();
    await expect(page.locator('#preview title')).toHaveText('Fargelagt forhåndsvisning av et rundt bærestykke');
    await expect(page.locator('#chart-instructions')).toContainText('skjematisk tilføyde masker');
    await expect(page.locator('#preview-instructions p').first()).toBeHidden();
    await page.locator('#show-plans').click();
    await expect(page.getByRole('dialog', { name: 'Dine planer', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Eksporter gjeldende plan som JSON', exact: true })).toBeVisible();
    await expect(page.locator('#new-plan-help')).toContainText('lagrede kopier forblir uendret');
  });

  test('translates Norwegian confirmations and JSON validation while retaining current work', async ({ page }) => {
    await page.locator('#add-color').click();
    await page.locator('#chart button:not(:disabled)').first().click();
    await page.locator('#show-plans').click();
    const pending = page.waitForEvent('dialog');
    const creating = page.locator('#new-plan').click();
    const confirmation = await pending;
    expect(confirmation.message()).toContain('forkaste ulagrede endringer');
    await confirmation.dismiss();
    await creating;
    await page.locator('#import-file').setInputFiles({
      name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{'),
    });
    await expect(page.locator('#library-error')).toContainText('Filen inneholder ikke gyldig JSON');
    await expect(page.locator('#chart button[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('#plan-status')).toHaveText('Ulagrede endringer');
  });

  test('keeps flag-only selection and Norwegian content readable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 640 });
    await expect(page.locator('#language')).toBeVisible();
    await expect(page.locator('#language')).toHaveAttribute('title', 'Språk');
    await expect(page.locator('.page-header')).not.toContainText('Språk');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.locator('#show-plans').click();
    const bounds = await page.locator('#plans-dialog').boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    await page.locator('#close-plans').click();
    await page.locator('#language').selectOption('de');
    await expect(page.getByRole('combobox', { name: 'Sprache', exact: true })).toHaveValue('de');
    await page.locator('#language').selectOption('en');
    await expect(page.getByRole('combobox', { name: 'Language', exact: true })).toHaveValue('en');
  });
});
