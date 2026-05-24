import type { Page } from '@playwright/test';

/**
 * Signs in a test user via Clerk's test mode.
 * Requires CLERK_TEST_USER_EMAIL + CLERK_TEST_USER_PASSWORD in env.
 * The test user must be pre-created in the Clerk dashboard (test environment).
 */
export async function signInAsTestUser(page: Page): Promise<void> {
  const email    = process.env.CLERK_TEST_USER_EMAIL;
  const password = process.env.CLERK_TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'CLERK_TEST_USER_EMAIL and CLERK_TEST_USER_PASSWORD must be set for E2E tests. ' +
      'See .env.example for setup instructions.',
    );
  }

  await page.goto('/sign-in');
  await page.fill('[name="identifier"]', email);
  await page.click('button[type="submit"]');
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 10_000 });
}
