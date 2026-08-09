import { test as setup } from '@playwright/test';
import { login, CREDIT_ANALYST, CREDIT_APPROVER, NON_CREDIT_USER, STATE_FILES } from './auth';

/**
 * LOS-022 — Authenticate once per role and persist the session.
 *
 * Logging in inside every spec made nine workers hammer /auth/login
 * simultaneously, which trips the account lockout (5 failed attempts / 15 min)
 * and the login rate limiter. Tests then failed for reasons that had nothing to
 * do with what they were testing. Playwright's storageState is the standard
 * answer: sign in once here, reuse the cookie everywhere.
 */

setup('authenticate credit analyst', async ({ page }) => {
  await login(page, CREDIT_ANALYST);
  await page.context().storageState({ path: STATE_FILES.analyst });
});

setup('authenticate credit approver', async ({ page }) => {
  await login(page, CREDIT_APPROVER);
  await page.context().storageState({ path: STATE_FILES.approver });
});

setup('authenticate non-credit user', async ({ page }) => {
  await login(page, NON_CREDIT_USER);
  await page.context().storageState({ path: STATE_FILES.nonCredit });
});
