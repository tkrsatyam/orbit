import { expect, test } from '@playwright/test';

test.describe('View & Update Group Details Flow (ORDM-38)', () => {
  const backendBase = 'http://localhost:8080';

  test('admin views group details and updates metadata via edit modal', async ({ page, request }) => {
    const timestamp = Date.now();
    const adminEmail = `admin_details_${timestamp}@example.com`;
    const password = 'Password123!';
    const adminName = 'Lead Architect';

    // 1. Register Admin
    await page.goto('/register');
    await page.fill('#register-displayName', adminName);
    await page.fill('#register-email', adminEmail);
    await page.fill('#register-password', password);
    await page.click('button:has-text("Create account")');
    await expect(page).toHaveURL('http://localhost:4200/');

    // 2. Create Group via UI
    await page.click('[data-testid="nav-tab-groups"]');
    await page.click('[data-testid="create-group-trigger-btn"]');

    const originalName = `Architecture Space ${timestamp}`;
    await page.fill('#group-name', originalName);
    await page.fill('#group-topic', 'systems');
    await page.fill('#group-desc', 'Distributed systems design and trade-offs');
    await page.click('[data-testid="submit-create-group-btn"]');

    // 3. Click newly created group in sidebar to navigate into /groups/:id
    const groupItem = page.locator('[data-testid="groups-sidebar-list"]').locator(`text=${originalName}`);
    await expect(groupItem).toBeVisible();
    await groupItem.click();

    await expect(page).toHaveURL(new RegExp('/groups/'));

    // 4. Verify Group View Header
    await expect(page.locator('[data-testid="group-view-name"]')).toHaveText(originalName);
    await expect(page.locator('[data-testid="group-view-topic"]')).toHaveText('#systems');
    await expect(page.locator('[data-testid="group-view-member-count"]')).toHaveText('1 member');
    await expect(page.locator('[data-testid="group-view-desc"]')).toContainText('Distributed systems design and trade-offs');

    // 5. Verify Admin Actions
    const editBtn = page.locator('[data-testid="edit-group-trigger-btn"]');
    const inviteBtn = page.locator('[data-testid="generate-invite-trigger-btn"]');
    await expect(editBtn).toBeVisible();
    await expect(inviteBtn).toBeVisible();

    // 6. Open Edit Modal
    await editBtn.click();
    const modalBackdrop = page.locator('[data-testid="edit-group-modal-backdrop"]');
    await expect(modalBackdrop).toBeVisible();

    // Verify pre-populated values
    await expect(page.locator('#edit-group-name')).toHaveValue(originalName);

    // 7. Edit metadata
    const updatedName = `Cloud Architecture Hub ${timestamp}`;
    await page.fill('#edit-group-name', updatedName);
    await page.fill('#edit-group-topic', 'cloud-native');
    await page.fill('#edit-group-desc', 'Deep dive into Kubernetes, Kafka and event streams');

    await page.click('[data-testid="submit-edit-group-btn"]');

    // 8. Modal closes and header displays updated values immediately
    await expect(modalBackdrop).not.toBeVisible();
    await expect(page.locator('[data-testid="group-view-name"]')).toHaveText(updatedName);
    await expect(page.locator('[data-testid="group-view-topic"]')).toHaveText('#cloud-native');
    await expect(page.locator('[data-testid="group-view-desc"]')).toContainText('Kubernetes, Kafka and event streams');

    // 9. Verify sidebar shows updated name in 3-pane workstation
    await expect(page.locator('[data-testid="groups-sidebar-list"]')).toContainText(updatedName);
  });

  test('non-admin member can view details but cannot see admin edit controls', async ({ page, request }) => {
    const timestamp = Date.now();
    const creatorEmail = `creator_${timestamp}@example.com`;
    const memberEmail = `member_${timestamp}@example.com`;
    const password = 'Password123!';

    // 1. Create group and generate invite via backend API
    const creatorRes = await request.post(`${backendBase}/api/v1/auth/register`, {
      data: { email: creatorEmail, password, displayName: 'Creator Admin' }
    });
    const creatorToken = (await creatorRes.json()).accessToken;

    const groupRes = await request.post(`${backendBase}/api/v1/groups`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      data: {
        name: `Restricted Access Space ${timestamp}`,
        topicTag: '#security',
        description: 'Read-only access for general members',
        visibility: 'PUBLIC'
      }
    });
    const groupId = (await groupRes.json()).id;

    // 2. Register Member via UI
    await page.goto('/register');
    await page.fill('#register-displayName', 'Auditor Member');
    await page.fill('#register-email', memberEmail);
    await page.fill('#register-password', password);
    await page.click('button:has-text("Create account")');
    await expect(page).toHaveURL('http://localhost:4200/');

    // 3. Member navigates to the group
    await page.goto(`/groups/${groupId}`);

    // 4. Group details are visible
    await expect(page.locator('[data-testid="group-view-name"]')).toHaveText(`Restricted Access Space ${timestamp}`);
    await expect(page.locator('[data-testid="group-view-topic"]')).toHaveText('#security');

    // 5. Admin edit and invite buttons are NOT visible for member
    await expect(page.locator('[data-testid="edit-group-trigger-btn"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="generate-invite-trigger-btn"]')).not.toBeVisible();
  });
});
