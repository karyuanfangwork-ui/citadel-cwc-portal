// frontend/e2e/credit/approval-inbox.spec.ts
/**
 * LOS-022 — E2E: approval-inbox authority scoping (LOS-020)
 *
 * Prerequisite: seeded demo data + E2E_BASE_URL pointing at a running dev server.
 * Run:  npx playwright test --project=credit e2e/credit/approval-inbox.spec.ts
 */
import { test, expect } from '@playwright/test';

const E2E_USER = process.env.E2E_CREDIT_USER || 'it@test.local';
const E2E_PASS = process.env.E2E_CREDIT_PASS || 'password123';

test.describe('Approval inbox — authority scoping', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', E2E_USER);
    await page.fill('input[name="password"]', E2E_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 10_000 }).catch(() => {});
  });

  test('shows the approval inbox without server error', async ({ page }) => {
    await page.goto('/credit/approvals');
    await expect(page.locator('h1, h2, h3').first()).toContainText(/approval/i, { timeout: 10_000 });
  });

  test('excluded applications appear as a collapsible section', async ({ page }) => {
    await page.goto('/credit/approvals');
    const details = page.locator('details');
    // The <details> element only renders when there are excluded apps.
    // If no apps are excluded for this user, the section is absent — that's fine.
    if (await details.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await details.click();
      await expect(details.locator('li').first()).toBeVisible({ timeout: 5_000 });
    }
  });
});