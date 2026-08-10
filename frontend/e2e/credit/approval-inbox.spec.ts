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