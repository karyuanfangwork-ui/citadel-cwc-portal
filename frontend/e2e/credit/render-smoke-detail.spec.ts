// frontend/e2e/credit/render-smoke-detail.spec.ts
import { test, expect, type Page } from '@playwright/test';
import { STATE_FILES } from './support/auth';

/**
 * Phase 8 — parameterised and mobile credit screens render.
 *
 * Companion to render-smoke.spec.ts. These routes need a record id, which is
 * discovered by clicking through the corresponding list page rather than
 * hardcoded — a hardcoded id rots the moment the seed changes, and a spec that
 * skips on a missing id proves nothing.
 *
 * The mobile routes are covered because MobileApprovalInbox consumes the same
 * untyped approval-inbox DTO that crashed the desktop page in LOS-020. If the
 * mapping bug was duplicated there, only a mobile-viewport run finds it.
 */

/** Assert the page rendered its own content, not just the app shell. */
async function assertRendered(page: Page, label: string, content: RegExp) {
  const main = page.locator('main').first();
  await expect(main).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByText(/something went wrong/i),
    `${label} crashed into its error boundary.`,
  ).toHaveCount(0);
  await expect(
    main,
    `${label} did not render its own content — only the app shell.`,
  ).toContainText(content, { timeout: 15_000 });
}

/**
 * Open the first row of a list page and return the detail URL.
 * Fails loudly when the list is empty: an empty seed is a broken fixture, not a
 * reason to pass. Run `npx tsx prisma/seed-credit.ts --demo --e2e` first.
 */
async function openFirstRow(page: Page, listPath: string, detail: RegExp): Promise<void> {
  await page.goto(listPath, { waitUntil: 'domcontentloaded' });
  const firstRow = page.locator('table tbody tr').first();
  await expect(
    firstRow,
    `No rows at ${listPath}. Re-run the demo seed — an empty list cannot exercise the detail route.`,
  ).toBeVisible({ timeout: 15_000 });
  await firstRow.click();
  await expect(page).toHaveURL(detail, { timeout: 15_000 });
}

test.describe('Phase 8 — parameterised credit screens render', () => {
  test.use({ storageState: STATE_FILES.approver });

  test('application detail renders', async ({ page }) => {
    const uncaught: string[] = [];
    page.on('pageerror', (e) => uncaught.push(e.message));

    await openFirstRow(page, '/credit/applications', /\/credit\/applications\/[0-9a-f-]{36}/);
    await assertRendered(page, 'Application detail', /readiness|overview|assessment/i);

    expect(uncaught, `Application detail raised: ${uncaught.join(' | ')}`).toHaveLength(0);
  });

  test('borrower detail renders', async ({ page }) => {
    const uncaught: string[] = [];
    page.on('pageerror', (e) => uncaught.push(e.message));

    // Borrower rows open the quick-preview panel by design. Navigation is on
    // the borrower name button in the first cell, which stops row bubbling.
    await page.goto('/credit/borrowers', { waitUntil: 'domcontentloaded' });
    const nameButton = page.locator('table tbody tr td:first-child button').first();
    await expect(
      nameButton,
      'No borrower rows. Run `npx tsx prisma/seed-credit.ts --demo --e2e`.',
    ).toBeVisible({ timeout: 15_000 });
    await nameButton.click();
    await expect(page).toHaveURL(/\/credit\/borrowers\/[0-9a-f-]{36}/, { timeout: 15_000 });
    await assertRendered(page, 'Borrower detail', /borrower|exposure|profile/i);

    expect(uncaught, `Borrower detail raised: ${uncaught.join(' | ')}`).toHaveLength(0);
  });
});

test.describe('Phase 8 — mobile credit screens render', () => {
  test.use({ storageState: STATE_FILES.approver, viewport: { width: 390, height: 844 } });

  test('mobile approval inbox renders', async ({ page }) => {
    const uncaught: string[] = [];
    page.on('pageerror', (e) => uncaught.push(e.message));

    // MyApprovals redirects to /credit/m/approvals on a mobile viewport, so this
    // both covers the mobile screen and proves the redirect works.
    await page.goto('/credit/approvals', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/credit\/m\/approvals/, { timeout: 15_000 });

    await assertRendered(page, 'Mobile approval inbox', /approval/i);

    expect(uncaught, `Mobile approval inbox raised: ${uncaught.join(' | ')}`).toHaveLength(0);
  });
});