import { expect, test } from '@playwright/test';
import type { BrowserContext, Page, TestInfo } from '@playwright/test';
import { copyFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { importInputs } from './calculator-helper';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

async function openPlans(page: Page) {
  if (!await page.locator('#plans-dialog').isVisible()) await page.locator('#show-plans').click();
  await expect(page.locator('#export-html')).toBeEnabled();
}

async function downloadedPage(page: Page, context: BrowserContext, info: TestInfo) {
  await openPlans(page);
  const pending = page.waitForEvent('download');
  await page.locator('#export-html').click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.html$/);
  const path = info.outputPath('plan.html');
  await copyFile((await download.path())!, path);
  await context.setOffline(true);
  const document = await context.newPage();
  const remote: string[] = [];
  document.on('request', request => {
    if (/^https?:/.test(request.url())) remote.push(request.url());
  });
  await document.goto(pathToFileURL(path).href);
  expect(remote).toEqual([]);
  return document;
}

for (const [locale, printButton, legend] of [
  ['en', 'Print / Save as PDF', 'Palette legend'],
  ['de', 'Drucken / Als PDF speichern', 'Farblegende'],
  ['nb', 'Skriv ut / Lagre som PDF', 'Fargeoversikt'],
] as const) {
  test(`downloads an offline, escaped ${locale} document matching the current colored plan`, async ({ page, context }, info) => {
    await importInputs(page, { si: 8, ip: 2, sf: 16 });
    await page.locator('#segments').selectOption('4');
    await page.locator('#add-color').click();
    await page.locator('#chart button[data-round="1"][data-column="0"]').click();
    await page.locator('#background').evaluate(element => {
      (element as HTMLInputElement).value = '#f4e6aa';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('#visible-segments').fill('2');
    await page.locator('#visible-segments').blur();
    await page.locator('#language').selectOption(locale);
    await openPlans(page);
    const name = '<script>window.hacked=1</script> & "Rød"';
    await page.locator('#plan-name').fill(name);
    const document = await downloadedPage(page, context, info);
    await expect(document.locator('html')).toHaveAttribute('lang', locale);
    await expect(document.locator('h1')).toHaveText(name);
    expect(await document.evaluate(() => (window as unknown as { hacked?: number }).hacked)).toBeUndefined();
    await expect(document.locator('script, img')).toHaveCount(0);
    await expect(document.getByRole('button', { name: printButton, exact: true })).toBeVisible();
    await expect(document.getByRole('heading', { name: legend, exact: true })).toBeVisible();
    await expect(document.locator('.legend li')).toHaveCount(2);
    await expect(document.locator('.legend')).toContainText('#ba5365');
    await expect(document.locator('.legend .swatch').first()).toHaveCSS('background-color', 'rgb(244, 230, 170)');
    await expect(document.locator('.inputs dd')).toHaveText(['2', '8', '16', '2']);
    await expect(document.locator('.metadata')).toContainText('schematic-v1');
    await expect(document.locator('.chart td[data-round="1"][data-column="0"]')).toHaveCSS('background-color', 'rgb(186, 83, 101)');
    await expect(document.locator('.chart .no-stitch')).toHaveCount(1);
    await expect(document.locator('.chart .added-stitch')).toHaveCount(2);
    expect(await document.locator('.chart .added-stitch').first().evaluate(cell =>
      parseFloat(getComputedStyle(cell).borderTopWidth))).toBeGreaterThanOrEqual(1.8);
    await expect(document.locator('.schedule tbody tr')).toHaveCount(2);
    await expect(document.locator('.preview .preview-stitches path[data-round="1"][data-column="0"]')).toHaveCount(2);
    await expect(page.locator('#saved-plans option')).toHaveCount(0);
    await document.close();
  });
}

test('embeds dense previews and splits wide charts without clipping or losing columns', async ({ page, context }, info) => {
  await importInputs(page, { si: 1000, ip: 2, sf: 1024 });
  await page.locator('#segments').selectOption('4');
  await page.locator('#full-circle').click();
  const document = await downloadedPage(page, context, info);
  await expect(document.locator('.preview svg')).toHaveAttribute('data-renderer', 'raster');
  await expect(document.locator('.preview image')).toHaveAttribute('href', /^data:image\/png;base64,/);
  await expect(document.locator('.chart-panel')).toHaveCount(7);
  await expect(document.locator('.chart-panel').first().locator('thead th').first()).toHaveText('Round');
  await expect(document.locator('.chart-panel').last().locator('thead th').last()).toHaveText('256');
  await expect(document.locator('.chart td')).toHaveCount(256 * 6);
  await document.emulateMedia({ media: 'print' });
  const dimensions = await document.locator('.chart-panel').evaluateAll(panels => panels.map(panel => ({
    width: panel.querySelector('table')!.getBoundingClientRect().width,
    height: panel.getBoundingClientRect().height,
    breakBefore: getComputedStyle(panel).breakBefore,
    breakInside: getComputedStyle(panel.querySelector('tbody tr')!).breakInside,
  })));
  for (const panel of dimensions) {
    expect(panel.width).toBeLessThanOrEqual(172 * 96 / 25.4);
    expect(panel.height).toBeLessThanOrEqual(220 * 96 / 25.4);
    expect(panel.breakBefore).toBe('page');
    expect(panel.breakInside).toBe('avoid');
  }
});

test('splits tall charts into numbered round bands with every slot represented once', async ({ page, context }, info) => {
  await importInputs(page, { si: 4, ip: 2, sf: 284 });
  await page.locator('#segments').selectOption('4');
  const document = await downloadedPage(page, context, info);
  await expect(document.locator('.chart-panel h3')).toHaveText(['Panel 1 of 4', 'Panel 2 of 4', 'Panel 3 of 4', 'Panel 4 of 4']);
  await expect(document.locator('.chart caption')).toHaveText([
    'Columns 1–40; rounds 1–40.', 'Columns 41–71; rounds 1–40.',
    'Columns 1–40; rounds 41–70.', 'Columns 41–71; rounds 41–70.',
  ]);
  const coordinates = await document.locator('.chart td').evaluateAll(cells =>
    cells.map(cell => `${(cell as HTMLElement).dataset.round}:${(cell as HTMLElement).dataset.column}`));
  expect(coordinates.length).toBe(4970);
  expect(new Set(coordinates).size).toBe(4970);
  await document.emulateMedia({ media: 'print' });
  for (const panel of await document.locator('.chart-panel').all()) {
    expect((await panel.boundingBox())!.height).toBeLessThanOrEqual(220 * 96 / 25.4);
  }
});

test('prints zero-round plans without inventing chart cells or preview stitches', async ({ page, context }, info) => {
  await importInputs(page, { si: 100, ip: 4, sf: 100 });
  const document = await downloadedPage(page, context, info);
  await expect(document.locator('.inputs dd')).toHaveText(['4', '100', '100', '0']);
  await expect(document.locator('.chart-panel, .preview svg')).toHaveCount(0);
  await expect(document.locator('body')).toContainText('No rounds to knit');
});

test('opens an isolated print view with a working native Print / Save as PDF button', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Open print view', exact: true })).toBeVisible();
  await expect(page.locator('#print-plan')).toHaveText('🖨️');
  const pending = page.waitForEvent('popup');
  await page.locator('#print-plan').click();
  const document = await pending;
  await expect(document.locator('h1')).toHaveText('Untitled yoke');
  expect(await document.evaluate(() => window.opener)).toBeNull();
  await document.evaluate(() => {
    window.print = () => { document.body.dataset.printCalled = 'true'; };
  });
  await document.getByRole('button', { name: 'Print / Save as PDF', exact: true }).click();
  await expect(document.locator('body')).toHaveAttribute('data-print-called', 'true');
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Browser only - not saved');
  await expect(page.locator('#saved-plans option')).toHaveCount(0);
});

test('reports unapplied drafts and popup blocking without discarding work or disabling HTML downloads', async ({ page }) => {
  await page.locator('#si').selectOption('32');
  await openPlans(page);
  await page.locator('#export-html').click();
  await expect(page.locator('#library-error')).toContainText('Calculate / Apply');
  await page.locator('#close-plans').click();
  await page.locator('#print-plan').click();
  await expect(page.locator('#plan-notice')).toContainText('Calculate / Apply');
  await page.locator('#calculator button').click();
  await page.evaluate(() => { window.open = () => null; });
  await page.locator('#print-plan').click();
  await expect(page.locator('#plan-notice')).toContainText('Allow pop-ups');
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Unsaved changes');
  await openPlans(page);
  const pending = page.waitForEvent('download');
  await page.locator('#export-html').click();
  expect((await pending).suggestedFilename()).toMatch(/\.html$/);
  await expect(page.locator('#saved-plans option')).toHaveCount(0);
});

test('produces A4 and US Letter PDFs with intact chart panels', async ({ page, browserName }, info) => {
  test.skip(browserName !== 'chromium', 'Playwright PDF generation is supported only by Chromium; other engines exercise print styles and the native print button.');
  const pending = page.waitForEvent('popup');
  await page.locator('#print-plan').click();
  const document = await pending;
  await expect(document.locator('.chart-panel')).toHaveCount(4);
  for (const format of ['A4', 'Letter'] as const) {
    const pdf = await document.pdf({ format, printBackground: true, path: info.outputPath(`plan-${format}.pdf`) });
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)!.length).toBe(6);
    expect(pdf.length).toBeGreaterThan(5000);
  }
});
