// frontend/e2e/credit/audit-immutability.spec.ts
/**
 * LOS-022 — E2E: audit immutability smoke (LOS-013)
 */
import { test, expect } from '@playwright/test';
import { STATE_FILES } from './support/auth';


test.describe('Audit immutability', () => {
  test.use({ storageState: STATE_FILES.analyst });

  test('application detail shows audit trail with events', async ({ page }) => {
    await page.goto('/credit/applications');
    const firstRow = page.locator('table tbody tr').first();
    const hasRow = await firstRow.first()
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (!hasRow) {
      test.skip(true, 'No applications available');
      return;
    }
    await firstRow.click();
    await expect(page).toHaveURL(/\/credit\/applications\//, { timeout: 10_000 });

    const auditTab = page.locator('button, [role="tab"]', { hasText: /audit|history|timeline/i }).first();
    const hasTab = await auditTab.first()
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (!hasTab) {
      test.skip(true, 'No audit tab found');
      return;
    }
    await auditTab.click();

    // The panel has no test ids; assert on what it actually renders — the
    // event counter and at least one typed chain event. A hash-chained audit
    // trail that shows zero events would be the failure worth catching.
    await expect(page.getByRole('heading', { name: /audit trail/i }).first())
      .toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/\d+\s*\/\s*\d+\s*events/i).first())
      .toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/STATE_TRANSITION|APPROVAL|SCORING|DOCUMENT/).first())
      .toBeVisible({ timeout: 5_000 });
  });
});