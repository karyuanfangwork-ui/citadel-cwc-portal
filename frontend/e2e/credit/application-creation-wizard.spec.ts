import { test, expect } from '@playwright/test';
import { STATE_FILES } from './support/auth';

test.describe('application creation wizard', () => {
  test.use({ storageState: STATE_FILES.analyst });

  test('Application Management opens the canonical five-step draft wizard', async ({ page }) => {
    await page.goto('/credit/applications');
    await expect(page.getByRole('heading', { name: /application management/i }).first()).toBeVisible({ timeout: 10_000 });

    const createButton = page.getByRole('button', { name: /new application/i });
    await expect(createButton).toBeVisible();
    await createButton.click();

    await expect(page).toHaveURL(/\/credit\/applications\/new$/);
    await expect(page.getByRole('heading', { name: /new credit application wizard/i })).toBeVisible();
    await expect(page.getByText('Borrower', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Loan Request', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Facility', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Assignment', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Review', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /create draft/i })).not.toBeVisible();
  });
});
