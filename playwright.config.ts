import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:       './e2e',
  fullyParallel: false,          // sequential — tests share DB state
  forbidOnly:    !!process.env.CI,
  retries:       process.env.CI ? 1 : 0,
  workers:       1,
  reporter:      [['html', { outputFolder: 'e2e/playwright-report' }], ['list']],

  use: {
    baseURL:    process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace:      'on-first-retry',
    screenshot: 'only-on-failure',
    video:      'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use:  { ...devices['Desktop Chrome'] },
    },
  ],

  // Auto-start both servers before running tests.
  // Backend health endpoint is at /api/health (port 3000 default).
  webServer: [
    {
      command:             'npm run dev --workspace=apps/backend',
      url:                 process.env.E2E_API_URL
        ? `${process.env.E2E_API_URL}/api/health`
        : 'http://localhost:3000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout:             30_000,
    },
    {
      command:             'npm run dev --workspace=apps/frontend',
      url:                 process.env.E2E_BASE_URL ?? 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout:             30_000,
    },
  ],
});
