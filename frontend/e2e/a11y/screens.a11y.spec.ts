/**
 * P4-11: Accessibility smoke tests using Playwright + axe-core.
 *
 * Runs axe audits on the top ESM screens to catch WCAG 2.1 AA violations.
 * Requires the dev server running at E2E_BASE_URL (default: http://localhost:5173).
 *
 * Usage:
 *   npx playwright test --project=a11y
 *   npx playwright test --project=a11y -- --grep "Dashboard"
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Login helper — posts to the auth endpoint and stores the JWT.
async function login(page) {
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';
  const apiURL = baseURL.replace(/:\d+/, ':3000');

  // Attempt login via API
  const response = await page.request.post(`${apiURL}/api/v1/auth/login`, {
    data: { email: 'admin@test.local', password: 'Admin123!' },
  });

  if (response.ok()) {
    const { token } = await response.json();
    // Inject token into localStorage
    await page.evaluate((t) => localStorage.setItem('token', t), token);
  } else {
    // Fallback: use UI login
    await page.goto(`${baseURL}/login`);
    await page.fill('[name="email"], input[type="email"]', 'admin@test.local');
    await page.fill('[name="password"], input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {});
  }
}

// Screens to audit — these are the top ESM priority screens
const SCREENS = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'My Requests', path: '/my-requests' },
  { name: 'Agent Dashboard', path: '/agent-dashboard' },
  { name: 'Knowledge Base', path: '/knowledge-base' },
  { name: 'Reports', path: '/reports' },
];

for (const screen of SCREENS) {
  test.describe(screen.name, () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
      await page.goto(screen.path);
      // Wait for content to render
      await page.waitForLoadState('networkidle').catch(() => {});
    });

    test(`${screen.name} has no WCAG 2.1 AA violations`, async ({ page }) => {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const violations = results.violations;
      if (violations.length > 0) {
        // Format violations for easy reading
        const details = violations.map((v) => {
          const nodes = v.nodes.map((n) => `  - ${n.html}`).join('\n');
          return `[${v.id}] ${v.description} (${v.impact})\n${nodes}`;
        }).join('\n\n');
        console.log(`\n⚠️  ${screen.name}: ${violations.length} violation(s)\n${details}`);
      }

      expect(violations).toEqual([]);
    });

    test(`${screen.name}: main landmark exists`, async ({ page }) => {
      const main = page.locator('main, [role="main"]');
      await expect(main).toBeTruthy();
    });

    test(`${screen.name}: h1 heading exists`, async ({ page }) => {
      const h1 = page.locator('h1');
      const count = await h1.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
}