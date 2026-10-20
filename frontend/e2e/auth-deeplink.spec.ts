import { expect, test } from '@playwright/test';

test.describe('Deep Linking & ReturnUrl Preservation Flow', () => {
  test('redirects unauthenticated user to login with returnUrl and restores target upon login', async ({ page }) => {
    const email = `deeplink_${Date.now()}@example.com`;
    const password = 'Password123!';
    const displayName = 'Deep Link User';

    // 1. Register account
    await page.goto('/register');
    await page.fill('#register-displayName', displayName);
    await page.fill('#register-email', email);
    await page.fill('#register-password', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('http://localhost:4200/');

    // Log out to clear session
    await page.click('[data-testid="user-avatar-badge"]');
    await page.click('[data-testid="signout-button"]');
    await expect(page).toHaveURL(/.*\/login/);

    // 2. Access protected route directly as guest
    const targetUrl = '/groups/engineering';
    await page.goto(targetUrl);

    // Guard redirects to login preserving returnUrl
    await expect(page).toHaveURL(/.*\/login\?returnUrl=%2Fgroups%2Fengineering/);
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // 3. Log in
    await page.fill('#login-email', email);
    await page.fill('#login-password', password);
    await page.click('button[type="submit"]');

    // 4. Verify redirected to returnUrl rather than root '/'
    await expect(page).toHaveURL('http://localhost:4200/groups/engineering');
    await expect(page.locator('h2')).toHaveText('Group: engineering');
    await expect(page.locator('text=This is a protected group view.')).toBeVisible();
  });

  test('preserves returnUrl when switching to register and restores target upon account creation', async ({ page }) => {
    const targetUrl = '/groups/product-team';
    await page.goto(targetUrl);

    await expect(page).toHaveURL(/.*\/login\?returnUrl=%2Fgroups%2Fproduct-team/);

    // Switch to register tab
    await page.click('.tab-button:has-text("Register")');
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    const email = `deeplink_reg_${Date.now()}@example.com`;
    const password = 'Password123!';
    const displayName = 'New Product Member';

    await page.fill('#register-displayName', displayName);
    await page.fill('#register-email', email);
    await page.fill('#register-password', password);
    await page.click('button[type="submit"]');

    // Verify redirected directly to targetUrl
    await expect(page).toHaveURL('http://localhost:4200/groups/product-team');
    await expect(page.locator('h2')).toHaveText('Group: product-team');
  });
});
