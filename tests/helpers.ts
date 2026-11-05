import type { Page } from '@playwright/test';
export async function openCollection(page: Page, name: string) {
  const action = page.getByRole('button', { name, exact: true });
  if (!await action.isVisible()) await page.locator('.content-menu > summary').click();
  await action.click();
}
