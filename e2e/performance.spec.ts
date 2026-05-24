import { test, expect } from '@playwright/test';

import { signInAsTestUser } from './helpers/auth.js';

test.describe('Performance Targets', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test('dashboard loads within LCP target (< 2.5s)', async ({ page }) => {
    const start = Date.now();
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2500);
  });

  test('API logs page renders without layout shift (CLS < 0.1)', async ({ page }) => {
    await page.goto('/dashboard/logs');
    await page.waitForLoadState('networkidle');

    // Measure CLS via Performance Observer API
    const cls = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            // justification: PerformanceEntry subtypes require casting to access layout-shift value
            clsValue += (entry as unknown as { value: number }).value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(clsValue), 1_000);
      });
    });

    expect(cls).toBeLessThan(0.1); // CLS < 0.1 target
  });
});
