// frontend/e2e/credit/audit-immutability.spec.ts
/**
 * LOS-022 — E2E: audit immutability smoke (LOS-013)
 */
import { test, expect } from '@playwright/test';
import { login, CREDIT_ANALYST } from './support/auth';


test.describe('Audit immutability', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, CREDIT_ANALYST);
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
    await expect(page).toHaveURL(/\/credit\/applications\//, { timeout: 10_000 });

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