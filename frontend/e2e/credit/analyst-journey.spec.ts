// frontend/e2e/credit/analyst-journey.spec.ts
/**
 * LOS-022 — E2E: analyst credit journey
 */
import { test, expect } from '@playwright/test';
import { STATE_FILES } from './support/auth';


test.describe('LOS-022 — analyst credit journey', () => {
  test.use({ storageState: STATE_FILES.analyst });

  test('an analyst can open an application and see its readiness blockers', async ({ page }) => {
    await page.goto('/credit/applications');
    await expect(page.getByRole('heading', { name: /application management/i }).first()).toBeVisible({ timeout: 10_000 });

    const firstRow = page.getByRole('row').nth(1);
    const hasRow = await firstRow.first()
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (!hasRow) {
      test.skip(true, 'No applications in list');
      return;
    }
    await firstRow.click();
    await expect(page).toHaveURL(/\/credit\/applications\/[0-9a-f-]{36}/, { timeout: 10_000 });
    await expect(page.getByText(/readiness|submission readiness/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('submitting an unready application to committee is blocked with a reason', async ({ page }) => {
    await page.goto('/credit/applications');
    const firstRow = page.getByRole('row').nth(1);
    const hasRow = await firstRow.first()
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (!hasRow) {
      test.skip(true, 'No applications in list');
      return;
    }
    await firstRow.click();
    await expect(page).toHaveURL(/\/credit\/applications\//, { timeout: 10_000 });

    const submit = page.getByRole('button', { name: /submit to committee/i });
    if (await submit.count() === 0) {
      // Treating an absent button as "blocked" would make this test vacuous.
      test.skip(true, 'No submit-to-committee control on this application');
      return;
    }
    if (await submit.isDisabled()) {
      // UI pre-empts the blocked action — desired outcome
      await expect(submit).toBeDisabled();
      return;
    }
    await submit.click();
    await expect(page.getByText(/cannot enter committee review|cannot submit to committee/i).first()).toBeVisible({ timeout: 5_000 });
  });
});