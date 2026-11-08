import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function closeDialogs(page: Page): Promise<void> {
  await expect(page.locator('#show-plans')).toBeEnabled();
  for (const [dialog, close] of [
    ['name-dialog', 'close-name'], ['import-dialog', 'close-import'], ['plans-dialog', 'close-plans'],
  ]) {
    if (await page.locator(`#${dialog}`).isVisible()) await page.locator(`#${close}`).click();
  }
}

export async function openMenu(page: Page): Promise<void> {
  await closeDialogs(page);
  if (!await page.locator('#plan-menu').isVisible()) await page.locator('#show-plans').click();
  await expect(page.locator('#plan-menu')).toBeVisible();
}

export async function menuAction(page: Page, id: string): Promise<void> {
  await openMenu(page);
  await page.locator(`#${id}`).click();
  await expect(page.locator('#show-plans')).toBeEnabled();
}

export async function saveAs(page: Page, name: string): Promise<void> {
  await menuAction(page, 'save-as');
  await page.locator('#plan-name').fill(name);
  await page.locator('#save-plan').click();
  await expect(page.locator('#name-dialog')).toBeHidden();
}
