import { expect, test } from '@playwright/test';

test.describe('Leave Group & Automated Admin Promotion Flow (ORDM-40)', () => {
  const backendBase = 'http://localhost:8080';

  test('admin leaves group triggering auto-promotion of next member, then last member leaves triggering deletion', async ({ page, request }) => {
    const timestamp = Date.now();
    const adminEmail = `admin_leave_${timestamp}@example.com`;
    const memberEmail = `member_leave_${timestamp}@example.com`;
    const password = 'Password123!';
    const adminName = 'Founder Admin';
    const memberName = 'Successor Member';

    // 1. Register Admin via backend API
    const adminRegRes = await request.post(`${backendBase}/api/v1/auth/register`, {
      data: { email: adminEmail, password, displayName: adminName }
    });
    expect(adminRegRes.status()).toBe(201);
    const adminData = await adminRegRes.json();
    const adminToken = adminData.accessToken;

    // 2. Admin creates group via backend API
    const groupName = `Founders Space ${timestamp}`;
    const groupRes = await request.post(`${backendBase}/api/v1/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: groupName,
        topicTag: '#founders',
        description: 'Auto-promotion and lifecycle testing',
        visibility: 'PUBLIC'
      }
    });
    expect(groupRes.status()).toBe(201);
    const groupData = await groupRes.json();
    const groupId = groupData.id;

    // 3. Admin generates invite link
    const inviteRes = await request.post(`${backendBase}/api/v1/groups/${groupId}/invite`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(inviteRes.status()).toBe(201);
    const inviteData = await inviteRes.json();
    const inviteUrl = inviteData.inviteLink;
    const token = inviteUrl.substring(inviteUrl.lastIndexOf('/') + 1);

    // 4. Register Member 2 via backend API and join via invite
    const memberRegRes = await request.post(`${backendBase}/api/v1/auth/register`, {
      data: { email: memberEmail, password, displayName: memberName }
    });
    expect(memberRegRes.status()).toBe(201);
    const memberData = await memberRegRes.json();
    const memberToken = memberData.accessToken;

    const joinRes = await request.post(`${backendBase}/api/v1/groups/join-via-invite/${token}`, {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    expect(joinRes.status()).toBe(200);

    // 5. Admin logs in via UI
    await page.goto('/login');
    await page.fill('#login-email', adminEmail);
    await page.fill('#login-password', password);
    await page.click('button.submit-button');
    await expect(page).toHaveURL('http://localhost:4200/');

    // 6. Navigate directly to group details page
    await page.goto(`/groups/${groupId}`);
    await expect(page.locator('[data-testid="group-view-name"]')).toHaveText(groupName);

    // 7. Click Leave Space trigger button
    const leaveBtn = page.locator('[data-testid="leave-group-trigger-btn"]');
    await expect(leaveBtn).toBeVisible();
    await leaveBtn.click();

    // 8. Confirm in Leave Modal
    const modalBackdrop = page.locator('[data-testid="leave-group-modal-backdrop"]');
    await expect(modalBackdrop).toBeVisible();

    const confirmLeaveBtn = page.locator('[data-testid="confirm-leave-group-btn"]');
    await expect(confirmLeaveBtn).toBeVisible();
    await confirmLeaveBtn.click();

    // 9. Redirected to conversations / root
    await expect(page).toHaveURL('http://localhost:4200/');

    // 10. Verify via API that Member 2 was auto-promoted to ADMIN
    const membersRes = await request.get(`${backendBase}/api/v1/groups/${groupId}/members`, {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    expect(membersRes.status()).toBe(200);
    const membersData = await membersRes.json();
    expect(membersData.content.length).toBe(1);
    expect(membersData.content[0].userId).toBe(memberData.user.id);
    expect(membersData.content[0].role).toBe('ADMIN');

    // 11. Clear session cookies so Member 2 can log in cleanly
    await page.context().clearCookies();

    // 12. Now Member 2 logs in via UI and leaves as the last member
    await page.goto('/login');
    await page.fill('#login-email', memberEmail);
    await page.fill('#login-password', password);
    await page.click('button.submit-button');
    await expect(page).toHaveURL('http://localhost:4200/');

    await page.goto(`/groups/${groupId}`);
    await expect(page.locator('[data-testid="group-view-name"]')).toHaveText(groupName);

    await page.click('[data-testid="leave-group-trigger-btn"]');
    await expect(page.locator('[data-testid="leave-group-modal-backdrop"]')).toBeVisible();
    await page.click('[data-testid="confirm-leave-group-btn"]');

    await expect(page).toHaveURL('http://localhost:4200/');

    // 13. Verify group is permanently deleted in backend
    const checkGroupRes = await request.get(`${backendBase}/api/v1/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    expect(checkGroupRes.status()).toBe(404);
  });
});
