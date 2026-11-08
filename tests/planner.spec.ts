import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

async function calculate(page: Page, si: string, ip: string, sf: string) {
  await page.locator('#si').fill(si);
  await page.locator('#ip').fill(ip);
  await page.locator('#sf').fill(sf);
  await page.getByRole('button', { name: 'Calculate / Apply' }).click();
}

async function addColor(page: Page, hex = '#ba5365') {
  await setColor(page.locator('#new-color'), hex);
  await page.getByRole('button', { name: 'Add color', exact: true }).click();
}

async function setColor(input: Locator, value: string) {
  await input.evaluate((element, hex) => {
    (element as HTMLInputElement).value = hex;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

function cell(page: Page, round: number, column: number) {
  return page.locator(`#chart button[data-round="${round}"][data-column="${column}"]`);
}

function previewCell(page: Page, round: number, column: number) {
  return page.locator(`#preview .preview-stitches path[data-round="${round}"][data-column="${column}"]`);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('calculates rounds, filters segments, and only allows real stitch cells', async ({ page }) => {
  await calculate(page, '8', '2', '16');
  await expect(page.locator('.round-total strong')).toHaveText('2');
  await expect(page.locator('#segments option')).toHaveText(['1 segment', '2 segments', '4 segments']);
  await page.locator('#segments').selectOption('4');
  await expect(page.locator('#chart-size')).toHaveText('4 columns x 2 rounds');
  await expect(page.locator('#chart tbody tr').first()).toHaveAttribute('data-round', '2');
  await expect(cell(page, 1, 1)).toBeDisabled();
  await expect(cell(page, 1, 0)).toBeEnabled();
  await expect(page.locator('#chart .increase-row')).toHaveCount(2);
  await expect(page.locator('#chart .increase-point')).toHaveCount(2);
});

test('paints, toggles, replaces, clears and repeats the preview', async ({ page }) => {
  await calculate(page, '8', '2', '16');
  await page.locator('#segments').selectOption('4');
  await addColor(page);
  await cell(page, 1, 0).click();
  await expect(previewCell(page, 1, 0)).toHaveAttribute('fill', '#ba5365');
  await cell(page, 1, 0).click();
  await expect(previewCell(page, 1, 0)).toHaveAttribute('fill', '#ffffff');
  await cell(page, 1, 0).click();
  await addColor(page, '#336699');
  await cell(page, 1, 0).click();
  await expect(previewCell(page, 1, 0)).toHaveAttribute('fill', '#336699');
  await page.getByRole('button', { name: 'Full circle', exact: true }).click();
  await expect(previewCell(page, 1, 0)).toHaveCount(4);
  for (const path of await previewCell(page, 1, 0).all()) {
    await expect(path).toHaveAttribute('fill', '#336699');
  }
  await page.getByRole('button', { name: 'Select clear', exact: true }).click();
  await cell(page, 1, 0).click();
  await expect(cell(page, 1, 0)).toHaveAttribute('aria-pressed', 'false');
});

test('editing and removing palette colors updates existing stitches', async ({ page }) => {
  await calculate(page, '8', '2', '16');
  await addColor(page);
  await cell(page, 1, 0).click();
  await cell(page, 2, 0).click();
  await setColor(page.getByLabel('Edit color 1', { exact: true }), '#123456');
  await expect(previewCell(page, 1, 0)).toHaveAttribute('fill', '#123456');
  await expect(previewCell(page, 2, 0)).toHaveAttribute('fill', '#123456');
  await page.getByRole('button', { name: 'Remove color 1', exact: true }).click();
  await expect(cell(page, 1, 0)).toHaveAttribute('aria-pressed', 'false');
  await expect(cell(page, 2, 0)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Select clear', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await setColor(page.locator('#background'), '#eeeeaa');
  await expect(previewCell(page, 1, 0)).toHaveAttribute('fill', '#eeeeaa');
});

test('confirms geometry changes, retains palette, and preserves invalid or identical submissions', async ({ page }) => {
  await calculate(page, '8', '2', '16');
  await addColor(page);
  await cell(page, 1, 0).click();
  await page.getByRole('button', { name: 'Calculate / Apply' }).click();
  await expect(cell(page, 1, 0)).toHaveAttribute('aria-pressed', 'true');
  await calculate(page, '8', '2', '15');
  await expect(page.locator('#sf')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#calculation-error')).toContainText('divisible');
  await expect(cell(page, 1, 0)).toHaveAttribute('aria-pressed', 'true');
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#segments').selectOption('4');
  await expect(page.locator('#segments')).toHaveValue('1');
  await expect(cell(page, 1, 0)).toHaveAttribute('aria-pressed', 'true');
  page.once('dialog', dialog => dialog.dismiss());
  await calculate(page, '8', '2', '20');
  await expect(page.locator('.round-total strong')).toHaveText('2');
  await expect(cell(page, 1, 0)).toHaveAttribute('aria-pressed', 'true');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#segments').selectOption('4');
  await expect(page.locator('#segments')).toHaveValue('4');
  await expect(cell(page, 1, 0)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Select color 1', exact: true })).toBeVisible();
});

test('uses keyboard navigation that skips inactive cells', async ({ page }) => {
  await calculate(page, '8', '2', '16');
  await page.locator('#segments').selectOption('4');
  await addColor(page);
  await cell(page, 1, 0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(cell(page, 1, 2)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(cell(page, 1, 2)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowUp');
  await expect(cell(page, 2, 2)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(cell(page, 2, 2)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Home');
  await expect(cell(page, 2, 0)).toBeFocused();
});

test('supports zero rows, oversized-chart feedback and fallback segment selection', async ({ page }) => {
  await calculate(page, '8', '2', '8');
  await expect(page.locator('.round-total strong')).toHaveText('0');
  await expect(page.locator('#chart')).toContainText('No rounds');
  await expect(page.locator('#preview')).toContainText('No rounds');
  await calculate(page, '2', '2', '20006');
  await expect(page.locator('#calculation-error')).toContainText('5,000');
  await expect(page.locator('.round-total strong')).toHaveText('0');
  await calculate(page, '4998', '2', '5002');
  await expect(page.locator('#segments')).toHaveValue('2');
  await expect(page.locator('#segments option[value="1"]')).toBeDisabled();
  await expect(page.locator('#chart-size')).toHaveText('2501 columns x 1 rounds');
});

test('renders dense full-circle previews without unbounded SVG cells', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await calculate(page, '1000', '2', '1024');
  await expect(page.locator('#segments')).toHaveValue('2');
  await page.locator('#segments').selectOption('4');
  await addColor(page, '#ff0000');
  await cell(page, 6, 0).click();
  await page.getByRole('button', { name: 'Full circle', exact: true }).click();
  await expect(page.locator('#preview svg')).toHaveAttribute('data-renderer', 'raster');
  await expect(page.locator('#preview image')).toHaveAttribute('href', /^data:image\/png;base64,/);
  const pixel = await page.locator('#preview image').evaluate(async image => {
    const source = new Image();
    source.src = image.getAttribute('href')!;
    await source.decode();
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(source, 0, 0);
    return [...context.getImageData(Math.floor(source.width / 2), 0, 1, 1).data];
  });
  expect(pixel).toEqual([255, 0, 0, 255]);
  await expect(page.locator('#preview path')).toHaveCount(12);
  page.once('dialog', dialog => dialog.accept());
  await calculate(page, '8', '2', '8');
  await setColor(page.locator('#background'), '#000000');
  expect(errors).toEqual([]);
});

test('rejects invalid visible counts and preserves painting when changing visibility', async ({ page }) => {
  await calculate(page, '8', '2', '16');
  await page.locator('#segments').selectOption('4');
  await addColor(page);
  await cell(page, 1, 0).click();
  await page.locator('#visible-segments').fill('5');
  await page.locator('#visible-segments').blur();
  await expect(page.locator('#visible-segments')).toHaveValue('1');
  await expect(page.locator('#visible-error')).toContainText('1 to 4');
  await page.locator('#visible-segments').fill('2');
  await page.locator('#visible-segments').blur();
  await expect(previewCell(page, 1, 0)).toHaveCount(2);
  await expect(cell(page, 1, 0)).toHaveAttribute('aria-pressed', 'true');
});

test('fits a narrow screen and keeps the chart scrollable with palette below', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Round Yoke', exact: true })).toBeVisible();
  const layout = await page.evaluate(() => {
    const chart = document.querySelector('#chart')!;
    const palette = document.querySelector('.palette')!;
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      scrollable: chart.scrollWidth > chart.clientWidth,
      paletteBelow: palette.getBoundingClientRect().top > chart.getBoundingClientRect().bottom,
    };
  });
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.scrollable).toBe(true);
  expect(layout.paletteBelow).toBe(true);
  await page.getByRole('button', { name: 'Add color', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select color 1', exact: true })).toBeVisible();
});

test('shows increase markers only on increase rounds and preserves annular orientation', async ({ page }) => {
  await expect(page.locator('#chart .increase-row')).toHaveCount(6);
  await expect(page.locator('#chart tr[data-round="1"]')).not.toHaveClass(/increase-row/);
  await expect(page.locator('#preview path[data-increase-round="1"]')).toHaveCount(0);
  await expect(page.locator('#preview path[data-increase-round="4"]')).toHaveCount(8);
  await calculate(page, '8', '2', '16');
  await page.locator('#segments').selectOption('4');
  const radii = await page.locator('#preview').evaluate(preview => {
    return [1, 2].map(round => {
      const path = preview.querySelector(`.preview-stitches path[data-round="${round}"][data-column="0"]`)!;
      const coordinates = path.getAttribute('d')!.split(' ');
      return Math.hypot(Number(coordinates[1]), Number(coordinates[2]));
    });
  });
  expect(radii).toEqual([150, 200]);
});

test('uses no remote runtime assets or persistent plan storage', async ({ page, baseURL }) => {
  const external: string[] = [];
  page.on('request', request => {
    if (!request.url().startsWith(baseURL!) && !request.url().startsWith('data:')) external.push(request.url());
  });
  await page.reload();
  const layout = await page.evaluate(() => ({
    chartLeft: document.querySelector('.chart-panel')!.getBoundingClientRect().left,
    previewRight: document.querySelector('.preview-panel')!.getBoundingClientRect().right,
  }));
  expect(layout.chartLeft).toBeGreaterThan(layout.previewRight);
  await addColor(page);
  await cell(page, 1, 1).click();
  await page.reload();
  await expect(page.locator('#palette-colors .palette-row')).toHaveCount(0);
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-pressed', 'false');
  expect(external).toEqual([]);
});
