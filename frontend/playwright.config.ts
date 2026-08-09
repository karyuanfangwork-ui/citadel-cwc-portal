import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html']] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'a11y',
      testDir: './e2e/a11y',
      testMatch: /\.a11y\.spec\.ts$/,
    },
    {
      name: 'smoke',
      testDir: './e2e/smoke',
      testMatch: /\.smoke\.spec\.ts$/,
    },
    {
      name: 'credit',
      testDir: './e2e/credit',
      testMatch: /\.spec\.ts$/,
    },
  ],
});