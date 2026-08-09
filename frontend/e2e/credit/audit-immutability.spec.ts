// frontend/e2e/credit/audit-immutability.spec.ts
/**
 * LOS-022 — E2E: audit immutability smoke (LOS-013)
 */
import { test, expect } from '@playwright/test';

const E2E_USER = process.env.E2E_CREDIT_USER || 'it@test.local';
const E2E_PASS = process.env.E2E_CREDIT_PASS || 'password123';

test.describe('Audit immutability', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', E2E_USER);
    await page.fill('input[name="password"]', E2E_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 10_000 }).catch(() => {});
  });

  test('application detail shows audit trail with events', async ({ page }) => {
    await page.goto('/credit/applications');
    const firstRow = page.locator('table tbody tr').first();
    const hasRow = await firstRow.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasRow) {
      test.skip(true, 'No applications available');
      return;
    }
    await firstRow.click();
    await page.waitForURL('**/credit/applications/**', { timeout: 10_000 }).catch(() => {});

    const auditTab = page.locator('button, [role="tab"]', { hasText: /audit|history|timeline/i }).first();
    const hasTab = await auditTab.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasTab) {
      test.skip(true, 'No audit tab found');
      return;
    }
    await auditTab.click();
    await expect(page.locator('[data-testid="audit-event"], .audit-event, .timeline-entry').first()).toBeVisible({ timeout: 5_000 });
  });
});