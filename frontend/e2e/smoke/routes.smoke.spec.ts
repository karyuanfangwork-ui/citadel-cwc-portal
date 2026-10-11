/**
 * P4-11: Basic smoke tests — verify key routes load without crashing.
 *
 * Requires the dev server running at E2E_BASE_URL (default: http://localhost:5173).
 *
 * Usage:
 *   npx playwright test --project=smoke
 */

import { test, expect } from '@playwright/test';
import { CREDIT_ANALYST, login } from '../credit/support/auth';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';

// Unauthenticated routes — should render without login
const PUBLIC_ROUTES = [
  { name: 'Login page', path: '/login' },
];

// Authenticated routes — need login
const AUTH_ROUTES = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'My Requests', path: '/my-requests' },
  { name: 'Agent Dashboard', path: '/agent' },
  { name: 'Knowledge Base', path: '/knowledge-base' },
  { name: 'Reports', path: '/reports' },
];

test.describe('Public routes', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} loads without error`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(`${baseURL}${route.path}`);
      await page.waitForLoadState('networkidle').catch(() => {});

      expect(errors).toEqual([]);
      expect(page.url()).toContain(route.path);
    });
  }
});

test.describe('Authenticated routes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, CREDIT_ANALYST);
  });

  for (const route of AUTH_ROUTES) {
    test(`${route.name} loads without error`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(`${baseURL}${route.path}`);
      await page.waitForLoadState('networkidle').catch(() => {});

      // Allow redirect to login for unauthorized pages (not a crash)
      const currentUrl = page.url();
      const isOnTargetPage = currentUrl.includes(route.path);
      const isOnLoginPage = currentUrl.includes('/login');
      expect(isOnTargetPage || isOnLoginPage).toBeTruthy();
      if (route.name === 'Agent Dashboard') {
        expect(isOnTargetPage).toBe(true);
        await expect(page.getByRole('heading', { name: 'Agent Dashboard' })).toBeVisible();
        await expect(page.getByRole('searchbox', { name: 'Search tickets' })).toBeVisible();
      }

      // No unhandled JS errors (allow network errors from API calls)
      const jsErrors = errors.filter((e) => !e.includes('fetch') && !e.includes('network'));
      expect(jsErrors).toEqual([]);
    });
  }
});