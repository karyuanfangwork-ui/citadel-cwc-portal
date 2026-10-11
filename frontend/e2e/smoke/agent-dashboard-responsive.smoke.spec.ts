import { expect, test } from '@playwright/test';
import { CREDIT_ANALYST, login } from '../credit/support/auth';

const viewports = [
  { name: 'wide desktop', width: 1440, height: 900 },
  { name: 'standard desktop', width: 1280, height: 720 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: '200 percent zoom equivalent', width: 640, height: 360 },
  { name: 'mobile', width: 390, height: 844 },
];

test.describe('Agent Dashboard responsive acceptance', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, CREDIT_ANALYST);
  });

  for (const viewport of viewports) {
    test(`dashboard remains usable at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/agent');
      await expect(page.getByRole('heading', { name: 'Agent Dashboard' })).toBeVisible();
      await expect(page.getByRole('searchbox', { name: 'Search tickets' })).toBeVisible();
      await expect(page.getByRole('tablist', { name: 'Request queues' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Ticket results' })).toBeVisible();

      const layout = await page.evaluate(() => ({
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
        tableOverflow: (() => {
          const table = document.querySelector('[aria-label="Ticket results"] table');
          const wrapper = table?.parentElement;
          return wrapper ? wrapper.scrollWidth - wrapper.clientWidth : -1;
        })(),
      }));
      expect(layout.pageOverflow).toBeLessThanOrEqual(1);
      if (viewport.width < 1080) expect(layout.tableOverflow).toBeGreaterThan(0);

      const pagination = page.getByRole('navigation', { name: 'Ticket pagination' });
      await pagination.scrollIntoViewIfNeeded();
      await expect(pagination).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next' })).toBeAttached();
      await page.screenshot({ path: testInfo.outputPath(`agent-dashboard-${viewport.name.replaceAll(' ', '-')}.png`), fullPage: true });
    });
  }
});
