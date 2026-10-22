import { expect, test } from '@playwright/test';

test.describe('Admin Remove Member & Delete Group Flow (ORDM-41)', () => {
  const backendBase = 'http://localhost:8080';

  test('admin evicts member from group, then permanently deletes the group', async ({ page, request }) => {
    const timestamp = Date.now();
    const adminEmail = `admin_evict_${timestamp}@example.com`;
    const memberEmail = `member_evict_${timestamp}@example.com`;
    const password = 'Password123!';
    const adminName = 'Lead Operator';
    const memberName = 'Dev Contributor';

    // 1. Register Admin via backend API
    const adminRegRes = await request.post(`${backendBase}/api/v1/auth/register`, {
      data: { email: adminEmail, password, displayName: adminName }
    });
    expect(adminRegRes.status()).toBe(201);
    const adminData = await adminRegRes.json();
    const adminToken = adminData.accessToken;

    // 2. Admin creates group via backend API
    const groupName = `Operations Cluster ${timestamp}`;
    const groupRes = await request.post(`${backendBase}/api/v1/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: groupName,
        topicTag: '#operations',
        description: 'Cluster administration and eviction testing',
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

    // 7. Open Members Drawer
    await page.click('[data-testid="members-toggle-btn"]');
    const membersDrawer = page.locator('[data-testid="members-drawer"]');
    await expect(membersDrawer).toBeVisible();

    // 8. Find Member 2 row and click remove member button
    const memberRow = membersDrawer.locator('[data-testid="member-item"]').filter({ hasText: memberName });
    await expect(memberRow).toBeVisible();

    const removeMemberBtn = memberRow.locator('[data-testid="remove-member-btn"]');
    await expect(removeMemberBtn).toBeVisible();
    await removeMemberBtn.click();

    // Confirm in remove member modal
    const confirmRemoveBtn = page.locator('[data-testid="confirm-remove-member-btn"]');
    await expect(confirmRemoveBtn).toBeVisible();
    await confirmRemoveBtn.click();

    // Verify Member 2 is evicted from roster in UI
    await expect(memberRow).not.toBeVisible();
    await expect(membersDrawer.locator('[data-testid="member-item"]')).toHaveCount(1);

    // Verify via backend API that Member 2 is no longer in group members
    const membersRes = await request.get(`${backendBase}/api/v1/groups/${groupId}/members`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(membersRes.status()).toBe(200);
    const membersData = await membersRes.json();
    expect(membersData.content).toHaveLength(1);
    expect(membersData.content[0].userId).toBe(adminData.user.id);

    // 9. Admin triggers Delete Space modal
    const deleteSpaceBtn = page.locator('[data-testid="delete-space-trigger-btn"]');
    await expect(deleteSpaceBtn).toBeVisible();
    await deleteSpaceBtn.click();

    // 10. Confirm in Delete Space Modal
    const deleteModalBackdrop = page.locator('[data-testid="delete-space-modal-backdrop"]');
    await expect(deleteModalBackdrop).toBeVisible();

    const confirmDeleteBtn = page.locator('[data-testid="confirm-delete-space-btn"]');
    await expect(confirmDeleteBtn).toBeVisible();
    await confirmDeleteBtn.click();

    // 11. Navigated back to /
    await expect(page).toHaveURL('http://localhost:4200/');

    // 12. Verify group is permanently deleted in backend API
    const checkGroupRes = await request.get(`${backendBase}/api/v1/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(checkGroupRes.status()).toBe(404);
  });
});
