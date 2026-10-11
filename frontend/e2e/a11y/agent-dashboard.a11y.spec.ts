import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { CREDIT_ANALYST, login } from '../credit/support/auth';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

test.describe('Agent Dashboard accessibility acceptance', () => {
  for (const viewport of viewports) {
    test(`has accessible landmarks, controls, and no WCAG 2.1 AA violations at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await login(page, CREDIT_ANALYST);
      await page.goto('/agent');

      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Agent Dashboard', level: 1 })).toBeVisible();
      await expect(page.getByRole('searchbox', { name: 'Search tickets' })).toBeVisible();
      await expect(page.getByRole('tablist', { name: 'Request queues' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Ticket results' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Ticket pagination' })).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
