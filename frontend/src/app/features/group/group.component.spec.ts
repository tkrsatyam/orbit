import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { GroupComponent } from './group.component';
import { GroupResponse, GroupService } from '../../core/services/group.service';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { ContactService } from '../../core/services/contact.service';
import { MessageService } from '../../core/services/message/message.service';
import { ConversationService } from '../../core/services/conversation.service';
import { WebSocketService } from '../../core/services/websocket/websocket.service';
import { MessageResponse } from '../../core/models/message.model';

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
  let mockMessageService: {
    getConversationMessages: ReturnType<typeof vi.fn>;
    subscribeToConversation: ReturnType<typeof vi.fn>;
    subscribeToReceipts: ReturnType<typeof vi.fn>;
    subscribeToEdits: ReturnType<typeof vi.fn>;
    subscribeToDeletes: ReturnType<typeof vi.fn>;
    subscribeToTyping: ReturnType<typeof vi.fn>;
    sendMessageStomp: ReturnType<typeof vi.fn>;
    sendMessageRest: ReturnType<typeof vi.fn>;
    editMessage: ReturnType<typeof vi.fn>;
    deleteMessage: ReturnType<typeof vi.fn>;
    sendTyping: ReturnType<typeof vi.fn>;
    isWebSocketConnected: ReturnType<typeof vi.fn>;
    markMessageAsRead: ReturnType<typeof vi.fn>;
    markMessagesAsRead: ReturnType<typeof vi.fn>;
  };
  let mockWebSocketService: {
    subscribe: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
    isConnected: ReturnType<typeof vi.fn>;
  };
  let mockConversationService: {
    resetUnreadCount: ReturnType<typeof vi.fn>;
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

  const mockMemberList: Array<{
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    role: 'ADMIN' | 'MEMBER';
    online: boolean;
    joinedAt: string;
  }> = [
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
  ];

  const setupComponent = async (paramId: string | null = 'group-101', groupToReturn = mockAdminGroup) => {
    mockGroupService = {
      getGroupDetails: vi.fn().mockReturnValue(of(groupToReturn)),
      updateGroup: vi.fn().mockReturnValue(of({ ...groupToReturn, name: 'Renamed Space' })),
      generateInvite: vi.fn().mockReturnValue(of({ inviteLink: 'http://localhost/invite/tok-999', expiresAt: '2026-10-28T00:00:00Z' })),
      loadMyGroups: vi.fn().mockReturnValue(of([groupToReturn])),
      myGroups: vi.fn().mockReturnValue([groupToReturn]),
      getGroupMembers: vi.fn().mockReturnValue(of({
        content: mockMemberList
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

    mockMessageService = {
      getConversationMessages: vi.fn().mockReturnValue(of({ content: [], hasMore: false, nextCursor: null })),
      subscribeToConversation: vi.fn().mockReturnValue(() => {}),
      subscribeToReceipts: vi.fn().mockReturnValue(() => {}),
      subscribeToEdits: vi.fn().mockReturnValue(() => {}),
      subscribeToDeletes: vi.fn().mockReturnValue(() => {}),
      subscribeToTyping: vi.fn().mockReturnValue(() => {}),
      isWebSocketConnected: vi.fn().mockReturnValue(true),
      sendMessageStomp: vi.fn(),
      sendMessageRest: vi.fn().mockReturnValue(of({
        id: 'msg-new-1',
        conversationId: 'conv-101',
        senderId: 'u-1',
        senderName: 'Lead Admin',
        type: 'TEXT',
        content: 'Hello World',
        deleted: false,
        edited: false,
        createdAt: new Date().toISOString(),
        deliveryStatus: 'SENT'
      })),
      editMessage: vi.fn().mockReturnValue(of({
        id: 'msg-new-1',
        conversationId: 'conv-101',
        senderId: 'u-1',
        senderName: 'Lead Admin',
        type: 'TEXT',
        content: 'Edited content',
        deleted: false,
        edited: true,
        editedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        deliveryStatus: 'DELIVERED'
      })),
      deleteMessage: vi.fn().mockReturnValue(of(void 0)),
      sendTyping: vi.fn(),
      markMessageAsRead: vi.fn().mockReturnValue(of(void 0)),
      markMessagesAsRead: vi.fn().mockReturnValue(of(void 0))
    };

    mockWebSocketService = {
      subscribe: vi.fn().mockReturnValue(() => {}),
      publish: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true)
    };

    mockConversationService = {
      resetUnreadCount: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [GroupComponent],
      providers: [
        provideRouter([]),
        { provide: GroupService, useValue: mockGroupService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: MessageService, useValue: mockMessageService },
        { provide: WebSocketService, useValue: mockWebSocketService },
        { provide: ConversationService, useValue: mockConversationService },
        {
          provide: UserService,
          useValue: {
            getUserProfile: vi.fn().mockReturnValue(of({
              id: 'u-2',
              displayName: 'Dev Contributor',
              available: true,
              connectionStatus: 'NONE'
            })),
            blockUser: vi.fn().mockReturnValue(of(undefined)),
            unblockUser: vi.fn().mockReturnValue(of(undefined))
          }
        },
        {
          provide: ContactService,
          useValue: {
            sendConnectionRequest: vi.fn().mockReturnValue(of({ id: 'r1' })),
            removeContact: vi.fn().mockReturnValue(of(undefined))
          }
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({
              get: (key: string) => (key === 'id' ? paramId : null)
            }),
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
    expect(compiled.querySelector('[data-testid="group-view-member-count"]')?.textContent?.trim()).toContain('14 members');
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

  it('should open and close member public profile modal', async () => {
    await setupComponent();
    component.toggleMembersDrawer();
    const target = mockMemberList[1];
    component.openMemberProfile(target);
    expect(component.isProfileModalOpen()).toBe(true);
    expect(component.selectedProfileUserId()).toBe('u-2');

    component.closeProfileModal();
    expect(component.isProfileModalOpen()).toBe(false);
    expect(component.selectedProfileUserId()).toBeNull();
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

  it('should initialize group messaging and load initial history (ORDM-52, ORDM-53)', async () => {
    const mockMessages: MessageResponse[] = [
      {
        id: 'msg-1',
        conversationId: 'conv-101',
        senderId: 'u-2',
        senderName: 'Dev Contributor',
        type: 'TEXT',
        content: 'Hello group!',
        deleted: false,
        edited: false,
        createdAt: '2026-10-21T12:00:00Z',
        deliveryStatus: 'DELIVERED',
        readBy: []
      }
    ];

    await setupComponent();
    mockMessageService.getConversationMessages.mockReturnValue(of({
      content: mockMessages,
      hasMore: true,
      nextCursor: 'msg-1'
    }));

    component.loadInitialHistory('conv-101');
    fixture.detectChanges();

    expect(component.messages().length).toBe(1);
    expect(component.messages()[0].content).toBe('Hello group!');
    expect(component.hasMore()).toBe(true);
    expect(component.nextCursor()).toBe('msg-1');
    expect(mockMessageService.markMessagesAsRead).toHaveBeenCalledWith('conv-101', ['msg-1']);
    expect(mockConversationService.resetUnreadCount).toHaveBeenCalledWith('conv-101');
  });

  it('should render incoming message with sender display name and admin badge (ORDM-52)', async () => {
    await setupComponent();
    component.messages.set([
      {
        id: 'msg-admin',
        conversationId: 'conv-101',
        senderId: 'u-1', // Lead Admin (ADMIN in mockMemberList)
        senderName: 'Lead Admin',
        type: 'TEXT',
        content: 'System notice',
        deleted: false,
        edited: false,
        createdAt: '2026-10-21T12:00:00Z',
        deliveryStatus: 'DELIVERED'
      },
      {
        id: 'msg-incoming',
        conversationId: 'conv-101',
        senderId: 'u-2', // Dev Contributor (MEMBER in mockMemberList)
        senderName: 'Dev Contributor',
        type: 'TEXT',
        content: 'Hi everyone!',
        deleted: false,
        edited: false,
        createdAt: '2026-10-21T12:05:00Z',
        deliveryStatus: 'DELIVERED'
      }
    ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const incomingRow = compiled.querySelector('[data-testid="message-row-msg-incoming"]');
    expect(incomingRow).not.toBeNull();
    expect(incomingRow?.querySelector('.sender-name-label')?.textContent).toContain('Dev Contributor');
    expect(incomingRow?.querySelector('.bubble-text')?.textContent).toContain('Hi everyone!');
  });

  it('should send group message with optimistic update and clear input (ORDM-52)', async () => {
    await setupComponent();
    component.messageInput.set('New group announcement');
    fixture.detectChanges();

    component.sendMessage();

    expect(mockMessageService.sendMessageStomp).toHaveBeenCalledWith(
      'conv-101',
      'New group announcement',
      expect.any(String)
    );
    expect(component.messageInput()).toBe('');
    expect(component.messages().length).toBe(1);
    expect(component.messages()[0].content).toBe('New group announcement');
    expect(component.messages()[0].deliveryStatus).toBe('SENDING');
  });

  it('should fall back to REST send if WebSocket is not connected (ORDM-52)', async () => {
    await setupComponent();
    mockMessageService.isWebSocketConnected.mockReturnValue(false);
    component.messageInput.set('REST group announcement');
    fixture.detectChanges();

    component.sendMessage();

    expect(mockMessageService.sendMessageRest).toHaveBeenCalledWith(
      'conv-101',
      'REST group announcement',
      expect.any(String)
    );
    expect(component.messageInput()).toBe('');
  });

  it('should load older messages on cursor pagination (ORDM-53)', async () => {
    await setupComponent();
    component.messages.set([
      {
        id: 'msg-recent',
        conversationId: 'conv-101',
        senderId: 'u-1',
        senderName: 'Lead Admin',
        type: 'TEXT',
        content: 'Recent',
        deleted: false,
        edited: false,
        createdAt: '2026-10-21T12:10:00Z',
        deliveryStatus: 'DELIVERED'
      }
    ]);
    component.hasMore.set(true);
    component.nextCursor.set('msg-recent');

    const olderMessage: MessageResponse = {
      id: 'msg-older',
      conversationId: 'conv-101',
      senderId: 'u-2',
      senderName: 'Dev Contributor',
      type: 'TEXT',
      content: 'Older message',
      deleted: false,
      edited: false,
      createdAt: '2026-10-21T12:00:00Z',
      deliveryStatus: 'DELIVERED'
    };

    mockMessageService.getConversationMessages.mockReturnValue(of({
      content: [olderMessage],
      hasMore: false,
      nextCursor: null
    }));

    component.loadOlderMessages();
    fixture.detectChanges();

    expect(mockMessageService.getConversationMessages).toHaveBeenCalledWith('conv-101', 50, 'msg-recent');
    expect(component.messages().length).toBe(2);
    expect(component.messages()[0].id).toBe('msg-older');
    expect(component.messages()[1].id).toBe('msg-recent');
    expect(component.hasMore()).toBe(false);
  });

  it('should handle incoming real-time message and buffer mark as read (ORDM-52)', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    await setupComponent();
    let messageCallback: (msg: MessageResponse) => void = () => {};
    mockMessageService.subscribeToConversation.mockImplementation((convId, cb) => {
      messageCallback = cb;
      return () => {};
    });

    component['setupGroupMessaging']('conv-101');

    const incoming: MessageResponse = {
      id: 'msg-stream-1',
      conversationId: 'conv-101',
      senderId: 'u-2',
      senderName: 'Dev Contributor',
      type: 'TEXT',
      content: 'Realtime update',
      deleted: false,
      edited: false,
      createdAt: '2026-10-21T12:15:00Z',
      deliveryStatus: 'DELIVERED'
    };

    messageCallback(incoming);
    fixture.detectChanges();

    expect(component.messages().some(m => m.id === 'msg-stream-1')).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 550));
    expect(mockMessageService.markMessagesAsRead).toHaveBeenCalledWith('conv-101', ['msg-stream-1']);
  });

  it('should reconcile optimistic message using idempotencyKey (ORDM-52)', async () => {
    await setupComponent();
    let messageCallback: (msg: MessageResponse) => void = () => {};
    mockMessageService.subscribeToConversation.mockImplementation((convId, cb) => {
      messageCallback = cb;
      return () => {};
    });

    component['setupGroupMessaging']('conv-101');
    component.messages.set([
      {
        id: 'temp-key-123',
        conversationId: 'conv-101',
        senderId: 'u-1',
        senderName: 'Lead Admin',
        type: 'TEXT',
        content: 'Same content',
        deleted: false,
        edited: false,
        createdAt: '2026-10-21T12:15:00Z',
        deliveryStatus: 'SENDING',
        idempotencyKey: 'key-123'
      }
    ]);

    const incoming: MessageResponse = {
      id: 'msg-confirmed-1',
      conversationId: 'conv-101',
      senderId: 'u-1',
      senderName: 'Lead Admin',
      type: 'TEXT',
      content: 'Same content',
      deleted: false,
      edited: false,
      createdAt: '2026-10-21T12:15:00Z',
      deliveryStatus: 'DELIVERED',
      idempotencyKey: 'key-123'
    };

    messageCallback(incoming);
    fixture.detectChanges();

    expect(component.messages().length).toBe(1);
    expect(component.messages()[0].id).toBe('msg-confirmed-1');
    expect(component.messages()[0].deliveryStatus).toBe('DELIVERED');
  });

  describe('ORDM-54: Group Message Edit & Delete (+ Admin Delete)', () => {
    it('should subscribe to edits and deletes on conversation setup', async () => {
      await setupComponent();
      fixture.detectChanges();

      expect(mockMessageService.subscribeToEdits).toHaveBeenCalledWith('conv-101', expect.any(Function));
      expect(mockMessageService.subscribeToDeletes).toHaveBeenCalledWith('conv-101', expect.any(Function));
    });

    it('should update message content and edited flag when real-time edit arrives', async () => {
      let editCallback: any;
      await setupComponent();
      mockMessageService.subscribeToEdits.mockImplementation((convId: string, cb: any) => {
        editCallback = cb;
        return () => {};
      });

      component.loadGroupDetails('group-101');
      fixture.detectChanges();

      component.messages.set([
        {
          id: 'msg-to-edit',
          conversationId: 'conv-101',
          senderId: 'u-1',
          senderName: 'Lead Admin',
          type: 'TEXT',
          content: 'Original content',
          deleted: false,
          edited: false,
          createdAt: new Date().toISOString()
        }
      ]);

      expect(editCallback).toBeDefined();
      editCallback({
        messageId: 'msg-to-edit',
        content: 'Brand new edited content',
        editedAt: new Date().toISOString()
      });
      fixture.detectChanges();

      expect(component.messages()[0].content).toBe('Brand new edited content');
      expect(component.messages()[0].edited).toBe(true);
    });

    it('should soft-delete message and clear content when real-time delete arrives', async () => {
      let deleteCallback: any;
      await setupComponent();
      mockMessageService.subscribeToDeletes.mockImplementation((convId: string, cb: any) => {
        deleteCallback = cb;
        return () => {};
      });

      component.loadGroupDetails('group-101');
      fixture.detectChanges();

      component.messages.set([
        {
          id: 'msg-to-delete',
          conversationId: 'conv-101',
          senderId: 'u-1',
          senderName: 'Lead Admin',
          type: 'TEXT',
          content: 'Will be deleted',
          deleted: false,
          edited: false,
          createdAt: new Date().toISOString()
        }
      ]);

      expect(deleteCallback).toBeDefined();
      deleteCallback({
        messageId: 'msg-to-delete'
      });
      fixture.detectChanges();

      expect(component.messages()[0].deleted).toBe(true);
      expect(component.messages()[0].content).toBe('');
    });

    it('should allow author to start edit, enter edit mode, and submit edited message', async () => {
      await setupComponent();
      fixture.detectChanges();

      const testMsg = {
        id: 'msg-author-edit',
        conversationId: 'conv-101',
        senderId: 'u-1',
        senderName: 'Lead Admin',
        type: 'TEXT' as const,
        content: 'Initial text',
        deleted: false,
        edited: false,
        createdAt: new Date().toISOString()
      };
      component.messages.set([testMsg]);

      component.startEdit(testMsg);
      fixture.detectChanges();

      expect(component.isEditing()).toBe(true);
      expect(component.editingMessage()?.id).toBe('msg-author-edit');
      expect(component.messageInput()).toBe('Initial text');

      component.messageInput.set('Updated by author');
      component.sendMessage();

      expect(mockMessageService.editMessage).toHaveBeenCalledWith('conv-101', 'msg-author-edit', 'Updated by author');
      expect(component.isEditing()).toBe(false);
      expect(component.editingMessage()).toBeNull();
    });

    it('should allow author to cancel edit with cancelEdit or Escape key', async () => {
      await setupComponent();
      fixture.detectChanges();

      const testMsg = {
        id: 'msg-cancel-edit',
        conversationId: 'conv-101',
        senderId: 'u-1',
        senderName: 'Lead Admin',
        type: 'TEXT' as const,
        content: 'Keep me unchanged',
        deleted: false,
        edited: false,
        createdAt: new Date().toISOString()
      };
      component.startEdit(testMsg);
      expect(component.isEditing()).toBe(true);

      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      component.onKeydown(escEvent);
      fixture.detectChanges();

      expect(component.isEditing()).toBe(false);
      expect(component.messageInput()).toBe('');
    });

    it('should allow author to delete message FOR_EVERYONE and FOR_ME', async () => {
      await setupComponent();
      fixture.detectChanges();

      const testMsg = {
        id: 'msg-author-delete',
        conversationId: 'conv-101',
        senderId: 'u-1',
        senderName: 'Lead Admin',
        type: 'TEXT' as const,
        content: 'Delete me',
        deleted: false,
        edited: false,
        createdAt: new Date().toISOString()
      };
      component.messages.set([testMsg]);

      component.openDeleteModal(testMsg);
      expect(component.deleteModalMessage()?.id).toBe('msg-author-delete');

      component.confirmDeleteMessage('FOR_EVERYONE');
      expect(mockMessageService.deleteMessage).toHaveBeenCalledWith('conv-101', 'msg-author-delete', 'FOR_EVERYONE');
      expect(component.messages()[0].deleted).toBe(true);
      expect(component.deleteModalMessage()).toBeNull();

      // Test FOR_ME
      component.messages.set([testMsg]);
      component.openDeleteModal(testMsg);
      component.confirmDeleteMessage('FOR_ME');
      expect(mockMessageService.deleteMessage).toHaveBeenCalledWith('conv-101', 'msg-author-delete', 'FOR_ME');
      expect(component.messages().length).toBe(0);
    });

    it('should allow group admin to delete another member message for everyone', async () => {
      await setupComponent('group-101', mockAdminGroup);
      fixture.detectChanges();

      const otherMemberMsg = {
        id: 'msg-other-member',
        conversationId: 'conv-101',
        senderId: 'u-2',
        senderName: 'Dev Contributor',
        type: 'TEXT' as const,
        content: 'Spam from member',
        deleted: false,
        edited: false,
        createdAt: new Date().toISOString()
      };
      component.messages.set([otherMemberMsg]);

      expect(component.isAdmin()).toBe(true);
      component.openDeleteModal(otherMemberMsg);
      expect(component.deleteModalMessage()?.id).toBe('msg-other-member');

      component.confirmDeleteMessage('FOR_EVERYONE');
      expect(mockMessageService.deleteMessage).toHaveBeenCalledWith('conv-101', 'msg-other-member', 'FOR_EVERYONE');
      expect(component.messages()[0].deleted).toBe(true);
    });
  });

  describe('ORDM-55: Group Typing Indicator with Multi-User Debounce', () => {
    it('should subscribe to typing events on group setup', async () => {
      await setupComponent();
      fixture.detectChanges();

      expect(mockMessageService.subscribeToTyping).toHaveBeenCalledWith('conv-101', expect.any(Function));
    });

    it('should send typing indicator on composer input and debounce stop typing', async () => {
      await setupComponent();
      fixture.detectChanges();

      component.onComposerInput('Typing something...');
      expect(mockMessageService.sendTyping).toHaveBeenCalledWith('conv-101', true);

      // Clearing input immediately stops typing
      component.onComposerInput('');
      expect(mockMessageService.sendTyping).toHaveBeenCalledWith('conv-101', false);
    });

    it('should aggregate and format multi-user typing indicator text', async () => {
      let typingCallback: any;
      await setupComponent();
      mockMessageService.subscribeToTyping.mockImplementation((convId: string, cb: any) => {
        typingCallback = cb;
        return () => {};
      });

      component.loadGroupDetails('group-101');
      fixture.detectChanges();

      expect(typingCallback).toBeDefined();

      // 1 user typing
      typingCallback({ userId: 'u-2', displayName: 'Bob', typing: true });
      expect(component.typingIndicatorText()).toBe('Bob is typing...');

      // 2 users typing
      typingCallback({ userId: 'u-3', displayName: 'Charlie', typing: true });
      expect(component.typingIndicatorText()).toBe('Bob and Charlie are typing...');

      // 3 users typing
      typingCallback({ userId: 'u-4', displayName: 'Dana', typing: true });
      expect(component.typingIndicatorText()).toBe('3 people are typing...');

      // Bob stops typing
      typingCallback({ userId: 'u-2', displayName: 'Bob', typing: false });
      expect(component.typingIndicatorText()).toBe('Charlie and Dana are typing...');
    });
  });

  describe('ORDM-56: Group Member Presence & Active Member Count', () => {
    it('should subscribe to presence topics for all group members on load', async () => {
      await setupComponent();
      fixture.detectChanges();

      expect(mockWebSocketService.subscribe).toHaveBeenCalledWith('/topic/presence/u-1', expect.any(Function));
      expect(mockWebSocketService.subscribe).toHaveBeenCalledWith('/topic/presence/u-2', expect.any(Function));
    });

    it('should update member online presence in real time when presence event arrives', async () => {
      await setupComponent();
      const presenceCallbacks: Record<string, (event: any) => void> = {};
      mockWebSocketService.subscribe.mockImplementation((topic: string, cb: any) => {
        const match = topic.match(/\/topic\/presence\/(.+)/);
        if (match) {
          presenceCallbacks[match[1]] = cb;
        }
        return () => {};
      });

      component['memberPresenceUnsubs'].clear();
      component.loadMembers();
      fixture.detectChanges();

      expect(component.members().find(m => m.userId === 'u-2')?.online).toBe(false);

      // Simulate u-2 coming online in real time
      presenceCallbacks['u-2']({ userId: 'u-2', online: true });
      fixture.detectChanges();

      expect(component.members().find(m => m.userId === 'u-2')?.online).toBe(true);
    });

    it('should accurately compute and render online member count', async () => {
      await setupComponent();
      fixture.detectChanges();

      // Initially u-1 is online (true) and u-2 is offline (false) in mockMemberList
      expect(component.onlineMemberCount()).toBe(1);

      component.members.set([
        { ...mockMemberList[0], online: true },
        { ...mockMemberList[1], online: true }
      ]);
      fixture.detectChanges();

      expect(component.onlineMemberCount()).toBe(2);
    });
  });
});
