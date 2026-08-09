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

/** Seed accounts (see CLAUDE.md). Override per-environment via env vars. */
export const CREDIT_ANALYST = {
  email: process.env.E2E_CREDIT_USER || 'it@test.local',
  password: process.env.E2E_CREDIT_PASS || 'abc@123',
};

export const CREDIT_APPROVER = {
  email: process.env.E2E_APPROVER_USER || 'ceo@test.local',
  password: process.env.E2E_APPROVER_PASS || 'abc@123',
};

export const NON_CREDIT_USER = {
  email: process.env.E2E_NON_CREDIT_USER || 'user@helpdesk.com',
  password: process.env.E2E_NON_CREDIT_PASS || 'abc@123',
};

export interface Credentials {
  email: string;
  password: string;
}

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
