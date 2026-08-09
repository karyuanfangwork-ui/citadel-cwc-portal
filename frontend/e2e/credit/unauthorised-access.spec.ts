// frontend/e2e/credit/unauthorised-access.spec.ts
/**
 * LOS-004/022 — E2E: credit access boundary
 */
import { test, expect } from '@playwright/test';

const NON_CREDIT_USER = process.env.E2E_NON_CREDIT_USER || 'user@helpdesk.com';
const NON_CREDIT_PASS = process.env.E2E_NON_CREDIT_PASS || 'password123';

test.describe('LOS-004/022 — credit access boundary', () => {
  test('a user without credit permissions cannot reach an application by direct URL', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(NON_CREDIT_USER);
    await page.getByLabel(/password/i).fill(NON_CREDIT_PASS);
    await page.getByRole('button', { name: /sign in|log ?in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 10_000 }).catch(() => {});

    // A well-formed but unauthorised application id must not render borrower PII
    await page.goto('/credit/applications/00000000-0000-0000-0000-000000000001');
    await expect(page.getByText(/not found|no access|forbidden|unauthori[sz]ed/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/NRIC|identity number/i)).toHaveCount(0);
  });
});