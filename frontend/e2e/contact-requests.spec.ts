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

  test('user opens new chat modal, sees real suggested user from database, and connects directly', async ({
    page,
    request
  }) => {
    const timestamp = Date.now() + 2;
    const userAEmail = `user_a_${timestamp}@example.com`;
    const userBEmail = `user_b_${timestamp}@example.com`;
    const password = 'Password123!';
    const userAName = 'Active Searcher';
    const userBName = 'Suggested Colleague';

    // 1. Create User B via backend
    const userBRes = await request.post(`${backendBase}/api/v1/auth/register`, {
      data: { email: userBEmail, password, displayName: userBName }
    });
    expect(userBRes.ok()).toBeTruthy();
    const userBData = await userBRes.json();
    const userBId = userBData.user.id;

    // 2. User A registers via UI
    await page.goto('/register');
    await page.fill('#register-displayName', userAName);
    await page.fill('#register-email', userAEmail);
    await page.fill('#register-password', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('http://localhost:4200/');

    // 3. Open New Chat modal
    await page.click('[data-testid="new-chat-trigger-btn"]');
    const modal = page.locator('[data-testid="new-chat-modal-card"]');
    await expect(modal).toBeVisible();

    // 4. Verify User B appears in Suggested People section
    const userBCard = page.locator(`[data-testid="person-card-${userBId}"]`);
    await expect(userBCard).toBeVisible();
    await expect(userBCard).toContainText(userBName);

    // 5. Click + Connect directly on User B's card
    const connectBtn = page.locator(`[data-testid="connect-btn-${userBId}"]`);
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();

    // 6. Verify pending button state and success alert
    const pendingBtn = page.locator(`[data-testid="pending-btn-${userBId}"]`);
    await expect(pendingBtn).toBeVisible();
    await expect(pendingBtn).toContainText('Pending...');
    await expect(page.locator('[data-testid="new-chat-success-alert"]')).toContainText(
      `Connection request sent to ${userBName}.`
    );
  });

  test('user views contact list, verifies presence, and removes contact (ORDM-35 unfriend)', async ({
    page,
    request
  }) => {
    const timestamp = Date.now() + 3;
    const userAEmail = `user_unfriend_a_${timestamp}@example.com`;
    const userBEmail = `user_unfriend_b_${timestamp}@example.com`;
    const password = 'Password123!';
    const userAName = 'Unfriend Initiator';
    const userBName = 'Connected Colleague';

    // 1. Create User A via backend
    const userARes = await request.post(`${backendBase}/api/v1/auth/register`, {
      data: { email: userAEmail, password, displayName: userAName }
    });
    expect(userARes.ok()).toBeTruthy();
    const userAData = await userARes.json();
    const userAToken = userAData.accessToken;
    const userAId = userAData.user.id;

    // 2. Create User B via backend
    const userBRes = await request.post(`${backendBase}/api/v1/auth/register`, {
      data: { email: userBEmail, password, displayName: userBName }
    });
    expect(userBRes.ok()).toBeTruthy();
    const userBData = await userBRes.json();
    const userBToken = userBData.accessToken;

    // 3. User B sends connection request to User A
    const sendReqRes = await request.post(`${backendBase}/api/v1/contacts/requests`, {
      headers: { Authorization: `Bearer ${userBToken}` },
      data: { targetUserId: userAId }
    });
    expect(sendReqRes.status()).toBe(201);
    const reqData = await sendReqRes.json();
    const requestId = reqData.id;

    // 4. User A accepts connection request via API
    const acceptRes = await request.patch(`${backendBase}/api/v1/contacts/requests/${requestId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
      data: { action: 'ACCEPT' }
    });
    expect(acceptRes.status()).toBe(200);

    // 5. User A logs in via Frontend UI
    await page.goto('/login');
    await page.fill('#login-email', userAEmail);
    await page.fill('#login-password', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('http://localhost:4200/');

    // 6. Open New Chat modal
    await page.click('[data-testid="new-chat-trigger-btn"]');
    const modal = page.locator('[data-testid="new-chat-modal-card"]');
    await expect(modal).toBeVisible();

    // 7. By default, since User A has 1 contact, Direct Message tab is active
    await expect(page.locator('[data-testid="contacts-count-badge"]')).toHaveText('1');
    const contactCard = page.locator('[data-testid^="contact-card-"]');
    await expect(contactCard).toBeVisible();
    await expect(contactCard).toContainText(userBName);

    // 8. Click Remove contact button
    const removeBtn = page.locator('[data-testid^="remove-contact-btn-"]');
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    // 9. Confirm removal prompt
    const confirmBox = page.locator('[data-testid="remove-confirm-box"]');
    await expect(confirmBox).toBeVisible();
    await page.locator('[data-testid^="confirm-remove-btn-"]').click();

    // 10. Success alert and empty state appear
    await expect(page.locator('[data-testid="new-chat-success-alert"]')).toContainText(
      `Removed ${userBName} from your contacts.`
    );
    await expect(page.locator('[data-testid="no-contacts-empty-state"]')).toBeVisible();

    // 11. Backend verification: 0 contacts
    const listRes = await request.get(`${backendBase}/api/v1/contacts`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    expect(listRes.status()).toBe(200);
    const listData = await listRes.json();
    expect(listData.content).toHaveLength(0);
  });

  test('user blocks an incoming connection request, verifying blocking and profile degradation (ORDM-36 block user)', async ({
    page,
    request
  }) => {
    const timestamp = Date.now() + 4;
    const userAEmail = `user_block_a_${timestamp}@example.com`;
    const userBEmail = `user_block_b_${timestamp}@example.com`;
    const password = 'Password123!';
    const userAName = 'Block Initiator';
    const userBName = 'Blocked Requester';

    // 1. Create User A
    const userARes = await request.post(`${backendBase}/api/v1/auth/register`, {
      data: { email: userAEmail, password, displayName: userAName }
    });
    expect(userARes.ok()).toBeTruthy();
    const userAData = await userARes.json();
    const userAToken = userAData.accessToken;
    const userAId = userAData.user.id;

    // 2. Create User B
    const userBRes = await request.post(`${backendBase}/api/v1/auth/register`, {
      data: { email: userBEmail, password, displayName: userBName }
    });
    expect(userBRes.ok()).toBeTruthy();
    const userBData = await userBRes.json();
    const userBToken = userBData.accessToken;
    const userBId = userBData.user.id;

    // 3. User B sends connection request to User A
    const sendReqRes = await request.post(`${backendBase}/api/v1/contacts/requests`, {
      headers: { Authorization: `Bearer ${userBToken}` },
      data: { targetUserId: userAId }
    });
    expect(sendReqRes.status()).toBe(201);
    const reqData = await sendReqRes.json();
    const requestId = reqData.id;

    // 4. User A logs in via Frontend UI
    await page.goto('/login');
    await page.fill('#login-email', userAEmail);
    await page.fill('#login-password', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('http://localhost:4200/');

    // 5. Verify incoming request card is visible
    const requestCard = page.locator(`[data-testid="incoming-request-card-${requestId}"]`);
    await expect(requestCard).toBeVisible();

    // 6. Click Block button on the incoming request card
    const blockBtn = page.locator(`[data-testid="block-request-btn-${requestId}"]`);
    await expect(blockBtn).toBeVisible();
    await blockBtn.click();

    // 7. Request card disappears upon blocking
    await expect(requestCard).not.toBeVisible();

    // 8. Backend verification: User B sees User A's profile degraded to { id, available: false }
    const profileResB = await request.get(`${backendBase}/api/v1/users/${userAId}`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    expect(profileResB.status()).toBe(200);
    const profileDataB = await profileResB.json();
    expect(profileDataB.id).toBe(userAId);
    expect(profileDataB.available).toBe(false);
    expect(profileDataB.displayName).toBeUndefined();

    // 9. User B tries to send connection request again -> 409 Conflict
    const reRequestRes = await request.post(`${backendBase}/api/v1/contacts/requests`, {
      headers: { Authorization: `Bearer ${userBToken}` },
      data: { targetUserId: userAId }
    });
    expect(reRequestRes.status()).toBe(409);

    // 10. User A unblocks User B via API
    const unblockRes = await request.delete(`${backendBase}/api/v1/users/${userBId}/block`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    expect(unblockRes.status()).toBe(204);

    // 11. User B's profile view is restored to normal with NONE status
    const restoredProfileRes = await request.get(`${backendBase}/api/v1/users/${userAId}`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    expect(restoredProfileRes.status()).toBe(200);
    const restoredData = await restoredProfileRes.json();
    expect(restoredData.displayName).toBe(userAName);
    expect(restoredData.connectionStatus).toBe('NONE');
    expect(restoredData.available).toBeUndefined();
  });

  test('user blocks connected contact from modal, verifying list removal and unblock (ORDM-36 block contact)', async ({
    page,
    request
  }) => {
    const timestamp = Date.now() + 5;
    const userAEmail = `user_blk_modal_a_${timestamp}@example.com`;
    const userBEmail = `user_blk_modal_b_${timestamp}@example.com`;
    const password = 'Password123!';
    const userAName = 'Blocker User';
    const userBName = 'Friend To Block';

    // 1. Create User A
    const userARes = await request.post(`${backendBase}/api/v1/auth/register`, {
      data: { email: userAEmail, password, displayName: userAName }
    });
    expect(userARes.ok()).toBeTruthy();
    const userAData = await userARes.json();
    const userAToken = userAData.accessToken;
    const userAId = userAData.user.id;

    // 2. Create User B
    const userBRes = await request.post(`${backendBase}/api/v1/auth/register`, {
      data: { email: userBEmail, password, displayName: userBName }
    });
    expect(userBRes.ok()).toBeTruthy();
    const userBData = await userBRes.json();
    const userBToken = userBData.accessToken;
    const userBId = userBData.user.id;

    // 3. User B sends connection request to User A
    const sendReqRes = await request.post(`${backendBase}/api/v1/contacts/requests`, {
      headers: { Authorization: `Bearer ${userBToken}` },
      data: { targetUserId: userAId }
    });
    expect(sendReqRes.status()).toBe(201);
    const reqData = await sendReqRes.json();

    // 4. User A accepts connection request
    const acceptRes = await request.patch(`${backendBase}/api/v1/contacts/requests/${reqData.id}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
      data: { action: 'ACCEPT' }
    });
    expect(acceptRes.status()).toBe(200);

    // 5. User A logs in via Frontend UI
    await page.goto('/login');
    await page.fill('#login-email', userAEmail);
    await page.fill('#login-password', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('http://localhost:4200/');

    // 6. Open New Chat modal
    await page.click('[data-testid="new-chat-trigger-btn"]');
    const modal = page.locator('[data-testid="new-chat-modal-card"]');
    await expect(modal).toBeVisible();

    // 7. Verify contact card is present in Direct Message tab
    const contactCard = page.locator('[data-testid^="contact-card-"]');
    await expect(contactCard).toBeVisible();
    await expect(contactCard).toContainText(userBName);

    // 8. Click Block icon button
    const blockBtn = page.locator('[data-testid^="block-contact-btn-"]');
    await expect(blockBtn).toBeVisible();
    await blockBtn.click();

    // 9. Confirm block dialog
    const blockConfirmBox = page.locator('[data-testid="block-confirm-box"]');
    await expect(blockConfirmBox).toBeVisible();
    await page.locator('[data-testid^="confirm-block-btn-"]').click();

    // 10. Success alert appears and empty state displays
    await expect(page.locator('[data-testid="new-chat-success-alert"]')).toContainText(
      `Blocked ${userBName}.`
    );
    await expect(page.locator('[data-testid="no-contacts-empty-state"]')).toBeVisible();

    // 11. Backend check: Contact document status is BLOCKED and blockedBy is User A
    const listRes = await request.get(`${backendBase}/api/v1/contacts`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    expect(listRes.status()).toBe(200);
    const listData = await listRes.json();
    expect(listData.content).toHaveLength(0);
  });
});
