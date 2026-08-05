import { test, expect } from '@playwright/test';

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe('workflow designer smoke flow', () => {
  test.skip(!email || !password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run the authenticated workflow smoke flow');

  test('opens the catalogue and designer route', async ({ page }) => {
    const apiURL = (process.env.E2E_BASE_URL || 'http://localhost:5173').replace(/:\d+/, ':3000');
    const response = await page.request.post(`${apiURL}/api/v1/auth/login`, { data: { email, password } });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    if (body.token) await page.evaluate((token) => localStorage.setItem('token', token), body.token);

    await page.goto('/admin/workflows');
    await expect(page.getByRole('heading', { name: 'Workflow Designer' })).toBeVisible();
    const draftButton = page.getByRole('button', { name: 'Create draft' }).first();
    if (await draftButton.count()) {
      await draftButton.click();
      await page.getByRole('dialog').getByRole('checkbox').check();
      await page.getByRole('dialog').getByRole('button', { name: 'Create draft' }).click();
      await expect(page).toHaveURL(/\/admin\/workflows\/[^/]+\/versions\/[^/]+$/);
      await expect(page.getByTestId('workflow-designer-page')).toBeVisible();
    }
  });
});
