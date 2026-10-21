import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ContactResponse, IncomingRequest } from '../../core/models/contact.model';
import { AuthService } from '../../core/services/auth.service';
import { ContactService } from '../../core/services/contact.service';
import { UserService } from '../../core/services/user.service';
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

    await TestBed.configureTestingModule({
      imports: [ConversationsComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
        { provide: ContactService, useValue: contactServiceMock },
        { provide: UserService, useValue: { getSuggestedUsers: vi.fn().mockReturnValue(of([])) } }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');

    fixture = TestBed.createComponent(ConversationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render user display name in header and initial in avatar badge', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.user-info')?.textContent).toContain('Satyam Kumar');
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

  it('should open new chat modal when clicking + New Conversation button in action area', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="new-chat-modal-card"]')).toBeNull();

    const newChatBtn = compiled.querySelector('[data-testid="action-new-chat-btn"]') as HTMLButtonElement;
    newChatBtn.click();
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
});
