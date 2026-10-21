import { expect, test } from '@playwright/test';

test.describe('Group Member List & Role Management Flow (ORDM-39)', () => {
  const backendBase = 'http://localhost:8080';

  test('admin views member roster, promotes a member to admin, and manages member roles', async ({ page, request }) => {
    const timestamp = Date.now();
    const adminEmail = `admin_roster_${timestamp}@example.com`;
    const memberEmail = `member_roster_${timestamp}@example.com`;
    const password = 'Password123!';
    const adminName = 'Lead Architect';
    const memberName = 'Cloud Engineer';

    // 1. Register Admin via backend API
    const adminRegRes = await request.post(`${backendBase}/api/v1/auth/register`, {
      data: { email: adminEmail, password, displayName: adminName }
    });
    expect(adminRegRes.status()).toBe(201);
    const adminData = await adminRegRes.json();
    const adminToken = adminData.accessToken;

    // 2. Admin creates group via backend API
    const groupName = `Cloud Infrastructure ${timestamp}`;
    const groupRes = await request.post(`${backendBase}/api/v1/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: groupName,
        topicTag: '#infrastructure',
        description: 'Multi-cloud orchestration and observability',
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

    // 4. Register Member 2 via backend API
    const memberRegRes = await request.post(`${backendBase}/api/v1/auth/register`, {
      data: { email: memberEmail, password, displayName: memberName }
    });
    expect(memberRegRes.status()).toBe(201);
    const memberData = await memberRegRes.json();
    const memberToken = memberData.accessToken;

    // 5. Member 2 joins group via invite
    const joinRes = await request.post(`${backendBase}/api/v1/groups/join-via-invite/${token}`, {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    expect(joinRes.status()).toBe(200);

    // 6. Admin logs in via UI
    await page.goto('/login');
    await page.fill('#login-email', adminEmail);
    await page.fill('#login-password', password);
    await page.click('button.submit-button');
    await expect(page).toHaveURL('http://localhost:4200/');

    // 7. Navigate directly to group details page
    await page.goto(`/groups/${groupId}`);
    await expect(page.locator('[data-testid="group-view-name"]')).toHaveText(groupName);

    // 8. Open Members Drawer in UI
    const membersToggleBtn = page.locator('[data-testid="members-toggle-btn"]');
    await expect(membersToggleBtn).toBeVisible();
    await membersToggleBtn.click();

    const membersDrawer = page.locator('[data-testid="members-drawer"]');
    await expect(membersDrawer).toBeVisible();

    // 9. Check Member items in roster
    const memberItems = membersDrawer.locator('[data-testid="member-item"]');
    await expect(memberItems).toHaveCount(2);

    // Verify Admin row (contains "(You)", role badge ADMIN, NO toggle role button)
    const adminRow = memberItems.filter({ hasText: adminName });
    await expect(adminRow).toContainText('(You)');
    await expect(adminRow.locator('[data-testid="toggle-role-btn"]')).not.toBeVisible();

    // Verify Member 2 row (contains memberName, role badge MEMBER, and "Make Admin" button)
    const memberRow = memberItems.filter({ hasText: memberName });
    await expect(memberRow).toBeVisible();
    await expect(memberRow.locator('[data-role="MEMBER"]')).toBeVisible();

    const roleToggleBtn = memberRow.locator('[data-testid="toggle-role-btn"]');
    await expect(roleToggleBtn).toHaveText('Make Admin');

    // 10. Promote Member 2 to Admin
    await roleToggleBtn.click();

    // Verify role badge updates to ADMIN and button text becomes Demote
    await expect(memberRow.locator('[data-role="ADMIN"]')).toBeVisible();
    await expect(roleToggleBtn).toHaveText('Demote');

    // 11. Demote Member 2 back to Member
    await roleToggleBtn.click();
    await expect(memberRow.locator('[data-role="MEMBER"]')).toBeVisible();
    await expect(roleToggleBtn).toHaveText('Make Admin');

    // 12. Close Members Drawer
    await page.click('[data-testid="close-members-drawer-btn"]');
    await expect(membersDrawer).not.toBeVisible();
  });
});
