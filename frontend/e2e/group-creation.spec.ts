import { expect, test } from '@playwright/test';

test.describe('Group Creation, Visibility & Invite Access Flow (ORDM-37)', () => {
  const backendBase = 'http://localhost:8080';

  test('user creates public group via UI modal and verifies it in sidebar', async ({ page, request }) => {
    const timestamp = Date.now();
    const creatorEmail = `creator_${timestamp}@example.com`;
    const password = 'Password123!';
    const creatorName = 'Guild Architect';

    // 1. Register Creator
    await page.goto('/register');
    await page.fill('#register-displayName', creatorName);
    await page.fill('#register-email', creatorEmail);
    await page.fill('#register-password', password);
    await page.click('button:has-text("Create account")');

    await expect(page).toHaveURL('http://localhost:4200/');

    // 2. Navigate to Groups tab in rail
    const groupsTabBtn = page.locator('[data-testid="nav-tab-groups"]');
    await expect(groupsTabBtn).toBeVisible();
    await groupsTabBtn.click();

    // 3. Open Create Group Modal
    const createBtn = page.locator('[data-testid="create-group-trigger-btn"]');
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    const modalBackdrop = page.locator('[data-testid="create-group-modal-backdrop"]');
    await expect(modalBackdrop).toBeVisible();

    // 4. Fill Create Group Form
    const groupName = `System Design Space ${timestamp}`;
    await page.fill('#group-name', groupName);
    await page.fill('#group-topic', 'system-design');
    await page.fill('#group-desc', 'Weekly distributed system architectural reviews');

    // 5. Submit form
    const submitBtn = page.locator('[data-testid="submit-create-group-btn"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 6. Modal closes and group appears in list
    await expect(modalBackdrop).not.toBeVisible();
    const groupList = page.locator('[data-testid="groups-sidebar-list"]');
    await expect(groupList).toContainText(groupName);
    await expect(groupList).toContainText('#system-design');
    await expect(groupList).toContainText('PUBLIC');
  });

  test('user creates private group and joins another user via invite link', async ({ page, request }) => {
    const timestamp = Date.now();
    const creatorEmail = `private_admin_${timestamp}@example.com`;
    const joinerEmail = `invitee_${timestamp}@example.com`;
    const password = 'Password123!';
    const creatorName = 'Lead Operator';
    const joinerName = 'New Specialist';

    // 1. Create Admin via backend API & create group
    const creatorRes = await request.post(`${backendBase}/api/v1/auth/register`, {
      data: { email: creatorEmail, password, displayName: creatorName }
    });
    expect(creatorRes.ok()).toBeTruthy();
    const creatorData = await creatorRes.json();
    const creatorToken = creatorData.accessToken;

    const groupRes = await request.post(`${backendBase}/api/v1/groups`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      data: {
        name: `Stealth Core ${timestamp}`,
        topicTag: '#security',
        description: 'Classified team operations',
        visibility: 'PRIVATE'
      }
    });
    expect(groupRes.status()).toBe(201);
    const groupData = await groupRes.json();
    const groupId = groupData.id;

    // 2. Admin generates invite link
    const inviteRes = await request.post(`${backendBase}/api/v1/groups/${groupId}/invite`, {
      headers: { Authorization: `Bearer ${creatorToken}` }
    });
    expect(inviteRes.status()).toBe(201);
    const inviteData = await inviteRes.json();
    const inviteUrl = inviteData.inviteLink;
    const token = inviteUrl.substring(inviteUrl.lastIndexOf('/') + 1);

    // 3. Register Joiner via UI
    await page.goto('/register');
    await page.fill('#register-displayName', joinerName);
    await page.fill('#register-email', joinerEmail);
    await page.fill('#register-password', password);
    await page.click('button:has-text("Create account")');
    await expect(page).toHaveURL('http://localhost:4200/');

    // 4. Joiner navigates to invite redemption URL
    await page.goto(`/invite/${token}`);

    // 5. Join confirmation page is visible
    const joinCard = page.locator('.invite-card');
    await expect(joinCard).toBeVisible();
    await expect(page.locator('.box-heading')).toContainText("You're in!");

    // 6. Navigate into group
    const enterBtn = page.locator('[data-testid="enter-group-chat-btn"]');
    await expect(enterBtn).toBeVisible();
    await enterBtn.click();

    // Redirected to /groups/{groupId}
    await expect(page).toHaveURL(new RegExp(`/groups/${groupId}`));
  });
});
