import { test, expect } from '@playwright/test';

test('column alignment changes unequal column positions and stretch height', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/#/new');
  await page.getByRole('button', { name: /Business \/ studio/ }).click();
  await page.getByRole('button', { name: 'Add layout', exact: true }).click();
  const labels = { start: 'Top', center: 'Center', stretch: 'Stretch to equal height' };

  for (const alignment of ['start', 'center', 'stretch'] as const) {
    await page.getByRole('list').getByText('Outline', { exact: true }).click();
    await page.getByRole('button', { name: 'Select Column group', exact: true }).click();
    await page.getByRole('combobox', { name: 'Align columns vertically', exact: true }).selectOption({ label: labels[alignment] });
    await page.getByRole('button', { name: /^Preview/ }).click();
    const preview = page.frameLocator('iframe[title="Website preview"]');
    const columns = preview.locator('.apl-column');
    await expect(columns).toHaveCount(2);
    const [copy, photograph] = await columns.evaluateAll(elements => elements.map(element => {
      const bounds = element.getBoundingClientRect();
      return { top: bounds.top, height: bounds.height, center: bounds.top + bounds.height / 2 };
    }));
    if (alignment === 'stretch') {
      expect(Math.abs(copy.height - photograph.height)).toBeLessThan(2);
      expect(Math.abs(copy.top - photograph.top)).toBeLessThan(2);
    } else {
      expect(photograph.height - copy.height).toBeGreaterThan(20);
      if (alignment === 'start') expect(Math.abs(copy.top - photograph.top)).toBeLessThan(2);
      else {
        expect(copy.top - photograph.top).toBeGreaterThan(10);
        expect(Math.abs(copy.center - photograph.center)).toBeLessThan(2);
      }
    }
    await page.getByRole('button', { name: /Back to editor/ }).click();
  }
});
