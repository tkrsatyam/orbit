import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { GroupComponent } from './group.component';
import { GroupResponse, GroupService } from '../../core/services/group.service';
import { AuthService } from '../../core/services/auth.service';

describe('GroupComponent', () => {
  let component: GroupComponent;
  let fixture: ComponentFixture<GroupComponent>;
  let mockGroupService: {
    getGroupDetails: ReturnType<typeof vi.fn>;
    updateGroup: ReturnType<typeof vi.fn>;
    generateInvite: ReturnType<typeof vi.fn>;
    loadMyGroups: ReturnType<typeof vi.fn>;
    myGroups: ReturnType<typeof vi.fn>;
    getGroupMembers: ReturnType<typeof vi.fn>;
    updateMemberRole: ReturnType<typeof vi.fn>;
    leaveGroup: ReturnType<typeof vi.fn>;
    removeMember: ReturnType<typeof vi.fn>;
    deleteGroup: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: {
    currentUser: ReturnType<typeof vi.fn>;
  };

  const mockAdminGroup: GroupResponse = {
    id: 'group-101',
    name: 'Distributed Systems Space',
    description: 'Weekly deep dives into consensus algorithms',
    topicTag: '#distributed',
    visibility: 'PUBLIC',
    avatarUrl: null,
    coverImageUrl: null,
    memberCount: 14,
    conversationId: 'conv-101',
    createdAt: '2026-10-21T10:00:00Z',
    role: 'ADMIN'
  };

  const setupComponent = async (paramId: string | null = 'group-101', groupToReturn = mockAdminGroup) => {
    mockGroupService = {
      getGroupDetails: vi.fn().mockReturnValue(of(groupToReturn)),
      updateGroup: vi.fn().mockReturnValue(of({ ...groupToReturn, name: 'Renamed Space' })),
      generateInvite: vi.fn().mockReturnValue(of({ inviteLink: 'http://localhost/invite/tok-999', expiresAt: '2026-10-28T00:00:00Z' })),
      loadMyGroups: vi.fn().mockReturnValue(of([groupToReturn])),
      myGroups: vi.fn().mockReturnValue([groupToReturn]),
      getGroupMembers: vi.fn().mockReturnValue(of({
        content: [
          {
            userId: 'u-1',
            displayName: 'Lead Admin',
            avatarUrl: null,
            role: 'ADMIN',
            online: true,
            joinedAt: '2026-10-21T10:00:00Z'
          },
          {
            userId: 'u-2',
            displayName: 'Dev Contributor',
            avatarUrl: null,
            role: 'MEMBER',
            online: false,
            joinedAt: '2026-10-21T11:00:00Z'
          }
        ]
      })),
      updateMemberRole: vi.fn().mockReturnValue(of({
        userId: 'u-2',
        displayName: 'Dev Contributor',
        avatarUrl: null,
        role: 'ADMIN',
        online: false,
        joinedAt: '2026-10-21T11:00:00Z'
      })),
      leaveGroup: vi.fn().mockReturnValue(of(void 0)),
      removeMember: vi.fn().mockReturnValue(of(void 0)),
      deleteGroup: vi.fn().mockReturnValue(of(void 0))
    };

    mockAuthService = {
      currentUser: vi.fn().mockReturnValue({ id: 'u-1', displayName: 'Lead Admin' })
    };

    await TestBed.configureTestingModule({
      imports: [GroupComponent],
      providers: [
        provideRouter([]),
        { provide: GroupService, useValue: mockGroupService },
        { provide: AuthService, useValue: mockAuthService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'id' ? paramId : null)
              }
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GroupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('should load and render group header details', async () => {
    await setupComponent();

    expect(mockGroupService.getGroupDetails).toHaveBeenCalledWith('group-101');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="group-view-name"]')?.textContent?.trim()).toBe('Distributed Systems Space');
    expect(compiled.querySelector('[data-testid="group-view-topic"]')?.textContent?.trim()).toBe('#distributed');
    expect(compiled.querySelector('[data-testid="group-view-member-count"]')?.textContent?.trim()).toBe('14 members');
    expect(compiled.querySelector('[data-testid="group-view-desc"]')?.textContent).toContain('Weekly deep dives into consensus algorithms');
  });

  it('should show admin action buttons when user role is ADMIN', async () => {
    await setupComponent('group-101', mockAdminGroup);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="edit-group-trigger-btn"]')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="generate-invite-trigger-btn"]')).not.toBeNull();
  });

  it('should hide admin action buttons when user role is MEMBER', async () => {
    const memberGroup: GroupResponse = {
      ...mockAdminGroup,
      role: 'MEMBER'
    };
    await setupComponent('group-101', memberGroup);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="edit-group-trigger-btn"]')).toBeNull();
    expect(compiled.querySelector('[data-testid="generate-invite-trigger-btn"]')).toBeNull();
  });

  it('should display error state when getGroupDetails fails', async () => {
    await setupComponent();
    mockGroupService.getGroupDetails.mockReturnValue(throwError(() => ({
      error: { message: 'Group not found' }
    })));

    component.loadGroupDetails('group-not-found');
    fixture.detectChanges();

    expect(component.errorMessage()).toBe('Group not found');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="group-error-state"]')).not.toBeNull();
  });

  it('should open edit modal, patch form values, and submit updates', async () => {
    await setupComponent();

    component.openEditModal();
    fixture.detectChanges();

    expect(component.isEditModalOpen()).toBe(true);
    expect(component.editForm.get('name')?.value).toBe('Distributed Systems Space');

    component.editForm.patchValue({
      name: 'Renamed Space',
      topicTag: 'consensus'
    });

    component.submitEdit();
    fixture.detectChanges();

    expect(mockGroupService.updateGroup).toHaveBeenCalledWith('group-101', {
      name: 'Renamed Space',
      topicTag: '#consensus',
      description: 'Weekly deep dives into consensus algorithms'
    });
    expect(component.isEditModalOpen()).toBe(false);
  });

  it('should generate invite link when button is clicked', async () => {
    await setupComponent();

    component.generateInviteLink();
    fixture.detectChanges();

    expect(mockGroupService.generateInvite).toHaveBeenCalledWith('group-101');
    expect(component.inviteLink()).toBe('http://localhost/invite/tok-999');
  });

  it('should toggle members drawer and fetch member roster', async () => {
    await setupComponent();

    expect(component.isMembersDrawerOpen()).toBe(false);

    component.toggleMembersDrawer();
    fixture.detectChanges();

    expect(component.isMembersDrawerOpen()).toBe(true);
    expect(mockGroupService.getGroupMembers).toHaveBeenCalledWith('group-101');
    expect(component.members().length).toBe(2);

    const compiled = fixture.nativeElement as HTMLElement;
    const drawer = compiled.querySelector('[data-testid="members-drawer"]');
    expect(drawer).not.toBeNull();
    const memberItems = compiled.querySelectorAll('[data-testid="member-item"]');
    expect(memberItems.length).toBe(2);
    expect(memberItems[0].textContent).toContain('Lead Admin');
    expect(memberItems[1].textContent).toContain('Dev Contributor');
  });

  it('should allow admin to promote member to admin', async () => {
    await setupComponent();
    component.toggleMembersDrawer();
    fixture.detectChanges();

    const targetMember = component.members()[1]; // Dev Contributor (MEMBER)
    component.toggleMemberRole(targetMember);
    fixture.detectChanges();

    expect(mockGroupService.updateMemberRole).toHaveBeenCalledWith('group-101', 'u-2', { role: 'ADMIN' });
    expect(component.members()[1].role).toBe('ADMIN');
  });

  it('should display error when updating member role fails', async () => {
    await setupComponent();
    component.toggleMembersDrawer();
    fixture.detectChanges();

    mockGroupService.updateMemberRole.mockReturnValue(throwError(() => ({
      error: { message: 'Cannot demote the sole admin of the group' }
    })));

    const adminMember = component.members()[0];
    component.toggleMemberRole(adminMember);
    fixture.detectChanges();

    expect(component.memberActionError()).toBe('Cannot demote the sole admin of the group');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="member-action-error"]')?.textContent).toContain(
      'Cannot demote the sole admin of the group'
    );
  });

  it('should open and close leave space modal', async () => {
    await setupComponent();
    expect(component.isLeaveModalOpen()).toBe(false);

    component.openLeaveModal();
    fixture.detectChanges();
    expect(component.isLeaveModalOpen()).toBe(true);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="leave-group-modal-card"]')).not.toBeNull();

    component.closeLeaveModal();
    fixture.detectChanges();
    expect(component.isLeaveModalOpen()).toBe(false);
  });

  it('should leave group and navigate to / on confirmation', async () => {
    await setupComponent();
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate');

    component.openLeaveModal();
    component.confirmLeaveGroup();
    fixture.detectChanges();

    expect(mockGroupService.leaveGroup).toHaveBeenCalledWith('group-101');
    expect(navSpy).toHaveBeenCalledWith(['/']);
    expect(component.isLeaveModalOpen()).toBe(false);
  });

  it('should display error if leaveGroup fails', async () => {
    await setupComponent();
    mockGroupService.leaveGroup.mockReturnValue(throwError(() => ({
      error: { message: 'Failed to depart space' }
    })));

    component.openLeaveModal();
    component.confirmLeaveGroup();
    fixture.detectChanges();

    expect(component.leaveError()).toBe('Failed to depart space');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="leave-group-error"]')?.textContent).toContain('Failed to depart space');
  });

  it('should allow admin to remove a member', async () => {
    await setupComponent();
    component.toggleMembersDrawer();
    fixture.detectChanges();

    const target = component.members()[1]; // Dev Contributor
    component.removeMember(target);
    fixture.detectChanges();

    expect(mockGroupService.removeMember).toHaveBeenCalledWith('group-101', 'u-2');
    expect(component.members().length).toBe(1);
    expect(component.members()[0].userId).toBe('u-1');
    expect(component.group()?.memberCount).toBe(13);
  });

  it('should display error when removeMember fails', async () => {
    await setupComponent();
    component.toggleMembersDrawer();
    fixture.detectChanges();

    mockGroupService.removeMember.mockReturnValue(throwError(() => ({
      error: { message: 'Cannot remove member' }
    })));

    const target = component.members()[1];
    component.removeMember(target);
    fixture.detectChanges();

    expect(component.memberActionError()).toBe('Cannot remove member');
  });

  it('should open and close remove member modal', async () => {
    await setupComponent();
    const target = mockMemberList[1];
    component.openRemoveMemberModal(target);
    expect(component.isRemoveMemberModalOpen()).toBe(true);
    expect(component.memberToRemove()).toEqual(target);

    component.closeRemoveMemberModal();
    expect(component.isRemoveMemberModalOpen()).toBe(false);
    expect(component.memberToRemove()).toBeNull();
  });

  it('should remove member on confirmRemoveMember', async () => {
    await setupComponent();
    component.toggleMembersDrawer();
    const target = mockMemberList[1];
    component.openRemoveMemberModal(target);
    component.confirmRemoveMember();

    expect(mockGroupService.removeMember).toHaveBeenCalledWith('group-101', 'u-2');
    expect(component.isRemoveMemberModalOpen()).toBe(false);
  });

  it('should open and close delete space modal', async () => {
    await setupComponent();
    expect(component.isDeleteSpaceModalOpen()).toBe(false);

    component.openDeleteSpaceModal();
    fixture.detectChanges();
    expect(component.isDeleteSpaceModalOpen()).toBe(true);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="delete-space-modal-card"]')).not.toBeNull();

    component.closeDeleteSpaceModal();
    fixture.detectChanges();
    expect(component.isDeleteSpaceModalOpen()).toBe(false);
  });

  it('should delete group and navigate to / on confirmation', async () => {
    await setupComponent();
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate');

    component.openDeleteSpaceModal();
    component.confirmDeleteSpace();
    fixture.detectChanges();

    expect(mockGroupService.deleteGroup).toHaveBeenCalledWith('group-101');
    expect(navSpy).toHaveBeenCalledWith(['/']);
    expect(component.isDeleteSpaceModalOpen()).toBe(false);
  });

  it('should display error if deleteGroup fails', async () => {
    await setupComponent();
    mockGroupService.deleteGroup.mockReturnValue(throwError(() => ({
      error: { message: 'Failed to delete space' }
    })));

    component.openDeleteSpaceModal();
    component.confirmDeleteSpace();
    fixture.detectChanges();

    expect(component.deleteSpaceError()).toBe('Failed to delete space');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="delete-space-error"]')?.textContent).toContain('Failed to delete space');
  });
});
