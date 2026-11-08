import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { applyInputs } from './calculator-helper';
import { menuAction, saveAs } from './plan-helper';

function cell(page: Page, round: number, column: number) {
  return page.locator(`#chart button[data-round="${round}"][data-column="${column}"]`);
}
function slot(page: Page, round: number, column: number) {
  return cell(page, round, column).locator('..');
}
async function colors(page: Page) {
  await page.locator('#new-color').evaluate(input => {
    (input as HTMLInputElement).value = '#ff0000';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#add-color').click();
  await cell(page, 1, 0).click();
  await page.locator('#new-color').evaluate(input => {
    (input as HTMLInputElement).value = '#0000ff';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#add-color').click();
  await cell(page, 1, 3).click();
  await cell(page, 2, 3).click();
}
async function selectAll(page: Page) {
  await page.locator('#select-chart').click();
  await slot(page, 1, 0).click();
  await slot(page, 2, 3).click();
  await expect(page.locator('#chart td.selected')).toHaveCount(8);
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await applyInputs(page, { si: 8, ip: 2, sf: 16 });
  await page.locator('#segments').selectOption('4');
});

test('keeps the segment selector and icons in one compact row without visible supporting text', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const layout = await page.locator('.chart-controls').evaluate(toolbar => {
      const select = toolbar.querySelector('select')!.getBoundingClientRect();
      const icons = [...toolbar.querySelectorAll('button')].map(button => button.getBoundingClientRect());
      return {
        selectTop: select.top, selectBottom: select.bottom, icons: icons.map(icon => ({ top: icon.top, bottom: icon.bottom })),
        lastRight: icons.at(-1)!.right, toolbarRight: toolbar.getBoundingClientRect().right,
      };
    });
    for (const icon of layout.icons) {
      expect(icon.top).toBeLessThan(layout.selectBottom);
      expect(icon.bottom).toBeGreaterThan(layout.selectTop);
      expect(icon.bottom).toBeCloseTo(layout.icons[0].bottom);
    }
    expect(layout.lastRight).toBeLessThanOrEqual(layout.toolbarRight);
    const header = await page.locator('.chart-heading-actions').evaluate(actions => {
      const indicator = actions.querySelector('#chart-size')!.getBoundingClientRect();
      const expand = actions.querySelector('button')!.getBoundingClientRect();
      const heading = actions.parentElement!.firstElementChild!.getBoundingClientRect();
      return { headingTop: heading.top, indicatorRight: indicator.right, indicatorTop: indicator.top, indicatorBottom: indicator.bottom, expandLeft: expand.left, expandTop: expand.top, expandBottom: expand.bottom };
    });
    expect(header.expandLeft).toBeGreaterThan(header.indicatorRight);
    expect(header.expandTop).toBeLessThan(header.indicatorBottom);
    expect(header.expandBottom).toBeGreaterThan(header.indicatorTop);
    expect(header.expandTop).toBeCloseTo(header.headingTop);
    const dividers = await page.locator('.chart-controls').evaluate(toolbar => {
      const lines = [...toolbar.querySelectorAll('.chart-divider')].map(line => line.getBoundingClientRect());
      const select = toolbar.querySelector('select')!.getBoundingClientRect();
      const clear = toolbar.querySelector('#clear-chart')!.getBoundingClientRect();
      const selection = toolbar.querySelector('#select-chart')!.getBoundingClientRect();
      return { lines: lines.map(line => ({ left: line.left, right: line.right, height: line.height })), selectRight: select.right, clearLeft: clear.left, clearRight: clear.right, selectionLeft: selection.left };
    });
    expect(dividers.lines).toHaveLength(2);
    expect(dividers.lines[0].left).toBeGreaterThan(dividers.selectRight);
    expect(dividers.clearLeft).toBeGreaterThan(dividers.lines[0].right);
    expect(dividers.lines[1].left).toBeGreaterThan(dividers.clearRight);
    expect(dividers.selectionLeft).toBeGreaterThan(dividers.lines[1].right);
    for (const line of dividers.lines) expect(line.height).toBeGreaterThan(0);
    expect(await page.locator('#segment-description').evaluate(element => element.getBoundingClientRect().width)).toBe(1);
    expect(await page.locator('#chart-selection').evaluate(element => element.parentElement!.getBoundingClientRect().height)).toBe(1);
  }
});

test('expands the chart and palette, preserves editing, and restores focus on exit', async ({ page }) => {
  await page.locator('#expand-chart').click();
  await expect(page.locator('#chart-fullscreen')).toBeVisible();
  await expect(page.locator('#expand-chart')).toHaveAttribute('aria-label', 'Exit full-screen chart');
  await expect(page.locator('#chart-fullscreen #palette-colors')).toBeVisible();
  await page.locator('#add-color').click();
  await cell(page, 1, 0).click();
  await expect(cell(page, 1, 0)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#chart-fullscreen')).toBeHidden();
  await expect(page.locator('#expand-chart')).toBeFocused();
  await expect(cell(page, 1, 0)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#preview .preview-stitches path[data-round="1"][data-column="0"]')).toHaveAttribute('fill', '#ba5365');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#expand-chart').click();
  const box = await page.locator('#chart-fullscreen').boundingBox();
  expect(box!.width).toBe(390);
  expect(box!.height).toBe(844);
  await page.locator('#expand-chart').click();
  await expect(page.locator('#chart-fullscreen')).toBeHidden();
});

test('clears only placements after confirmation and keeps the palette and saved plan', async ({ page }) => {
  await colors(page);
  await saveAs(page, 'Chart editing');
  const canceled = page.waitForEvent('dialog');
  const cancelClick = page.locator('#clear-chart').click();
  expect((await canceled).message()).toContain('3 colored stitches');
  await (await canceled).dismiss();
  await cancelClick;
  await expect(page.locator('#chart button[aria-pressed="true"]')).toHaveCount(3);
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Saved in this browser');
  const accepted = page.waitForEvent('dialog');
  const clearClick = page.locator('#clear-chart').click();
  await (await accepted).accept();
  await clearClick;
  await expect(page.locator('#chart button[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('.palette-row')).toHaveCount(2);
  await expect(page.locator('#chart-size')).toHaveText('4 columns x 2 rounds');
  await expect(page.locator('#clear-chart')).toBeDisabled();
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Unsaved changes');
  await page.reload();
  await expect(page.locator('#chart button[aria-pressed="true"]')).toHaveCount(3);
});

test('selects blocked corners by pointer and supports keyboard selection, copy, and cut', async ({ page }) => {
  await colors(page);
  await saveAs(page, 'Keyboard selection');
  await page.locator('#select-chart').click();
  await slot(page, 1, 1).click();
  await slot(page, 2, 3).click();
  await expect(page.locator('#chart td.selected')).toHaveCount(6);
  await expect(slot(page, 1, 1)).toHaveClass(/selected/);
  await page.keyboard.press('Escape');
  await cell(page, 1, 0).focus();
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(page.locator('#chart td.selected')).toHaveCount(6);
  await page.keyboard.press('Control+c');
  await expect(page.locator('#paste-chart')).toBeEnabled();
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Saved in this browser');
  await page.keyboard.press('Control+v');
  await expect(page.locator('#plan-status')).toHaveAttribute('title', 'Saved in this browser');
  await page.keyboard.press('Control+x');
  await expect(cell(page, 1, 0)).toHaveAttribute('aria-pressed', 'false');
  await expect(cell(page, 1, 3)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.palette-row')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await cell(page, 1, 0).focus();
  await page.keyboard.press('Meta+v');
  await expect(cell(page, 1, 0)).toHaveCSS('background-color', 'rgb(255, 0, 0)');
});

test('pastes around blocked slots, clears copied blanks, and confirms exactly omitted colors', async ({ page }) => {
  await colors(page);
  await selectAll(page);
  await page.locator('#copy-chart').click();
  await page.locator('#paste-chart').click();
  const pending = page.waitForEvent('dialog');
  const pasting = slot(page, 1, 1).click();
  const cancellation = await pending;
  expect(cancellation.message()).toContain('2 colored stitches');
  await cancellation.dismiss();
  await pasting;
  await expect(page.locator('#chart button[aria-pressed="true"]')).toHaveCount(3);
  await expect(page.locator('#paste-chart')).toHaveAttribute('aria-pressed', 'true');
  const accepted = page.waitForEvent('dialog');
  const pasteClick = slot(page, 1, 1).click();
  await (await accepted).accept();
  await pasteClick;
  await expect(cell(page, 1, 2)).toHaveCSS('background-color', 'rgb(255, 0, 0)');
  await expect(cell(page, 1, 3)).toHaveAttribute('aria-pressed', 'false');
  await expect(cell(page, 2, 3)).toHaveAttribute('aria-pressed', 'false');
  await expect(cell(page, 1, 1)).toBeDisabled();
  await page.locator('#paste-chart').click();
  await slot(page, 1, 0).click();
  await expect(cell(page, 1, 3)).toHaveCSS('background-color', 'rgb(0, 0, 255)');
  await expect(cell(page, 2, 3)).toHaveCSS('background-color', 'rgb(0, 0, 255)');
  await expect(cell(page, 1, 2)).toHaveAttribute('aria-pressed', 'false');
});

test('keeps clipboard colors between plans and saves only the resulting editable pattern', async ({ page }) => {
  await colors(page);
  await selectAll(page);
  await page.locator('#copy-chart').click();
  const confirmation = page.waitForEvent('dialog');
  const creating = menuAction(page, 'new-plan');
  await (await confirmation).accept();
  await creating;
  await expect(page.locator('.palette-row')).toHaveCount(0);
  await expect(page.locator('#paste-chart')).toBeEnabled();
  await page.locator('#paste-chart').click();
  await slot(page, 1, 0).click();
  await expect(page.locator('.palette-row')).toHaveCount(2);
  await expect(cell(page, 1, 1)).toHaveCSS('background-color', 'rgb(255, 0, 0)');
  await expect(cell(page, 1, 6)).toHaveCSS('background-color', 'rgb(0, 0, 255)');
  await expect(cell(page, 2, 8)).toHaveCSS('background-color', 'rgb(0, 0, 255)');
  await expect(page.getByRole('button', { name: 'Select clear', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await saveAs(page, 'Pasted plan');
  await page.reload();
  await expect(cell(page, 1, 6)).toHaveCSS('background-color', 'rgb(0, 0, 255)');
  await expect(page.locator('#paste-chart')).toBeDisabled();
  await expect(page.locator('#chart td.selected')).toHaveCount(0);
});

test.describe('touch selection', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('selects a rectangle with two taps including blocked slots', async ({ page }) => {
    await page.locator('#select-chart').click();
    await slot(page, 1, 1).scrollIntoViewIfNeeded();
    const first = await slot(page, 1, 1).boundingBox();
    const last = await slot(page, 2, 3).boundingBox();
    await page.touchscreen.tap(first!.x + first!.width / 2, first!.y + first!.height / 2);
    await page.touchscreen.tap(last!.x + last!.width / 2, last!.y + last!.height / 2);
    await expect(page.locator('#chart td.selected')).toHaveCount(6);
    await expect(cell(page, 1, 1)).toBeDisabled();
    await expect(page.locator('#copy-chart')).toBeEnabled();
  });
});

test('selects a rectangle by dragging without painting and retains it when translating', async ({ page }) => {
  await colors(page);
  await page.locator('#select-chart').click();
  const first = await slot(page, 1, 0).boundingBox();
  const last = await slot(page, 2, 3).boundingBox();
  await page.mouse.move(first!.x + first!.width / 2, first!.y + first!.height / 2);
  await page.mouse.down();
  await page.mouse.move(last!.x + last!.width / 2, last!.y + last!.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('#chart td.selected')).toHaveCount(8);
  await expect(page.locator('#chart button[aria-pressed="true"]')).toHaveCount(3);
  await page.locator('#language').selectOption('de');
  await expect(page.locator('#chart td.selected')).toHaveCount(8);
  await expect(page.locator('#copy-chart')).toHaveAttribute('aria-label', 'Auswahl kopieren');
  await expect(page.locator('#chart-selection')).toContainText('Auswahl: Runden 1–2');
  await page.locator('#language').selectOption('nb');
  await expect(page.locator('#copy-chart')).toHaveAttribute('aria-label', 'Kopier utvalget');
  await cell(page, 1, 0).focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#chart td.selected')).toHaveCount(0);
});
