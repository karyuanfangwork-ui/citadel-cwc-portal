import { expect, test } from '@playwright/test';
import { STATE_FILES } from './support/auth';

test.describe('Credit Borrower List operational journey', () => {
  test.use({ storageState: STATE_FILES.analyst });

  test('opens Borrower Management and keeps search state in the URL', async ({ page }) => {
    await page.goto('/credit/borrowers');
    await expect(page.getByRole('heading', { name: 'Borrower Management' })).toBeVisible();
    const search = page.getByRole('searchbox');
    await expect(search).toBeVisible();
    await search.fill('Ahmad');
    await expect(page).toHaveURL(/\/credit\/borrowers\?q=Ahmad&page=1/);
    await expect(page.getByText(/borrowers$/i).first()).toBeVisible();
  });

});

test.describe('Credit Borrower List read-only journey', () => {
  test.use({ storageState: STATE_FILES.sodAnalyst });

  test('keeps the operational list available to a read-only credit user without create controls', async ({ page }) => {
    await page.goto('/credit/borrowers?segment=SME&status=ACTIVE');
    await expect(page.getByRole('heading', { name: 'Borrower Management' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Borrower/ })).toHaveCount(0);
    await expect(page).toHaveURL(/segment=SME/);
    await expect(page).toHaveURL(/status=ACTIVE/);
  });
});
