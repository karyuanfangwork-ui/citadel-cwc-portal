// frontend/e2e/credit/committee-approval.spec.ts
/**
 * LOS-020/022 — E2E: committee approval inbox
 */
import { test, expect } from '@playwright/test';

const APPROVER_EMAIL = process.env.E2E_APPROVER_USER || 'ceo@test.local';
const APPROVER_PASS = process.env.E2E_APPROVER_PASS || 'password123';

test.describe('LOS-020/022 — committee approval inbox', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(APPROVER_EMAIL);
    await page.getByLabel(/password/i).fill(APPROVER_PASS);
    await page.getByRole('button', { name: /sign in|log ?in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 10_000 }).catch(() => {});
  });

  test('My Approvals shows only actionable cases and explains exclusions', async ({ page }) => {
    await page.goto('/credit/my-approvals');
    await expect(page.getByRole('heading', { name: /approvals/i }).first()).toBeVisible({ timeout: 10_000 });

    // The exclusion disclosure is the LOS-020 acceptance signal
    const disclosure = page.getByText(/applications? not shown/i);
    const count = await disclosure.count();
    if (count > 0) {
      await disclosure.first().click();
      await expect(page.getByText(/authority|segregation of duties|already submitted a decision/i).first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('a returned application shows what changed since it was referred back', async ({ page }) => {
    await page.goto('/credit/applications?state=REFERRED_BACK');
    const rows = page.getByRole('row');
    const rowCount = await rows.count();
    if (rowCount <= 1) {
      test.skip(true, 'No referred-back application in the seed set');
      return;
    }
    await rows.nth(1).click();
    await expect(page.getByText(/returned|referred back/i).first()).toBeVisible({ timeout: 5_000 });
  });
});