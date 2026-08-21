import { test, expect, type Page } from '@playwright/test';
import { STATE_FILES } from './support/auth';

async function openFirstBorrower(page: Page) {
  await page.goto('/credit/borrowers', { waitUntil: 'domcontentloaded' });
  const nameButton = page.locator('table tbody tr td:nth-child(2) button').first();
  await expect(nameButton, 'No borrower rows. Run the demo credit seed.').toBeVisible({ timeout: 15_000 });
  await nameButton.click();
  await expect(page).toHaveURL(/\/credit\/borrowers\/[0-9a-f-]{36}/, { timeout: 15_000 });
}

test.describe('RM borrower workspace', () => {
  test.use({ storageState: STATE_FILES.approver });

  test('shows borrower readiness, next actions, and applications', async ({ page }) => {
    await openFirstBorrower(page);
    await expect(page.getByRole('heading', { name: 'Borrower readiness' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /next actions/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Applications' })).toBeVisible();
    await page.getByRole('tab', { name: 'Applications' }).click();
    await expect(page).toHaveURL(/tab=applications/);
    const applicationsPanel = page.getByRole('tabpanel', { name: 'Applications' });
    const applicationLink = applicationsPanel.locator('a[href^="/credit/applications/"]').first();
    if (await applicationLink.count() > 0) {
      await expect(applicationLink).toBeVisible();
    } else {
      await expect(applicationsPanel.getByRole('button', { name: 'Start application' })).toBeVisible();
    }
  });

  test('preserves the selected tab in the URL', async ({ page }) => {
    await openFirstBorrower(page);
    await page.getByRole('tab', { name: 'Documents' }).click();
    await expect(page).toHaveURL(/tab=documents/);
    await expect(page.getByRole('tabpanel', { name: 'Documents' })).toContainText(/documents/i);
  });

  test('renders the guided risk assessment state and remediation context', async ({ page }) => {
    await openFirstBorrower(page);
    await page.getByRole('tab', { name: 'Risk & Compliance' }).click();
    await expect(page).toHaveURL(/tab=risk/);
    await expect(page.getByRole('tabpanel', { name: 'Risk & Compliance' })).toContainText(/assessment readiness/i);
    await expect(page.getByText(/application draft/i)).toBeVisible();
    await expect(page.getByRole('tabpanel', { name: 'Risk & Compliance' }).getByText('Decisioning', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /calculate risk rating|recalculate risk rating/i }).first()).toBeVisible();
  });

});
