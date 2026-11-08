import { expect } from '@playwright/test';
import type { Dialog, Page } from '@playwright/test';
import { calculate } from '../src/yoke';
import type { Inputs } from '../src/yoke';

export async function importInputs(page: Page, inputs: Inputs): Promise<void> {
  let segments = 1;
  try {
    segments = calculate(inputs).segmentOptions.find(option => option.feasible)!.count;
  } catch {
    // Invalid fixtures exercise import validation instead of unavailable dropdown values.
  }
  if (!await page.locator('#plans-dialog').isVisible()) await page.locator('#show-plans').click();
  await expect(page.locator('#save-plan')).toBeEnabled();
  const accept = (dialog: Dialog) => void dialog.accept();
  page.on('dialog', accept);
  try {
    await page.locator('#import-file').setInputFiles({
      name: 'calculator.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        format: 'round-yoke-planner', version: 1, layoutModel: 'schematic-v1',
        id: 'calculator-fixture', name: 'Calculator fixture', createdAt: 1000, updatedAt: 2000,
        inputs, segments, visibleSegments: 1, background: '#ffffff',
        selected: null, colors: [], cells: [],
      })),
    });
    await expect(page.locator('#save-plan')).toBeEnabled();
  } finally {
    page.off('dialog', accept);
  }
  if (await page.locator('#plans-dialog').isVisible()) await page.locator('#close-plans').click();
}

export async function applyInputs(page: Page, inputs: Inputs): Promise<void> {
  for (const field of ['ip', 'si', 'sf'] as const) {
    if (!await page.locator(`#${field} option[value="${inputs[field]}"]`).count()) {
      await importInputs(page, inputs);
      return;
    }
    await page.locator(`#${field}`).selectOption(String(inputs[field]));
  }
  await page.locator('#calculator button').click();
}
