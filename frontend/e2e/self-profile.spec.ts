import { expect, test } from '@playwright/test';

test.describe('Self-Profile Modal Flow', () => {
  test('authenticated user can open self-profile modal and view account details', async ({ page }) => {
    const email = `profile_test_${Date.now()}@example.com`;
    const password = 'Password123!';
    const displayName = 'Profile Inspector';

    // 1. Register a new user
    await page.goto('/register');
    await page.fill('#register-displayName', displayName);
    await page.fill('#register-email', email);
    await page.fill('#register-password', password);
    await page.click('button:has-text("Create account")');

    // 2. Arrive at conversations page
    await expect(page).toHaveURL('http://localhost:4200/');
    await expect(page.locator('h2')).toHaveText('Conversations');

    // 3. Open self-profile modal
    const profileBtn = page.locator('[data-testid="view-profile-button"]');
    await expect(profileBtn).toBeVisible();
    await profileBtn.click();

    // 4. Verify modal contents
    const modalBackdrop = page.locator('.modal-backdrop');
    await expect(modalBackdrop).toBeVisible();
    await expect(page.locator('[data-testid="self-profile-name"]')).toHaveText(displayName);
    await expect(page.locator('[data-testid="self-profile-email"]')).toHaveText(email);
    await expect(page.locator('[data-testid="self-profile-bio"]')).toHaveText(
      'No bio yet. Tell the community about yourself.'
    );
    await expect(page.locator('[data-testid="self-profile-joined"]')).toContainText('2026');

    // 5. Close modal via close button
    await page.locator('[data-testid="close-profile-btn"]').click();
    await expect(modalBackdrop).not.toBeVisible();

    // 6. Re-open and close via Close footer button
    await profileBtn.click();
    await expect(modalBackdrop).toBeVisible();
    await page.locator('[data-testid="profile-close-btn"]').click();
    await expect(modalBackdrop).not.toBeVisible();
  });
});
