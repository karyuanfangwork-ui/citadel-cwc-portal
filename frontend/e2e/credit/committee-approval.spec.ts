// frontend/e2e/credit/committee-approval.spec.ts
/**
 * LOS-020/022 — E2E: committee approval inbox
 */
import { test, expect } from '@playwright/test';
import { STATE_FILES } from './support/auth';


test.describe('LOS-020/022 — committee approval inbox', () => {
  test.use({ storageState: STATE_FILES.approver });

  test('My Approvals shows only actionable cases and explains exclusions', async ({ page }) => {
    await page.goto('/credit/approvals');
    await expect(page.getByRole('heading', { name: /my approvals/i }).first()).toBeVisible({ timeout: 10_000 });

    // The page must render its own content, not just the shell — this spec
    // passed throughout the period when My Approvals crashed into its error
    // boundary immediately after the heading appeared.
    await expect(
      page.getByText(/something went wrong/i),
      'My Approvals crashed into its error boundary.',
    ).toHaveCount(0);

    // Previously `if (count > 0) { ...assert... }`, which passed silently
    // whenever the disclosure was absent — including when it was absent because
    // the page had crashed.
    const disclosure = page.getByText(/applications? not shown/i);
    if (await disclosure.count() === 0) {
      test.skip(true, 'No exclusions for this identity in this seed — see sod-exclusions.spec.ts');
      return;
    }

    await disclosure.first().click();
    await expect(
      page.getByText(/authority|segregation of duties|already submitted a decision/i).first(),
      'An application was withheld without stating why.',
    ).toBeVisible({ timeout: 5_000 });
  });

  test('a returned application shows what changed since it was referred back', async ({ page }) => {
    // CreditApplicationList does not read a `state` query parameter. Select the
    // row by the state rendered in the list so this exercises the intended fixture.
    await page.goto('/credit/applications', { waitUntil: 'domcontentloaded' });

    const referredRow = page.locator('table tbody tr', { hasText: /referred back/i }).first();
    await expect(
      referredRow,
      'No REFERRED_BACK application. Run `npx tsx prisma/seed-credit.ts --demo --e2e`.',
    ).toBeVisible({ timeout: 15_000 });

    await referredRow.click();
    await expect(page).toHaveURL(/\/credit\/applications\/[0-9a-f-]{36}/, { timeout: 15_000 });
    await expect(page.getByText(/returned|referred back/i).first()).toBeVisible({ timeout: 10_000 });
  });
});