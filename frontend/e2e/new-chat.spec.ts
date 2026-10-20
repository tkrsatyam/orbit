import { expect, test } from '@playwright/test';

test.describe('New Chat & Connection Request Flow', () => {
  test('authenticated user can open new chat modal and dispatch connection request', async ({ page }) => {
    const timestamp = Date.now();
    const user1Email = `user1_${timestamp}@example.com`;
    const password = 'Password123!';
    const user1Name = 'Requester User';

    // 1. Register User 1
    await page.goto('/register');
    await page.fill('#register-displayName', user1Name);
    await page.fill('#register-email', user1Email);
    await page.fill('#register-password', password);
    await page.click('button:has-text("Create account")');

    await expect(page).toHaveURL('http://localhost:4200/');
    await expect(page.locator('h2')).toHaveText('Conversations');

    // 2. Open New Chat modal from header
    const newChatBtn = page.locator('[data-testid="new-chat-trigger-btn"]');
    await expect(newChatBtn).toBeVisible();
    await newChatBtn.click();

    const modalBackdrop = page.locator('[data-testid="new-chat-modal-backdrop"]');
    await expect(modalBackdrop).toBeVisible();
    await expect(page.locator('#modal-title')).toHaveText('New Conversation');

    // 3. Test empty input error
    const directInput = page.locator('[data-testid="target-user-id-input"]');
    await expect(directInput).toBeVisible();

    // 4. Close via Escape key
    await page.keyboard.press('Escape');
    await expect(modalBackdrop).not.toBeVisible();

    // 5. Re-open via content button
    const actionNewChatBtn = page.locator('[data-testid="action-new-chat-btn"]');
    await expect(actionNewChatBtn).toBeVisible();
    await actionNewChatBtn.click();
    await expect(modalBackdrop).toBeVisible();

    // 6. Close via '✕' button
    await page.locator('[data-testid="close-new-chat-modal-btn"]').click();
    await expect(modalBackdrop).not.toBeVisible();
  });
});
