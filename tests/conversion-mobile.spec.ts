import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { newProject } from '../src/project/templates';
import { createStudioProject } from '../src/project/studio-document';
import { businessDesign } from '../src/conversion/demo';

test('guided conversion controls and comparison fit phone, tablet, and desktop screens', async ({ page }) => {
  test.setTimeout(120_000);
  await mkdir('.artifacts/phase-3', { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const studio = createStudioProject(newProject(), businessDesign());
  await page.locator('input[type="file"][accept=".json,.apl.json"]').setInputFiles({ name: 'responsive-conversion.apl.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(studio)) });
  await expect(page.getByRole('main', { name: 'Design workspace', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Convert to website', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Give your design a working life.' });
  const steps = review.getByRole('navigation', { name: 'Conversion steps' });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const step of ['Page', 'Structure', 'Connections', 'Review']) {
      await steps.getByRole('button', { name: new RegExp(`${step}$`) }).click();
      await expect(review.getByRole('button', { name: 'Close conversion', exact: true })).toBeVisible();
      const bounds = await review.evaluate(element => {
        const box = element.getBoundingClientRect();
        return { scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, overflow: Array.from(element.querySelectorAll<HTMLElement>('*')).flatMap(child => {
          const rect = child.getBoundingClientRect();
          return rect.width && (rect.right > box.right + 1 || rect.left < box.left - 1) ? [{ tag: child.tagName, class: child.className, text: child.textContent?.trim().slice(0, 100), left: rect.left, right: rect.right, width: rect.width, scrollWidth: child.scrollWidth, clientWidth: child.clientWidth }] : [];
        }).slice(0, 25) };
      });
      if (bounds.scrollWidth > bounds.clientWidth + 1) {
        await page.screenshot({ path: `.artifacts/phase-3/conversion-overflow-${width}-${step.toLowerCase()}.png` });
        await writeFile(`.artifacts/phase-3/conversion-overflow-${width}-${step.toLowerCase()}.json`, JSON.stringify(bounds, null, 2));
      }
      expect(bounds.scrollWidth <= bounds.clientWidth + 1, `${width}px ${step}: ${JSON.stringify(bounds)}`).toBe(true);
      expect(await page.locator('body').evaluate(element => element.scrollWidth <= window.innerWidth + 1)).toBe(true);
      expect(await review.locator('.conversion-main').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    }
    await page.screenshot({ path: `.artifacts/phase-3/conversion-controls-${width}.png` });
  }
  for (const input of await review.locator('.conversion-issue.warning input[type="checkbox"]').all()) await input.check();
  await review.getByRole('button', { name: 'Prepare comparison', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Conversion website comparison"]');
  await expect(frame.locator('h1')).toBeVisible({ timeout: 30_000 });
  await page.setViewportSize({ width: 390, height: 1000 });
  for (const width of [390, 768, 1280]) {
    await review.getByRole('button', { name: new RegExp(`(?:Mobile|Tablet|Desktop).*${width}`) }).click();
    await expect.poll(() => frame.locator('body').evaluate(element => ({ width: window.innerWidth, overflow: element.scrollWidth > window.innerWidth + 1 }))).toEqual({ width, overflow: false });
  }
  expect(await review.locator('.conversion-main').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: '.artifacts/phase-3/conversion-comparison-phone.png' });
  await review.getByRole('button', { name: 'Close conversion', exact: true }).click();
  expect(errors).toEqual([]);
});
