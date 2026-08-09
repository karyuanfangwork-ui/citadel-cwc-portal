// frontend/e2e/credit/unauthorised-access.spec.ts
/**
 * LOS-004/022 — E2E: credit access boundary
 */
import { test, expect } from '@playwright/test';
import { login, NON_CREDIT_USER } from './support/auth';


test.describe('LOS-004/022 — credit access boundary', () => {
  test('a user without credit permissions cannot reach an application by direct URL', async ({ page }) => {
    await login(page, NON_CREDIT_USER);

    // A well-formed but unauthorised application id must not render the credit
    // application view. The app satisfies this by routing the user away rather
    // than showing a denial page — either is acceptable; rendering the record
    // is not.
    await page.goto('/credit/applications/00000000-0000-0000-0000-000000000001');
    await expect(page).not.toHaveURL(/\/credit\/applications\/[0-9a-f-]{36}/, { timeout: 10_000 });

    // Whatever is rendered, no borrower PII may appear.
    await expect(page.getByText(/NRIC|identity number|passport no/i)).toHaveCount(0);
  });
});