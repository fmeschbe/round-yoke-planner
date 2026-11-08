import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { copyFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { menuAction, saveAs } from './plan-helper';

async function applyRounds(page: Page, initial: number, final: number) {
  await page.locator('#initialRounds').fill(String(initial));
  await page.locator('#finalRounds').fill(String(final));
  await page.locator('#calculator button[type="submit"]').click();
}

function cell(page: Page, round: number, column: number) {
  return page.locator(`#chart button[data-round="${round}"][data-column="${column}"]`);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('#segments').selectOption('4');
});

test('keeps continuous chart numbering and independent increase-section numbering', async ({ page }) => {
  await page.locator('#initialRounds').fill('2');
  await expect(page.locator('#chart tbody tr')).toHaveCount(24);
  await applyRounds(page, 2, 3);
  await expect(page.locator('.round-total strong')).toHaveText('29');
  await expect(page.locator('#chart-size')).toHaveText('40 columns x 29 rounds');
  await expect(page.locator('#chart .section-round').first()).toHaveText('I1');
  await expect(page.locator('#chart .section-round').nth(2)).toHaveText('Y1');
  await expect(page.locator('#chart .section-round').last()).toHaveText('F3');
  expect(await page.locator('#chart .increase-row').evaluateAll(rows => rows.map(row => row.getAttribute('data-round'))))
    .toEqual(['10', '18', '26']);
  await expect(page.locator('#chart tbody tr').first().locator('button:enabled')).toHaveCount(16);
  await expect(page.locator('#chart tbody tr').last().locator('button:enabled')).toHaveCount(40);
  await page.locator('#initialRounds').fill('4');
  await page.locator('#language').selectOption('de');
  await expect(page.locator('#initialRounds')).toHaveValue('4');
  await expect(page.locator('#chart .section-round').first()).toHaveText('A1');
  await expect(page.locator('#chart .section-round').nth(2)).toHaveText('P1');
  await expect(page.locator('#chart .section-round').last()).toHaveText('E3');
  await expect(page.locator('#chart tbody tr')).toHaveCount(29);
});

test('adds at the outer edges and confirms only the colors actually removed', async ({ page }) => {
  await applyRounds(page, 2, 3);
  await page.locator('#add-color').click();
  for (const [round, column] of [[1, 1], [2, 3], [3, 6], [27, 0], [29, 39]]) await cell(page, round, column).click();
  await applyRounds(page, 3, 4);
  for (const [round, column] of [[2, 1], [3, 3], [4, 6], [28, 0], [30, 39]])
    await expect(cell(page, round, column)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#initialRounds').fill('1');
  await page.locator('#finalRounds').fill('1');
  const canceled = page.waitForEvent('dialog');
  const cancelApply = page.locator('#calculator button[type="submit"]').click();
  const cancellation = await canceled;
  expect(cancellation.message()).toContain('2 colored stitches');
  await cancellation.dismiss();
  await cancelApply;
  await expect(page.locator('#chart tbody tr')).toHaveCount(31);
  const confirmed = page.waitForEvent('dialog');
  const confirmApply = page.locator('#calculator button[type="submit"]').click();
  await (await confirmed).accept();
  await confirmApply;
  await expect(page.locator('#chart button[aria-pressed="true"]')).toHaveCount(3);
  await expect(cell(page, 1, 3)).toHaveAttribute('aria-pressed', 'true');
  await expect(cell(page, 2, 6)).toHaveAttribute('aria-pressed', 'true');
  await expect(cell(page, 26, 0)).toHaveAttribute('aria-pressed', 'true');
  await applyRounds(page, 3, 4);
  await expect(cell(page, 2, 1)).toHaveAttribute('aria-pressed', 'false');
  await expect(cell(page, 30, 39)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#chart button[aria-pressed="true"]')).toHaveCount(3);
  await expect(page.locator('#preview .preview-stitches path[data-round="3"][data-column="3"]')).toHaveAttribute('fill', '#ba5365');
});

test('renders plain-only charts with equal stitch counts and rejects invalid counts', async ({ page }) => {
  await page.locator('#ip').selectOption('4');
  await page.locator('#si').selectOption('100');
  await page.locator('#sf').selectOption('100');
  await applyRounds(page, 2, 2);
  await expect(page.locator('#chart tbody tr')).toHaveCount(4);
  await expect(page.locator('#chart .increase-row, #chart .added-stitch')).toHaveCount(0);
  await expect(page.locator('#full-circle')).toBeEnabled();
  expect(await page.locator('#preview .preview-stitches path').first().evaluate(path => (path as SVGGraphicsElement).getBBox().height))
    .toBeGreaterThan(0);
  await expect(page.locator('#preview-description')).toContainText('arbitrary ring thickness');
  await applyRounds(page, -1, 2);
  await expect(page.locator('#initialRounds')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#initialRounds-error')).toContainText('nonnegative');
  await expect(page.locator('#chart tbody tr')).toHaveCount(4);
  await applyRounds(page, 2, 5000);
  await expect(page.locator('#calculation-error')).toContainText('5,000');
  await expect(page.locator('#chart tbody tr')).toHaveCount(4);
});

test('saves the counts, exports every row in offline HTML, and resets new plans', async ({ page, context }, info) => {
  await applyRounds(page, 20, 2);
  await page.locator('#add-color').click();
  await cell(page, 46, 39).click();
  await saveAs(page, 'Extra rounds');
  await page.reload();
  await expect(page.locator('#initialRounds')).toHaveValue('20');
  await expect(page.locator('#finalRounds')).toHaveValue('2');
  await expect(cell(page, 46, 39)).toHaveAttribute('aria-pressed', 'true');
  const jsonPending = page.waitForEvent('download');
  await menuAction(page, 'export-plan');
  const json = await jsonPending;
  const data = JSON.parse(await readFile((await json.path())!, 'utf8'));
  expect(data.inputs).toMatchObject({ initialRounds: 20, finalRounds: 2 });
  expect(data.cells).toMatchObject([{ round: 46, column: 39 }]);
  const htmlPending = page.waitForEvent('download');
  await menuAction(page, 'export-html');
  const html = await htmlPending;
  const path = info.outputPath('plain-rounds.html');
  await copyFile((await html.path())!, path);
  await menuAction(page, 'new-plan');
  await expect(page.locator('#initialRounds')).toHaveValue('0');
  await expect(page.locator('#finalRounds')).toHaveValue('0');
  await context.setOffline(true);
  const document = await context.newPage();
  await document.goto(pathToFileURL(path).href);
  await expect(document.locator('.chart-panel')).toHaveCount(2);
  await expect(document.locator('.chart tbody tr')).toHaveCount(46);
  await expect(document.locator('.chart .section-round').last()).toHaveText('F2');
  await expect(document.locator('.schedule tbody tr').first().locator('td')).toHaveText(['28', '8', '96']);
  await expect(document.locator('.schedule tbody tr').last().locator('td')).toHaveText(['44', '24', '160']);
  await expect(document.locator('.chart td[data-round="46"][data-column="39"]')).toHaveCSS('background-color', 'rgb(186, 83, 101)');
  await document.emulateMedia({ media: 'print' });
  expect(await document.locator('.chart tbody tr').first().evaluate(row => row.getBoundingClientRect().height))
    .toBeLessThanOrEqual(4.1 * 96 / 25.4);
  await document.close();
});
