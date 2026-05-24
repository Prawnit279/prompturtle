import { test, expect } from '@playwright/test';

import { signInAsTestUser } from './helpers/auth.js';

test.describe('API Key Management', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test('creates a new API key and displays it once', async ({ page }) => {
    await page.goto('/dashboard/keys');

    await page.fill('[placeholder*="Key name" i], [placeholder*="name" i]', 'E2E Test Key');
    await page.click('button:has-text("Create Key"), button:has-text("Create")');

    // Raw key must be visible immediately after creation (shown once)
    const keyValue = page.locator('code').filter({ hasText: /^ptk_/ });
    await expect(keyValue).toBeVisible({ timeout: 5_000 });

    const keyText = await keyValue.textContent();
    expect(keyText).toMatch(/^ptk_/); // Progue key prefix
  });

  test('lists existing API keys without showing raw values', async ({ page }) => {
    await page.goto('/dashboard/keys');

    // Keys table/grid is visible
    const keysList = page.locator('[style*="grid"], table, [data-testid="api-keys-list"]').first();
    await expect(keysList).toBeVisible();

    // Raw key values must NOT appear in the list — only prefix (ptk_abcdef…)
    const allText = await page.textContent('body');
    const fullKeyPattern = /ptk_[a-f0-9]{60,}/; // full 64-char hex key
    expect(allText).not.toMatch(fullKeyPattern);
  });

  test('revokes an API key', async ({ page }) => {
    await page.goto('/dashboard/keys');

    const revokeButton = page.locator('button:has-text("Revoke")').first();
    if (await revokeButton.count() > 0) {
      await revokeButton.click();
      // Confirm dialog if present
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
      if (await confirmButton.count() > 0) await confirmButton.click();
      await expect(revokeButton).not.toBeVisible({ timeout: 3_000 });
    }
  });
});
