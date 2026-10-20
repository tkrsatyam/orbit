import { expect, test } from '@playwright/test';

test.describe('Authentication Negative Scenarios & Form Validation', () => {
  test('rejects login with invalid credentials and displays error banner', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#login-email', 'nonexistent_user@example.com');
    await page.fill('#login-password', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    const errorBanner = page.locator('.form-error');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText('Invalid email or password');
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('rejects duplicate user registration with 409 conflict error banner', async ({ page }) => {
    const email = `dup_${Date.now()}@example.com`;
    const password = 'Password123!';
    const displayName = 'Duplicate Candidate';

    // Initial registration
    await page.goto('/register');
    await page.fill('#register-displayName', displayName);
    await page.fill('#register-email', email);
    await page.fill('#register-password', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('http://localhost:4200/');
    await expect(page.locator('h2')).toHaveText('Conversations');

    // Sign out
    await page.click('[data-testid="user-avatar-badge"]');
    await page.click('[data-testid="signout-button"]');
    await expect(page).toHaveURL(/.*\/login/);

    // Duplicate registration attempt with same email
    await page.goto('/register');
    await page.fill('#register-displayName', 'Another Person');
    await page.fill('#register-email', email);
    await page.fill('#register-password', password);
    await page.click('button[type="submit"]');

    const errorBanner = page.locator('.form-error');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText('Email is already registered');
    await expect(page).toHaveURL(/.*\/register/);
  });

  test('enforces client-side validation for login form controls', async ({ page }) => {
    await page.goto('/login');

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();

    // Invalid email triggers field error on blur
    await page.fill('#login-email', 'invalid-email');
    await page.locator('#login-password').focus();
    await expect(page.locator('.field-error')).toHaveText('Please enter a valid email address.');
    await expect(submitBtn).toBeDisabled();

    // Valid email but empty password keeps submit disabled
    await page.fill('#login-email', 'valid@example.com');
    await expect(submitBtn).toBeDisabled();

    // Valid password enables submit
    await page.fill('#login-password', 'secret123');
    await expect(submitBtn).toBeEnabled();
  });

  test('enforces client-side validation for registration form controls', async ({ page }) => {
    await page.goto('/register');

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();

    // Display name < 2 chars
    await page.fill('#register-displayName', 'A');
    await page.locator('#register-email').focus();
    await expect(page.locator('.field-error')).toHaveText('Display name must be between 2 and 50 characters.');
    await expect(submitBtn).toBeDisabled();

    // Correct display name
    await page.fill('#register-displayName', 'Valid Name');

    // Invalid email
    await page.fill('#register-email', 'not-an-email');
    await page.locator('#register-password').focus();
    await expect(page.locator('.field-error')).toHaveText('Please enter a valid email address.');
    await expect(submitBtn).toBeDisabled();

    // Correct email
    await page.fill('#register-email', 'valid@example.com');

    // Weak password
    await page.fill('#register-password', 'weakpass');
    await page.locator('#register-displayName').focus();
    await expect(page.locator('.field-error')).toContainText(
      'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
    );
    await expect(submitBtn).toBeDisabled();

    // Valid password enables submit
    await page.fill('#register-password', 'ValidPass123!');
    await expect(submitBtn).toBeEnabled();
  });
});
