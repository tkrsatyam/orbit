import { expect, test } from '@playwright/test';

test.describe('Authentication & Route Guards Flow', () => {
  test('unauthenticated route guards, registration, reload persistence, and logout', async ({ page }) => {
    const email = `e2e_${Date.now()}@example.com`;
    const password = 'Password123!';
    const displayName = 'Playwright Tester';

    // 1. Unauthenticated redirect from / to /login
    await page.goto('/');
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.locator('h1')).toHaveText('Orbit');
    await expect(page.locator('button:has-text("Sign in")').first()).toBeVisible();

    // 2. Guest visiting /discover sees "Register to join"
    await page.goto('/discover');
    await expect(page.locator('h2')).toHaveText('Discover Groups');
    await expect(page.locator('a:has-text("Register to join")')).toBeVisible();

    // 3. User registers account
    await page.click('a:has-text("Register to join")');
    await expect(page.locator('label[for="register-displayName"]')).toBeVisible();
    await page.fill('#register-displayName', displayName);
    await page.fill('#register-email', email);
    await page.fill('#register-password', password);
    await page.click('button:has-text("Create account")');

    // Expect redirect to /
    await expect(page).toHaveURL('http://localhost:4200/');
    await expect(page.locator('h2')).toHaveText('Conversations');
    await expect(page.locator('header')).toContainText(displayName);

    // 4. Page reload: exactly 1 refresh call and session remains intact
    let refreshCalls = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/auth/refresh')) {
        refreshCalls++;
      }
    });

    await page.reload();

    await expect(page).toHaveURL('http://localhost:4200/');
    await expect(page.locator('h2')).toHaveText('Conversations');
    await expect(page.locator('header')).toContainText(displayName);
    expect(refreshCalls).toBe(1);

    // 5. Client-side navigation to /discover as authenticated member
    await page.click('a:has-text("Discover Groups")');
    await expect(page).toHaveURL('http://localhost:4200/discover');
    await expect(page.locator('button:has-text("Join Group")')).toBeVisible();
    await expect(page.locator('text=Logged in as Playwright Tester')).toBeVisible();

    // Navigate back to /
    await page.click('a:has-text("Back to conversations")');
    await expect(page).toHaveURL('http://localhost:4200/');

    // 6. Sign out
    await page.click('button:has-text("Sign out")');
    await expect(page).toHaveURL(/.*\/login/);

    // Visiting protected route now redirects to /login
    await page.goto('/');
    await expect(page).toHaveURL(/.*\/login/);
  });
});
