// frontend/e2e/credit/approval-inbox.spec.ts
/**
 * LOS-022 — E2E: approval-inbox authority scoping (LOS-020)
 *
 * Prerequisite: seeded demo data + E2E_BASE_URL pointing at a running dev server.
 * Run:  npx playwright test --project=credit e2e/credit/approval-inbox.spec.ts
 */
import { test, expect } from '@playwright/test';
import { STATE_FILES } from './support/auth';


test.describe('Approval inbox — authority scoping', () => {
  test.use({ storageState: STATE_FILES.approver });

  test('shows the approval inbox without server error', async ({ page }) => {
    await page.goto('/credit/approvals');
    await expect(page.locator('h1, h2, h3').first()).toContainText(/approval/i, { timeout: 10_000 });

    // A heading alone proved nothing: the page rendered its shell, then the
    // card list threw in StateBadge and React swapped the body for the error
    // boundary. This spec passed for weeks against a page no user could use.
    await expect(
      page.getByText(/something went wrong/i),
      'The inbox crashed into its error boundary after rendering the heading.',
    ).toHaveCount(0);
  });

  test('excluded applications, when present, are named with a reason', async ({ page }) => {
    await page.goto('/credit/approvals');
    await expect(page.getByRole('heading', { name: /my approvals/i }).first())
      .toBeVisible({ timeout: 10_000 });

    // Previously: `if (await details.isVisible(...))` — a non-retrying guard
    // wrapped around the only assertion, so an inbox that had stopped rendering
    // exclusions entirely would still pass. isVisible() does not retry: on a
    // still-loading page it answers false, every time.
    //
    // Admin's exclusion set depends on seed state, so this spec asserts the
    // contract that must hold either way: zero exclusions, or exclusions that
    // each state a reason. sod-exclusions.spec.ts covers the guaranteed case.
    const details = page.locator('details');
    const count = await details.count();

    if (count === 0) {
      test.skip(true, 'Admin has no excluded applications in this seed — see sod-exclusions.spec.ts');
      return;
    }

    await details.first().click();
    const items = details.first().locator('li');
    await expect(items.first()).toBeVisible({ timeout: 5_000 });
    await expect(
      items.first(),
      'An application was withheld without stating why. LOS-020 requires the reason.',
    ).toContainText(/authority|segregation of duties|already submitted a decision/i);
  });
});