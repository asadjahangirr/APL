import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { Project } from '../src/project/schema';

type FixtureWindow = Window & { authoredFixture: { snapshot: () => Project; unmount: () => void } };
async function fixture(page: Page) {
  await page.route(/\/src\/main\.tsx(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: 'export {};' }));
  await page.goto('/');
  await page.evaluate(async () => {
    const path = '/tests/fixtures/authored-controls.tsx';
    const { mountAuthoredControls } = await import(/* @vite-ignore */ path);
    const container = document.createElement('div'); document.body.append(container);
    (window as unknown as FixtureWindow).authoredFixture = mountAuthoredControls(container);
  });
  await expect(page.getByRole('heading', { name: 'A real, editable heading.' })).toBeVisible();
}
async function snapshot(page: Page) { return page.evaluate(() => (window as unknown as FixtureWindow).authoredFixture.snapshot()); }
async function headingAppearance(page: Page) {
  const project = await snapshot(page), section = project.pages[0].nodes.find(node => node.type === 'Section')!;
  const heading = section.children.find(node => node.type === 'Heading')!;
  return heading.props.appearance;
}
test('authored typography, spacing, image proportions and real contact fields respond at three screens', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await fixture(page); await mkdir('.artifacts/phase-3', { recursive: true });
  for (const { width, font, padding, imageRatio, contactFont } of [
    { width: 390, font: 32.123456789, padding: 20, imageRatio: 1.5, contactFont: 20 },
    { width: 768, font: 44, padding: 40, imageRatio: 1.5, contactFont: 20 },
    { width: 1440, font: 64, padding: 80, imageRatio: 2, contactFont: 24 },
  ]) {
    await page.setViewportSize({ width, height: 1100 });
    const heading = page.getByRole('heading', { name: 'A real, editable heading.' });
    await expect.poll(() => heading.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeCloseTo(font, 3);
    await expect(heading).toHaveCSS('letter-spacing', 'normal');
    await expect(heading).toHaveCSS('color', 'rgb(18, 52, 86)');
    await expect(page.locator('#c-introduction')).toHaveCSS('padding-left', padding + 'px');
    const image = await page.locator('[data-layout-node="authored-image"]').boundingBox();
    expect(image!.width / image!.height).toBeCloseTo(imageRatio, 2);
    await expect(page.getByRole('heading', { name: 'Let’s talk.' })).toHaveCSS('font-size', contactFont + 'px');
    await expect(page.getByRole('heading', { name: 'Let’s talk.' })).toHaveCSS('white-space', 'pre-line');
    await expect(page.getByRole('heading', { name: 'Let’s talk.' })).toHaveCSS('letter-spacing', 'normal');
    await expect(page.getByText('A working form keeps its real labels.', { exact: true })).toHaveCSS('white-space', 'pre-line');
    await expect(page.getByLabel('Your name', { exact: true })).toHaveCSS('border-radius', '8px');
    await expect(page.getByRole('button', { name: 'Send message' })).toHaveCSS('min-height', '48px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.artifacts/phase-3/authored-${width}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('appearance controls preserve precision, validate bounds and remove breakpoint overrides deliberately', async ({ page }) => {
  await fixture(page);
  await page.getByText('Heading appearance', { exact: true }).click();
  const screen = page.getByLabel('Heading appearance screen');
  const mobile = page.getByLabel('Heading appearance font size mobile', { exact: true });
  await mobile.focus(); await mobile.blur();
  expect((await headingAppearance(page))!.fontSize!.mobile).toBe(32.123456789);
  await screen.selectOption('desktop');
  const desktop = page.getByLabel('Heading appearance font size desktop', { exact: true });
  await desktop.fill('72'); await desktop.press('Enter');
  expect((await headingAppearance(page))!.fontSize).toEqual({ mobile: 32.123456789, tablet: 44, desktop: 72 });
  await desktop.fill(''); await desktop.press('Enter');
  expect((await headingAppearance(page))!.fontSize).toEqual({ mobile: 32.123456789, tablet: 44 });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('heading', { name: 'A real, editable heading.' })).toHaveCSS('font-size', '44px');
  await screen.selectOption('mobile');
  await mobile.fill('1001'); await mobile.press('Enter');
  await expect(page.getByRole('alert')).toHaveText('Font size: enter a number from 4 to 1000.');
  expect((await headingAppearance(page))!.fontSize!.mobile).toBe(32.123456789);
  await mobile.fill(''); await mobile.press('Enter');
  expect((await headingAppearance(page))!.fontSize).toBeUndefined();
  expect((await headingAppearance(page))!.color).toEqual({ mobile: '#123456' });
  await screen.selectOption('desktop'); await expect(desktop).toBeDisabled();
});

test('button actions and page chrome controls change real links without altering another page or shared settings', async ({ page }) => {
  await fixture(page);
  const original = await snapshot(page);
  const action = page.getByLabel('Button action type');
  await action.selectOption('url');
  const address = page.getByLabel('Button website address');
  await address.fill('javascript:alert(1)'); await address.press('Enter');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Get in touch' })).toHaveAttribute('href', '/about');
  await address.fill('https://example.com/work'); await address.press('Enter');
  const link = page.getByRole('link', { name: 'Get in touch' });
  await expect(link).toHaveAttribute('href', 'https://example.com/work');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await action.selectOption('phone'); await page.getByLabel('Button phone number').fill('+92 (300) 123-4567'); await page.getByLabel('Button phone number').press('Enter');
  await expect(link).toHaveAttribute('href', 'tel:+923001234567');
  await expect(link).not.toHaveAttribute('target');
  await action.selectOption('internal'); await expect(link).toHaveAttribute('href', '/about');
  await expect(page.locator('.site-header')).toHaveCount(0); await expect(page.locator('.site-footer')).toHaveCount(0);
  await page.getByRole('button', { name: 'Manage pages' }).click();
  await page.getByRole('button', { name: 'Edit Home page' }).click();
  await page.getByLabel('Show site header on this page').check(); await page.getByLabel('Show site footer on this page').check();
  await page.getByRole('button', { name: 'Save page' }).click();
  await expect(page.locator('.site-header')).toBeVisible(); await expect(page.locator('.site-footer')).toBeVisible();
  const changed = await snapshot(page);
  expect(changed.pages[0]).toMatchObject({ showHeader: true, showFooter: true });
  expect(changed.pages[1]).toEqual(original.pages[1]); expect(changed.shared).toEqual(original.shared);
});
