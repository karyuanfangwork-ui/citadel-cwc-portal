import { expect, type Page } from '@playwright/test';

/**
 * LOS-022 — Shared credit E2E login.
 *
 * Every credit spec previously inlined its own login and then swallowed the
 * outcome with `.catch(() => {})`, waiting for `**\/dashboard**` — a URL this
 * app never navigates to (Login sends you to `/`). The result was six specs
 * that ran unauthenticated and still passed, which reads as coverage while
 * proving nothing.
 *
 * This helper asserts the login actually worked. If credentials are wrong or
 * the API is down, the spec fails here with a clear message instead of
 * silently continuing as an anonymous visitor.
 */

/**
 * Seed accounts, verified against the running API rather than taken from
 * documentation. Two things that cost time when they were assumed:
 *
 *   - The two account families use DIFFERENT passwords:
 *       *@test.local      → password123
 *       user@helpdesk.com → abc@123
 *   - Only admin@test.local carries credit permissions. it@test.local is an
 *     IT-support agent with none, so specs using it silently landed on the
 *     home page instead of any credit screen.
 *
 * Override per-environment via env vars. Ideally analyst and approver are
 * SEPARATE accounts so segregation-of-duties paths are exercised realistically;
 * this seed has only one credit-permissioned user, so both default to it. Point
 * E2E_APPROVER_USER at a dedicated approver once one is seeded.
 */
export const CREDIT_ANALYST = {
  email: process.env.E2E_CREDIT_USER || 'admin@test.local',
  password: process.env.E2E_CREDIT_PASS || 'password123',
};

export const CREDIT_APPROVER = {
  email: process.env.E2E_APPROVER_USER || 'admin@test.local',
  password: process.env.E2E_APPROVER_PASS || 'password123',
};

/**
 * LOS-022 residual — dedicated segregation-of-duties identities.
 *
 * CREDIT_ANALYST and CREDIT_APPROVER above both resolve to admin@test.local,
 * which holds every credit permission. That is fine for the journey specs, but
 * it makes segregation unprovable: one account cannot demonstrate that a role
 * WITHOUT credit:approve is turned away.
 *
 * These two are separate accounts with deliberately different permission sets,
 * seeded by `npx tsx prisma/seed-credit.ts --e2e`:
 *
 *   e2e-analyst@test.local   CREDIT_ANALYST  credit:read, credit:write, credit:export
 *   e2e-approver@test.local  CREDIT_MANAGER  credit:read, credit:write, credit:approve, credit:export
 *
 * They are kept separate from CREDIT_ANALYST/CREDIT_APPROVER rather than
 * replacing them so that adding SOD coverage cannot destabilise the five specs
 * that already pass with the admin session.
 *
 * Password is abc@123 — the seed hashes that, NOT the password123 used by the
 * older @test.local accounts. Two password families coexist in this seed; using
 * the wrong one yields a 401 that looks like a missing account.
 */
export const SOD_ANALYST = {
  email: process.env.E2E_SOD_ANALYST_USER || 'e2e-analyst@test.local',
  password: process.env.E2E_SOD_ANALYST_PASS || 'abc@123',
};

export const SOD_APPROVER = {
  email: process.env.E2E_SOD_APPROVER_USER || 'e2e-approver@test.local',
  password: process.env.E2E_SOD_APPROVER_PASS || 'abc@123',
};

export const NON_CREDIT_USER = {
  email: process.env.E2E_NON_CREDIT_USER || 'user@helpdesk.com',
  password: process.env.E2E_NON_CREDIT_PASS || 'abc@123',
};

export interface Credentials {
  email: string;
  password: string;
}

/**
 * Where each role's authenticated session is persisted by auth.setup.ts.
 * Specs load one of these via `test.use({ storageState })` instead of logging
 * in themselves — nine workers signing in at once trips the login rate limiter.
 */
export const STATE_FILES = {
  analyst: 'e2e/.auth/credit-analyst.json',
  approver: 'e2e/.auth/credit-approver.json',
  nonCredit: 'e2e/.auth/non-credit.json',
  sodAnalyst: 'e2e/.auth/sod-analyst.json',
  sodApprover: 'e2e/.auth/sod-approver.json',
} as const;

export async function login(page: Page, user: Credentials): Promise<void> {
  await page.goto('/login');
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');

  // The app navigates to '/' on success. Leaving /login is therefore the
  // signal — asserted, not hoped for.
  await expect(
    page,
    `Login failed for ${user.email}. Check the account exists in the seed data ` +
    `and that the backend is running (see E2E_BASE_URL).`,
  ).not.toHaveURL(/\/login/, { timeout: 15_000 });

  // A failed submit leaves the form up with an error; make that unambiguous.
  await expect(
    page.getByText(/invalid credentials|incorrect password|login failed/i),
    `Login form reported an error for ${user.email}.`,
  ).toHaveCount(0);
}
