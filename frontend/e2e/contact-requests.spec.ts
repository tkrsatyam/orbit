import { expect, test } from '@playwright/test';

test.describe('Accept and Decline Connection Requests Flow (ORDM-34)', () => {
  const backendBase = 'http://localhost:8080';

  test('user receives connection request banner, accepts it, and confirms removal', async ({
    page,
    request
  }) => {
    const timestamp = Date.now();
    const recipientEmail = `recipient_${timestamp}@example.com`;
    const senderEmail = `sender_${timestamp}@example.com`;
    const password = 'Password123!';
    const recipientName = 'Recipient User';
    const senderName = 'Sender Alex';

    // 1. Create Recipient via backend API
    const recipientRes = await request.post(`${backendBase}/api/v1/auth/register`, {
      data: { email: recipientEmail, password, displayName: recipientName }
    });
    expect(recipientRes.ok()).toBeTruthy();
    const recipientData = await recipientRes.json();
    const recipientId = recipientData.user.id;

    // 2. Create Sender via backend API
    const senderRes = await request.post(`${backendBase}/api/v1/auth/register`, {
      data: { email: senderEmail, password, displayName: senderName }
    });
    expect(senderRes.ok()).toBeTruthy();
    const senderData = await senderRes.json();
    const senderToken = senderData.accessToken;

    // 3. Sender sends connection request to Recipient
    const reqRes = await request.post(`${backendBase}/api/v1/contacts/requests`, {
      headers: { Authorization: `Bearer ${senderToken}` },
      data: { targetUserId: recipientId }
    });
    expect(reqRes.status()).toBe(201);

    // 4. Recipient logs in via Frontend UI
    await page.goto('/login');
    await page.fill('#login-email', recipientEmail);
    await page.fill('#login-password', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('http://localhost:4200/');
    await expect(page.locator('h2')).toHaveText('Conversations');

    // 5. Verify the non-blocking incoming request banner is visible
    const requestCard = page.locator('[data-testid^="incoming-request-card"]');
    await expect(requestCard).toBeVisible();
    await expect(requestCard).toContainText(senderName);
    await expect(requestCard).toContainText('sent you a connection request');

    // 6. Click Accept
    const acceptBtn = page.locator('[data-testid^="accept-request-btn"]');
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();

    // 7. Banner disappears upon acceptance
    await expect(requestCard).not.toBeVisible();
  });

  test('user receives connection request, declines it, and confirms quiet removal', async ({
    page,
    request
  }) => {
    const timestamp = Date.now() + 1;
    const recipientEmail = `recipient_dec_${timestamp}@example.com`;
    const senderEmail = `sender_dec_${timestamp}@example.com`;
    const password = 'Password123!';
    const recipientName = 'Declining Recipient';
    const senderName = 'Sender Jordan';

    // 1. Create Recipient via backend API
    const recipientRes = await request.post(`${backendBase}/api/v1/auth/register`, {
      data: { email: recipientEmail, password, displayName: recipientName }
    });
    expect(recipientRes.ok()).toBeTruthy();
    const recipientData = await recipientRes.json();
    const recipientId = recipientData.user.id;

    // 2. Create Sender via backend API
    const senderRes = await request.post(`${backendBase}/api/v1/auth/register`, {
      data: { email: senderEmail, password, displayName: senderName }
    });
    expect(senderRes.ok()).toBeTruthy();
    const senderData = await senderRes.json();
    const senderToken = senderData.accessToken;

    // 3. Sender sends connection request to Recipient
    const reqRes = await request.post(`${backendBase}/api/v1/contacts/requests`, {
      headers: { Authorization: `Bearer ${senderToken}` },
      data: { targetUserId: recipientId }
    });
    expect(reqRes.status()).toBe(201);

    // 4. Recipient logs in via Frontend UI
    await page.goto('/login');
    await page.fill('#login-email', recipientEmail);
    await page.fill('#login-password', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('http://localhost:4200/');

    // 5. Verify incoming request card
    const requestCard = page.locator('[data-testid^="incoming-request-card"]');
    await expect(requestCard).toBeVisible();
    await expect(requestCard).toContainText(senderName);

    // 6. Click Decline
    const declineBtn = page.locator('[data-testid^="decline-request-btn"]');
    await expect(declineBtn).toBeVisible();
    await declineBtn.click();

    // 7. Banner disappears quietly
    await expect(requestCard).not.toBeVisible();
  });
});
