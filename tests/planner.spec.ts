import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { applyInputs } from './calculator-helper';

async function calculate(page: Page, si: string, ip: string, sf: string) {
  await applyInputs(page, { si: Number(si), ip: Number(ip), sf: Number(sf) });
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
  await expect(page.locator('#chart tbody tr').first()).toHaveAttribute('data-round', '1');
  await expect(page.locator('#chart tbody tr').last()).toHaveAttribute('data-round', '2');
  expect(await cell(page, 1, 0).evaluate(button => button.getBoundingClientRect().top))
    .toBeLessThan(await cell(page, 2, 0).evaluate(button => button.getBoundingClientRect().top));
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
  const remove = page.getByRole('button', { name: 'Remove color 1', exact: true });
  await expect(remove).toHaveText('');
  await expect(remove.locator('svg')).toHaveCount(1);
  const centers = await page.locator('.palette-row').evaluate(row => {
    return [...row.querySelectorAll('button, input')].map(control => {
      const rect = control.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });
  });
  expect(centers[0]).toBeCloseTo(centers[1], 1);
  expect(centers[0]).toBeCloseTo(centers[2], 1);
  await remove.click();
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
  await expect(page.locator('#library-error')).toContainText('divisible');
  await expect(cell(page, 1, 0)).toHaveAttribute('aria-pressed', 'true');
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#segments').selectOption('4');
  await expect(page.locator('#segments')).toHaveValue('1');
  await expect(cell(page, 1, 0)).toHaveAttribute('aria-pressed', 'true');
  page.once('dialog', dialog => dialog.dismiss());
  await calculate(page, '8', '2', '124');
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
  await page.keyboard.press('ArrowDown');
  await expect(cell(page, 2, 2)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(cell(page, 2, 2)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Home');
  await expect(cell(page, 2, 0)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(cell(page, 1, 0)).toBeFocused();
});

test('supports zero rows, oversized-chart feedback and fallback segment selection', async ({ page }) => {
  await calculate(page, '8', '2', '8');
  await expect(page.locator('.round-total strong')).toHaveText('0');
  await expect(page.locator('#chart')).toContainText('No rounds');
  await expect(page.locator('#preview')).toContainText('No rounds');
  await calculate(page, '2', '2', '20006');
  await expect(page.locator('#library-error')).toContainText('5,000');
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
  await expect(page.locator('#chart .increase-row')).toHaveCount(3);
  await expect(page.locator('#chart tr[data-round="1"]')).not.toHaveClass(/increase-row/);
  await expect(page.locator('#preview path[data-increase-round="1"]')).toHaveCount(0);
  await expect(page.locator('#preview path[data-increase-round="8"]')).toHaveCount(16);
  await calculate(page, '8', '2', '16');
  await page.locator('#segments').selectOption('4');
  const radii = await page.locator('#preview').evaluate(preview => {
    return [1, 2].map(round => {
      const path = preview.querySelector(`.preview-stitches path[data-round="${round}"][data-column="0"]`)!;
      const coordinates = path.getAttribute('d')!.split(' ');
      return Math.hypot(Number(coordinates[1]), Number(coordinates[2]));
    });
  });
  expect(radii[0]).toBeCloseTo(150);
  expect(radii[1]).toBeCloseTo(200);
});

test('marks schematic added stitches with thicker borders only on increase rounds', async ({ page }) => {
  await calculate(page, '64', '8', '96');
  await expect(page.locator('#chart tr[data-round="4"] .added-stitch')).toHaveCount(16);
  await expect(page.locator('#chart tr[data-round="8"] .added-stitch')).toHaveCount(16);
  await expect(page.locator('#chart tr[data-round="1"] .added-stitch')).toHaveCount(0);
  await expect(page.locator('#chart .no-stitch .added-stitch')).toHaveCount(0);
  await page.locator('#segments').selectOption('8');
  await expect(page.locator('#chart tr[data-round="4"] .added-stitch')).toHaveCount(2);
  await expect(page.locator('#chart tr[data-round="8"] .added-stitch')).toHaveCount(2);
  const added = page.locator('#chart .added-stitch').first();
  await expect(added).toHaveCSS('border-top-width', '2px');
  await expect(added).toHaveCSS('width', '26px');
  await expect(added).toHaveAttribute('title', /schematic added stitch/);
  await addColor(page);
  await added.click();
  await expect(added).toHaveAttribute('aria-pressed', 'true');
  await expect(added).toHaveAttribute('aria-label', /schematic added stitch/);
  await added.click();
  await expect(added).toHaveAttribute('aria-pressed', 'false');
  await expect(added).toHaveCSS('border-top-width', '2px');
  await expect(page.locator('#chart-instructions')).toContainText('Thicker borders mark schematic added stitches');
});

test('centers one or multiple visible sectors at six oclock', async ({ page }) => {
  await calculate(page, '8', '2', '16');
  await page.locator('#segments').selectOption('4');
  for (const visible of [1, 2, 3]) {
    await page.locator('#visible-segments').fill(String(visible));
    await page.locator('#visible-segments').blur();
    const geometry = await page.locator('#preview svg').evaluate(svg => {
      const paths = [...svg.querySelectorAll('.preview-stitches path[data-round="2"]')];
      const first = paths[0].getAttribute('d')!.split(' ').map(Number);
      const last = paths.at(-1)!.getAttribute('d')!.split(' ').map(Number);
      const start = Math.atan2(first[1], -first[2]);
      const end = Math.atan2(last[17], -last[18]) + Math.PI * 2;
      const bounds = (svg.querySelector('.preview-stitches') as SVGGraphicsElement).getBBox();
      return {
        midpoint: (start + end) / 2,
        centerX: bounds.x + bounds.width / 2,
        bottom: bounds.y + bounds.height,
      };
    });
    expect(geometry.midpoint).toBeCloseTo(Math.PI);
    expect(geometry.centerX).toBeCloseTo(0);
    expect(geometry.bottom).toBeCloseTo(200);
  }
});

test('centers dense partial previews and their increase markers consistently', async ({ page }) => {
  await calculate(page, '1000', '2', '1040');
  await expect(page.locator('#segments')).toHaveValue('4');
  await addColor(page, '#ff0000');
  await cell(page, 10, 259).click();
  await page.locator('#visible-segments').fill('2');
  await page.locator('#visible-segments').blur();
  await expect(page.locator('#preview svg')).toHaveAttribute('data-renderer', 'raster');
  const geometry = await page.locator('#preview image').evaluate(async image => {
    const source = new Image();
    source.src = image.getAttribute('href')!;
    await source.decode();
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(source, 0, 0);
    return {
      x: Number(image.getAttribute('x')),
      y: Number(image.getAttribute('y')),
      width: Number(image.getAttribute('width')),
      height: Number(image.getAttribute('height')),
      bottom: [...context.getImageData(Math.floor(source.width / 2), source.height - 1, 1, 1).data],
      center: [...context.getImageData(Math.floor(source.width / 2), Math.floor(source.height / 2), 1, 1).data],
    };
  });
  expect(geometry.x).toBeCloseTo(-200);
  expect(geometry.y).toBeCloseTo(0);
  expect(geometry.width).toBeCloseTo(400);
  expect(geometry.height).toBeCloseTo(200);
  expect(geometry.bottom).toEqual([255, 0, 0, 255]);
  expect(geometry.center[3]).toBe(0);
  const marker = await page.locator('#preview path[data-increase-round="10"]').getAttribute('d');
  const coordinates = marker!.split(' ');
  expect(Number(coordinates[1])).toBeGreaterThan(0);
  expect(Number(coordinates[2])).toBeCloseTo(0);
});

test('places collapsible instructions above each view without affecting the pattern', async ({ page }) => {
  await addColor(page);
  await cell(page, 1, 1).click();
  for (const view of ['chart', 'preview']) {
    const instructions = page.locator(`#${view}-instructions`);
    const text = instructions.locator('p').first();
    await expect(text).toBeHidden();
    await instructions.locator('summary').click();
    await expect(text).toBeVisible();
    expect(await instructions.evaluate(element => element.getBoundingClientRect().bottom))
      .toBeLessThanOrEqual(await page.locator(`#${view}`).evaluate(element => element.getBoundingClientRect().top));
    await instructions.locator('summary').click();
    await expect(text).toBeHidden();
    await expect(page.locator(`#${view}`)).toBeVisible();
    await expect(cell(page, 1, 1)).toHaveAttribute('aria-pressed', 'true');
    await instructions.locator('summary').click();
    await expect(text).toBeVisible();
  }
});

test('uses no remote runtime assets and does not autosave unsaved work', async ({ page, baseURL }) => {
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
  page.once('dialog', dialog => dialog.accept());
  await page.reload();
  await expect(page.locator('#palette-colors .palette-row')).toHaveCount(0);
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-pressed', 'false');
  expect(external).toEqual([]);
});
