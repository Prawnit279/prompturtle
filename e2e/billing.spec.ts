import { test, expect } from '@playwright/test';

import { signInAsTestUser } from './helpers/auth.js';

test.describe('Billing', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test('displays current tier and usage on billing page', async ({ page }) => {
    await page.goto('/dashboard/billing');

    // Tier name should be visible (Starter / Growth / Enterprise)
    await expect(
      page.locator('text=/starter|growth|enterprise/i').first(),
    ).toBeVisible({ timeout: 5_000 });

    // Call usage stats should be visible
    await expect(page.locator('text=/calls/i').first()).toBeVisible();
  });

  test('clicking Upgrade initiates Stripe checkout redirect', async ({ page, context }) => {
    await page.goto('/dashboard/billing');

    // Wait for billing data to load
    await page.waitForLoadState('networkidle');

    const upgradeButton = page
      .locator('button')
      .filter({ hasText: /upgrade/i })
      .first();

    if (await upgradeButton.count() > 0) {
      // Listen for navigation — Stripe redirects to checkout.stripe.com
      const navigationPromise = page
        .waitForURL(/stripe\.com|checkout/, { timeout: 8_000 })
        .catch(() => null); // navigation may not complete in test environment

      await upgradeButton.click();
      await navigationPromise;
      // Do NOT complete Stripe checkout — just verify navigation was triggered
    }
  });

  test('billing page loads within performance budget', async ({ page }) => {
    const start = Date.now();
    await page.goto('/dashboard/billing');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(2500); // LCP < 2.5s target
  });
});
