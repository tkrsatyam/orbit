import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ContactResponse, IncomingRequest } from '../../core/models/contact.model';
import { AuthService } from '../../core/services/auth.service';
import { ContactService } from '../../core/services/contact.service';
import { GroupResponse, GroupService } from '../../core/services/group.service';
import { UserService } from '../../core/services/user.service';
import { WebSocketService } from '../../core/services/websocket/websocket.service';
import { ConversationsComponent } from './conversations.component';

describe('ConversationsComponent', () => {
  let component: ConversationsComponent;
  let fixture: ComponentFixture<ConversationsComponent>;
  let authServiceMock: {
    currentUser: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };
  let contactServiceMock: {
    contacts: ReturnType<typeof signal<ContactResponse[]>>;
    loadContacts: ReturnType<typeof vi.fn>;
    removeContact: ReturnType<typeof vi.fn>;
    sendConnectionRequest: ReturnType<typeof vi.fn>;
    hasPendingRequest: ReturnType<typeof vi.fn>;
    loadIncomingRequests: ReturnType<typeof vi.fn>;
    respondToRequest: ReturnType<typeof vi.fn>;
    incomingRequests: ReturnType<typeof signal<IncomingRequest[]>>;
    incomingCount: ReturnType<typeof signal<number>>;
  };
  let userServiceMock: {
    getSuggestedUsers: ReturnType<typeof vi.fn>;
    blockUser: ReturnType<typeof vi.fn>;
  };
  let groupServiceMock: {
    myGroups: ReturnType<typeof signal<GroupResponse[]>>;
    loadMyGroups: ReturnType<typeof vi.fn>;
    createGroup: ReturnType<typeof vi.fn>;
    generateInvite: ReturnType<typeof vi.fn>;
    joinViaInvite: ReturnType<typeof vi.fn>;
  };
  let webSocketServiceMock: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    showReconnectAlert: ReturnType<typeof signal<boolean>>;
    status: ReturnType<typeof signal<string>>;
  };
  let router: Router;

  const mockIncomingRequest: IncomingRequest = {
    id: 'req-456',
    fromUser: {
      id: 'user-ananya',
      displayName: 'Ananya Roy',
      avatarUrl: null
    },
    createdAt: '2026-10-21T00:00:00Z'
  };

  const mockGroup: GroupResponse = {
    id: 'grp-1',
    name: 'Engineers Orbit',
    description: 'Backend Architecture',
    topicTag: '#backend',
    visibility: 'PUBLIC',
    avatarUrl: null,
    coverImageUrl: null,
    memberCount: 5,
    conversationId: 'conv-1',
    createdAt: '2026-10-21T00:00:00Z',
    role: 'ADMIN'
  };

  beforeEach(async () => {
    authServiceMock = {
      currentUser: vi.fn().mockReturnValue({
        id: 'u-123',
        displayName: 'Satyam Kumar',
        email: 'satyam@orbit.local',
        bio: 'SWE @ Orbit',
        createdAt: '2026-06-27T10:30:00Z'
      }),
      logout: vi.fn().mockReturnValue(of(undefined))
    };

    contactServiceMock = {
      contacts: signal<ContactResponse[]>([]),
      loadContacts: vi.fn().mockReturnValue(of({ content: [] })),
      removeContact: vi.fn().mockReturnValue(of(undefined)),
      sendConnectionRequest: vi.fn(),
      hasPendingRequest: vi.fn().mockReturnValue(false),
      loadIncomingRequests: vi.fn().mockReturnValue(of({ content: [] })),
      respondToRequest: vi.fn().mockReturnValue(of({ status: 'ACCEPTED', conversationId: 'conv-99' })),
      incomingRequests: signal<IncomingRequest[]>([]),
      incomingCount: signal<number>(0)
    };

    userServiceMock = {
      getSuggestedUsers: vi.fn().mockReturnValue(of([])),
      blockUser: vi.fn().mockReturnValue(of(undefined))
    };

    groupServiceMock = {
      myGroups: signal<GroupResponse[]>([mockGroup]),
      loadMyGroups: vi.fn().mockReturnValue(of([mockGroup])),
      createGroup: vi.fn().mockReturnValue(of(mockGroup)),
      generateInvite: vi.fn().mockReturnValue(of({ inviteToken: 'tok-123', inviteUrl: 'http://localhost/invite/tok-123', expiresAt: '2026-10-28T00:00:00Z' })),
      joinViaInvite: vi.fn().mockReturnValue(of({ groupId: 'grp-1', groupName: 'Engineers Orbit', role: 'MEMBER', joinedAt: '2026-10-21T00:00:00Z' }))
    };

    webSocketServiceMock = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      showReconnectAlert: signal<boolean>(false),
      status: signal<string>('DISCONNECTED')
    };

    await TestBed.configureTestingModule({
      imports: [ConversationsComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
        { provide: ContactService, useValue: contactServiceMock },
        { provide: UserService, useValue: userServiceMock },
        { provide: GroupService, useValue: groupServiceMock },
        { provide: WebSocketService, useValue: webSocketServiceMock }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');

    fixture = TestBed.createComponent(ConversationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render user initial in avatar badge in nav rail', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="user-avatar-badge"]')?.textContent?.trim()).toBe('S');
  });

  it('should toggle dropdown menu when avatar badge is clicked', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="user-dropdown-menu"]')).toBeNull();

    const avatarBadge = compiled.querySelector('[data-testid="user-avatar-badge"]') as HTMLButtonElement;
    avatarBadge.click();
    fixture.detectChanges();

    expect(compiled.querySelector('[data-testid="user-dropdown-menu"]')).not.toBeNull();

    // Toggle closed on another click
    avatarBadge.click();
    fixture.detectChanges();
    expect(compiled.querySelector('[data-testid="user-dropdown-menu"]')).toBeNull();
  });

  it('should call logout and navigate to login when sign out is clicked from dropdown', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const avatarBadge = compiled.querySelector('[data-testid="user-avatar-badge"]') as HTMLButtonElement;
    avatarBadge.click();
    fixture.detectChanges();

    const signoutBtn = compiled.querySelector('[data-testid="signout-button"]') as HTMLButtonElement;
    signoutBtn.click();
    fixture.detectChanges();

    expect(authServiceMock.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(component.isMenuOpen()).toBe(false);
  });

  it('should open self profile modal when My profile is clicked in dropdown and close via close button', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.self-profile-card')).toBeNull();

    const avatarBadge = compiled.querySelector('[data-testid="user-avatar-badge"]') as HTMLButtonElement;
    avatarBadge.click();
    fixture.detectChanges();

    const myProfileBtn = compiled.querySelector('[data-testid="menu-my-profile-btn"]') as HTMLButtonElement;
    myProfileBtn.click();
    fixture.detectChanges();

    expect(component.isMenuOpen()).toBe(false);
    expect(compiled.querySelector('[data-testid="self-profile-name"]')?.textContent?.trim()).toBe('Satyam Kumar');
    expect(compiled.querySelector('[data-testid="self-profile-email"]')?.textContent?.trim()).toBe('satyam@orbit.local');
    expect(compiled.querySelector('[data-testid="self-profile-bio"]')?.textContent?.trim()).toBe('SWE @ Orbit');

    const closeBtn = compiled.querySelector('[data-testid="close-profile-btn"]') as HTMLButtonElement;
    closeBtn.click();
    fixture.detectChanges();

    expect(compiled.querySelector('.self-profile-card')).toBeNull();
  });

  it('should open new chat modal when clicking New Chat button in header', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="new-chat-modal-card"]')).toBeNull();

    const newChatBtn = compiled.querySelector('[data-testid="new-chat-trigger-btn"]') as HTMLButtonElement;
    newChatBtn.click();
    fixture.detectChanges();

    expect(compiled.querySelector('[data-testid="new-chat-modal-card"]')).not.toBeNull();
    expect(component.isNewChatOpen()).toBe(true);

    const closeBtn = compiled.querySelector('[data-testid="close-new-chat-modal-btn"]') as HTMLButtonElement;
    closeBtn.click();
    fixture.detectChanges();

    expect(compiled.querySelector('[data-testid="new-chat-modal-card"]')).toBeNull();
    expect(component.isNewChatOpen()).toBe(false);
  });

  it('should open new chat modal via openNewChatModal()', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="new-chat-modal-card"]')).toBeNull();

    component.openNewChatModal();
    fixture.detectChanges();

    expect(compiled.querySelector('[data-testid="new-chat-modal-card"]')).not.toBeNull();
    expect(component.isNewChatOpen()).toBe(true);
  });

  it('should close dropdown menu on escape key', () => {
    component.isMenuOpen.set(true);
    fixture.detectChanges();

    component.onEscapeKey();
    fixture.detectChanges();

    expect(component.isMenuOpen()).toBe(false);
  });

  it('should display incoming request banner and badge when incomingRequests signal has items', () => {
    contactServiceMock.incomingRequests.set([mockIncomingRequest]);
    contactServiceMock.incomingCount.set(1);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const banner = compiled.querySelector('[data-testid="incoming-requests-container"]');
    expect(banner).not.toBeNull();
    expect(compiled.querySelector('[data-testid="incoming-requests-badge"]')?.textContent?.trim()).toBe('1');
    expect(compiled.querySelector('.sender-name')?.textContent).toContain('Ananya Roy');
    expect(compiled.querySelector('.request-action-label')?.textContent).toContain('sent you a connection request');
  });

  it('should dispatch ACCEPT action when Accept button is clicked', () => {
    contactServiceMock.incomingRequests.set([mockIncomingRequest]);
    contactServiceMock.incomingCount.set(1);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const acceptBtn = compiled.querySelector('[data-testid="accept-request-btn-req-456"]') as HTMLButtonElement;
    expect(acceptBtn).not.toBeNull();
    acceptBtn.click();

    expect(contactServiceMock.respondToRequest).toHaveBeenCalledWith('req-456', 'ACCEPT');
  });

  it('should dispatch DECLINE action when Decline button is clicked', () => {
    contactServiceMock.respondToRequest.mockReturnValue(of(undefined));
    contactServiceMock.incomingRequests.set([mockIncomingRequest]);
    contactServiceMock.incomingCount.set(1);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const declineBtn = compiled.querySelector('[data-testid="decline-request-btn-req-456"]') as HTMLButtonElement;
    expect(declineBtn).not.toBeNull();
    declineBtn.click();

    expect(contactServiceMock.respondToRequest).toHaveBeenCalledWith('req-456', 'DECLINE');
  });

  it('should dispatch BLOCK action and reload incoming requests when Block button is clicked', () => {
    contactServiceMock.incomingRequests.set([mockIncomingRequest]);
    contactServiceMock.incomingCount.set(1);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const blockBtn = compiled.querySelector('[data-testid="block-request-btn-req-456"]') as HTMLButtonElement;
    expect(blockBtn).not.toBeNull();
    blockBtn.click();

    expect(userServiceMock.blockUser).toHaveBeenCalledWith('user-ananya');
    expect(contactServiceMock.loadIncomingRequests).toHaveBeenCalled();
  });

  it('should call groupService.loadMyGroups on initialization', () => {
    expect(groupServiceMock.loadMyGroups).toHaveBeenCalled();
  });

  it('should switch navigation tab to GROUPS and render groups list', () => {
    component.setNavTab('GROUPS');
    fixture.detectChanges();

    expect(component.activeNavTab()).toBe('GROUPS');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.group-list-item')).not.toBeNull();
    expect(compiled.textContent).toContain('Engineers Orbit');
  });

  it('should open and close create group modal', () => {
    expect(component.isCreateGroupOpen()).toBe(false);

    component.openCreateGroupModal();
    fixture.detectChanges();
    expect(component.isCreateGroupOpen()).toBe(true);

    component.closeCreateGroupModal();
    fixture.detectChanges();
    expect(component.isCreateGroupOpen()).toBe(false);
  });

  it('should filter groups by visibility when setGroupFilter is called', () => {
    const publicGroup: GroupResponse = {
      id: 'grp-pub',
      name: 'Public Space',
      description: 'Open discussions',
      topicTag: '#general',
      visibility: 'PUBLIC',
      avatarUrl: null,
      coverImageUrl: null,
      memberCount: 10,
      conversationId: 'conv-pub',
      createdAt: '2026-10-21T00:00:00Z',
      role: 'ADMIN'
    };
    const privateGroup: GroupResponse = {
      id: 'grp-priv',
      name: 'Private Space',
      description: 'Stealth dev',
      topicTag: '#stealth',
      visibility: 'PRIVATE',
      avatarUrl: null,
      coverImageUrl: null,
      memberCount: 3,
      conversationId: 'conv-priv',
      createdAt: '2026-10-21T00:00:00Z',
      role: 'MEMBER'
    };
    groupServiceMock.myGroups.set([publicGroup, privateGroup]);
    fixture.detectChanges();

    component.setGroupFilter('PUBLIC');
    expect(component.filteredGroups().length).toBe(1);
    expect(component.filteredGroups()[0].name).toBe('Public Space');

    component.setGroupFilter('PRIVATE');
    expect(component.filteredGroups().length).toBe(1);
    expect(component.filteredGroups()[0].name).toBe('Private Space');

    component.setGroupFilter('ALL');
    expect(component.filteredGroups().length).toBe(2);
  });

  it('should initialize and connect WebSocketService on component init', () => {
    expect(webSocketServiceMock.connect).toHaveBeenCalled();
  });

  it('should disconnect WebSocketService on user logout', () => {
    component.handleLogout();
    expect(webSocketServiceMock.disconnect).toHaveBeenCalled();
  });

  it('should render reconnect banner when webSocketService.showReconnectAlert is true', () => {
    let banner = fixture.nativeElement.querySelector('[data-testid="ws-reconnect-banner"]');
    expect(banner).toBeNull();

    webSocketServiceMock.showReconnectAlert.set(true);
    fixture.detectChanges();

    banner = fixture.nativeElement.querySelector('[data-testid="ws-reconnect-banner"]');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain('Reconnecting to live chat service...');

    const retryBtn = fixture.nativeElement.querySelector('[data-testid="ws-retry-btn"]') as HTMLButtonElement;
    expect(retryBtn).not.toBeNull();
    retryBtn.click();
    expect(webSocketServiceMock.connect).toHaveBeenCalledTimes(2);
  });
});
