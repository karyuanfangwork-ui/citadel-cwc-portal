// frontend/e2e/credit/render-smoke.spec.ts
import { test, expect } from '@playwright/test';
import { STATE_FILES } from './support/auth';
import { CREDIT_ROUTES } from './support/routes';

/**
 * Phase 8 — every credit screen renders.
 *
 * LOS-020 closed twice on a page that crashed into its error boundary for every
 * user. Nothing in the suite asserted "this screen renders at all", and the
 * credit API client is untyped, so neither TypeScript nor Playwright objected.
 *
 * Each test asserts three things, in order of how loudly they fail:
 *   1. No uncaught exception reached the window.
 *   2. React did not swap the body for the ErrorBoundary fallback.
 *   3. <main> contains the content that proves this specific screen rendered,
 *      not just the app shell.
 *
 * (3) is the one that matters. The shell renders headings and nav for every
 * route including broken ones — that is precisely how the LOS-020 crash hid.
 */

test.describe('Phase 8 — credit screens render', () => {
  test.use({ storageState: STATE_FILES.approver });

  for (const route of CREDIT_ROUTES) {
    test(`${route.name} (${route.path}) renders`, async ({ page }) => {
      const uncaught: string[] = [];
      page.on('pageerror', (e) => uncaught.push(e.message));

      await page.goto(route.path, { waitUntil: 'domcontentloaded' });

      const main = page.locator('main').first();
      await expect(main).toBeVisible({ timeout: 15_000 });

      await expect(
        page.getByText(/something went wrong/i),
        `${route.name} crashed into its error boundary.`,
      ).toHaveCount(0);

      await expect(
        main,
        `${route.name} did not render its own content — only the app shell. ` +
        `This is the LOS-020 failure mode: the shell renders, the screen does not.`,
      ).toContainText(route.expect, { timeout: 15_000 });

      expect(
        uncaught,
        `${route.name} raised an uncaught exception: ${uncaught.join(' | ')}`,
      ).toHaveLength(0);
    });
  }
});