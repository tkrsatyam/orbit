import { expect, test } from '@playwright/test';

test.describe('Token Refresh & Session Lifecycle Flow', () => {
  test('retains active session seamlessly on reload via refresh cookie', async ({ page }) => {
    const email = `refresh_ok_${Date.now()}@example.com`;
    const password = 'Password123!';
    const displayName = 'Refresh Success User';

    await page.goto('/register');
    await page.fill('#register-displayName', displayName);
    await page.fill('#register-email', email);
    await page.fill('#register-password', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('http://localhost:4200/');
    await expect(page.locator('.welcome-heading')).toContainText(displayName);

    // Track refresh and me requests during reload
    const refreshRequests: string[] = [];
    const meRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/auth/refresh')) {
        refreshRequests.push(req.method());
      }
      if (req.url().includes('/api/v1/users/me')) {
        meRequests.push(req.method());
      }
    });

    await page.reload();

    // Verify session restored via refresh + GET /users/me without dropping to login
    await expect(page).toHaveURL('http://localhost:4200/');
    await expect(page.locator('.welcome-heading')).toContainText(displayName);
    expect(refreshRequests.length).toBe(1);
    expect(meRequests.length).toBe(1);

    // Verify localStorage fallback bridge is completely retired
    const cachedUser = await page.evaluate(() => localStorage.getItem('orbit_user'));
    expect(cachedUser).toBeNull();
  });

  test('redirects to login when refresh cookie is expired or rejected by server', async ({ page }) => {
    const email = `refresh_exp_${Date.now()}@example.com`;
    const password = 'Password123!';
    const displayName = 'Expired Cookie User';

    await page.goto('/register');
    await page.fill('#register-displayName', displayName);
    await page.fill('#register-email', email);
    await page.fill('#register-password', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('http://localhost:4200/');

    // Mock refresh endpoint returning 401 Unauthorized
    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 401,
          error: 'Unauthorized',
          message: 'Refresh token expired',
          path: '/api/v1/auth/refresh',
          timestamp: new Date().toISOString()
        })
      });
    });

    // Reload page: init() calls refresh(), fails with 401, guard redirects to /login
    await page.reload();

    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('redirects to login when session cookie is removed from browser context', async ({ page, context }) => {
    const email = `refresh_clr_${Date.now()}@example.com`;
    const password = 'Password123!';
    const displayName = 'Cleared Cookie User';

    await page.goto('/register');
    await page.fill('#register-displayName', displayName);
    await page.fill('#register-email', email);
    await page.fill('#register-password', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('http://localhost:4200/');

    // Clear all cookies
    await context.clearCookies();

    // Reload page
    await page.reload();

    // Protected route redirects to login
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
