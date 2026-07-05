/**
 * P4-11: Basic smoke tests — verify key routes load without crashing.
 *
 * Requires the dev server running at E2E_BASE_URL (default: http://localhost:5173).
 *
 * Usage:
 *   npx playwright test --project=smoke
 */

import { test, expect } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';

// Unauthenticated routes — should render without login
const PUBLIC_ROUTES = [
  { name: 'Login page', path: '/login' },
];

// Authenticated routes — need login
const AUTH_ROUTES = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'My Requests', path: '/my-requests' },
  { name: 'Agent Dashboard', path: '/agent-dashboard' },
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
    // Login via API
    const apiURL = baseURL.replace(/:\d+/, ':3000');
    const response = await page.request.post(`${apiURL}/api/v1/auth/login`, {
      data: { email: 'admin@test.local', password: 'Admin123!' },
    });

    if (response.ok()) {
      const { token } = await response.json();
      await page.evaluate((t) => localStorage.setItem('token', t), token);
    }
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

      // No unhandled JS errors (allow network errors from API calls)
      const jsErrors = errors.filter((e) => !e.includes('fetch') && !e.includes('network'));
      expect(jsErrors).toEqual([]);
    });
  }
});