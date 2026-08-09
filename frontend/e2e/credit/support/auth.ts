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
