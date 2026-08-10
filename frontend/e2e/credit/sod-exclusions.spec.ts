import { test, expect } from '@playwright/test';
import { STATE_FILES } from './support/auth';

/**
 * LOS-020 / LOS-022 — Segregation of duties, proven in a browser.
 *
 * Every other credit spec runs as admin@test.local, which holds every credit
 * permission. That account cannot demonstrate segregation: it is never turned
 * away and never excluded. The audit recorded this as the one item keeping
 * LOS-022 from full closure — SOD was enforced in code and covered by
 * `sodEnforcement.test.ts` at the API, but no browser run ever exercised it.
 *
 * These specs use the two seeded identities that genuinely differ:
 *
 *   e2e-analyst@test.local   CREDIT_ANALYST   read/write/export, NO credit:approve
 *   e2e-approver@test.local  CREDIT_MANAGER   read/write/export AND credit:approve
 *
 * Run `npx tsx prisma/seed-credit.ts --e2e` (after `--demo`) first. That seed
 * also makes the approver the assigned RM on exactly one COMMITTEE_REVIEW
 * application, which is what makes the exclusion below observable at all.
 */

test.describe('LOS-020 — an analyst cannot reach the approval inbox', () => {
  test.use({ storageState: STATE_FILES.sodAnalyst });

  test('the approvals route is refused to a role without credit:approve', async ({ page }) => {
    await page.goto('/credit/approvals');

    // ProtectedRoute (requirePermission="credit:approve") redirects to '/'
    // rather than rendering a 403 page, so the assertion is that we did not
    // land on the approvals screen — checked two ways so a future change from
    // redirect to in-place denial still passes for the right reason.
    await expect(page).not.toHaveURL(/\/credit\/approvals/, { timeout: 10_000 });

    await expect(
      page.getByRole('heading', { name: /my approvals/i }),
      'A CREDIT_ANALYST reached the approval inbox. credit:approve is not being enforced at the route.',
    ).toHaveCount(0);
  });

  test('the analyst can still reach the applications they work on', async ({ page }) => {
    // The denial above must be about credit:approve specifically, not a broken
    // session or an account with no credit access at all. Without this, the
    // first test would pass just as happily against a logged-out browser.
    await page.goto('/credit/applications');

    await expect(page).toHaveURL(/\/credit\/applications/, { timeout: 10_000 });
    await expect(
      page.getByRole('heading', { name: /application/i }).first(),
      'The analyst cannot reach credit applications either — the session or the seed is wrong, ' +
      'so the approvals denial above proves nothing.',
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('LOS-020 — an approver sees the inbox, minus their own case', () => {
  test.use({ storageState: STATE_FILES.sodApprover });

  test('the approver reaches the inbox that the analyst was refused', async ({ page }) => {
    await page.goto('/credit/approvals');

    await expect(page).toHaveURL(/\/credit\/approvals/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /my approvals/i }).first())
      .toBeVisible({ timeout: 10_000 });
  });

  test('an application the approver is RM on is withheld, with the reason stated', async ({ page }) => {
    await page.goto('/credit/approvals');
    await expect(page.getByRole('heading', { name: /my approvals/i }).first())
      .toBeVisible({ timeout: 10_000 });

    // MyApprovals renders exclusions in a collapsed <details>. It must both
    // exist and name the reason — an inbox that silently drops the case is the
    // LOS-020 defect, not the fix.
    const disclosure = page.getByText(/applications? not shown/i);
    await expect(
      disclosure,
      'No exclusion disclosure. Either the approver is not the assigned RM on any ' +
      'COMMITTEE_REVIEW application (re-run the --e2e seed) or the inbox stopped reporting exclusions.',
    ).toBeVisible({ timeout: 10_000 });

    await disclosure.click();

    await expect(
      page.getByText(/segregation of duties.*assigned RM/i).first(),
      'The application was withheld without stating the SOD reason.',
    ).toBeVisible({ timeout: 5_000 });
  });
});
