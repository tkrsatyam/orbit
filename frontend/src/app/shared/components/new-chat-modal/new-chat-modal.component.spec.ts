import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ContactResponse, IncomingRequest } from '../../../core/models/contact.model';
import { SuggestedUser } from '../../../core/models/user.model';
import { ContactService } from '../../../core/services/contact.service';
import { UserService } from '../../../core/services/user.service';
import { NewChatModalComponent } from './new-chat-modal.component';

describe('NewChatModalComponent', () => {
  let component: NewChatModalComponent;
  let fixture: ComponentFixture<NewChatModalComponent>;
  let mockContactService: {
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
  let mockUserService: {
    getSuggestedUsers: ReturnType<typeof vi.fn>;
  };

  const mockContact: ContactResponse = {
    id: 'contact-1',
    userId: 'user-b',
    displayName: 'Ananya Roy',
    avatarUrl: null,
    bio: 'Full Stack Engineer',
    online: true,
    conversationId: 'conv-123'
  };

  const mockIncomingRequest: IncomingRequest = {
    id: 'req-inv-1',
    fromUser: {
      id: 'target-user-1',
      displayName: 'Sneha Kapoor',
      avatarUrl: null
    },
    createdAt: '2026-10-21T00:00:00Z'
  };

  const mockSuggestedUsers: SuggestedUser[] = [
    {
      id: 'vikram-k-id',
      displayName: 'Vikram K',
      bio: 'Java 25 builder',
      initials: 'VK'
    },
    {
      id: 'rohan-mehta-id',
      displayName: 'Rohan Mehta',
      bio: 'DevOps architect',
      initials: 'RM'
    }
  ];

  beforeEach(async () => {
    mockContactService = {
      contacts: signal<ContactResponse[]>([mockContact]),
      loadContacts: vi.fn().mockReturnValue(of({ content: [mockContact] })),
      removeContact: vi.fn().mockReturnValue(of(undefined)),
      sendConnectionRequest: vi.fn(),
      hasPendingRequest: vi.fn().mockReturnValue(false),
      loadIncomingRequests: vi.fn().mockReturnValue(of({ content: [] })),
      respondToRequest: vi.fn().mockReturnValue(of({ status: 'ACCEPTED', conversationId: 'conv-10' })),
      incomingRequests: signal<IncomingRequest[]>([]),
      incomingCount: signal<number>(0)
    };

    mockUserService = {
      getSuggestedUsers: vi.fn().mockReturnValue(of(mockSuggestedUsers))
    };

    await TestBed.configureTestingModule({
      imports: [NewChatModalComponent],
      providers: [
        { provide: ContactService, useValue: mockContactService },
        { provide: UserService, useValue: mockUserService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NewChatModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
  });

  it('should create and render the modal when isOpen is true', () => {
    expect(component).toBeTruthy();
    const modalEl = fixture.nativeElement.querySelector('[data-testid="new-chat-modal-card"]');
    expect(modalEl).toBeTruthy();
    const title = fixture.nativeElement.querySelector('#modal-title');
    expect(title.textContent).toContain('New Conversation');
  });

  it('should not render anything when isOpen is false', () => {
    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();
    const modalEl = fixture.nativeElement.querySelector('[data-testid="new-chat-modal-card"]');
    expect(modalEl).toBeNull();
  });

  it('should emit closeModal when close button is clicked', () => {
    const spy = vi.spyOn(component.closeModal, 'emit');
    const closeBtn = fixture.nativeElement.querySelector('[data-testid="close-new-chat-modal-btn"]');
    closeBtn.click();
    expect(spy).toHaveBeenCalled();
  });

  it('should emit closeModal when backdrop is clicked', () => {
    const spy = vi.spyOn(component.closeModal, 'emit');
    const backdrop = fixture.nativeElement.querySelector('[data-testid="new-chat-modal-backdrop"]');
    backdrop.click();
    expect(spy).toHaveBeenCalled();
  });

  it('should emit closeModal when Escape key is pressed', () => {
    const spy = vi.spyOn(component.closeModal, 'emit');
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);
    expect(spy).toHaveBeenCalled();
  });

  it('should render connected contacts in Direct Message tab by default when contacts exist', () => {
    expect(component.activeTab()).toBe('contacts');
    const contactCard = fixture.nativeElement.querySelector('[data-testid="contact-card-contact-1"]');
    expect(contactCard).toBeTruthy();
    expect(contactCard.textContent).toContain('Ananya Roy');
    expect(contactCard.textContent).toContain('Full Stack Engineer');

    const presenceDot = fixture.nativeElement.querySelector('[data-testid="presence-dot-contact-1"]');
    expect(presenceDot.classList).toContain('online');
  });

  it('should emit selectConversation with contact conversationId and close modal when Message is clicked', () => {
    const selectSpy = vi.spyOn(component.selectConversation, 'emit');
    const closeSpy = vi.spyOn(component.closeModal, 'emit');

    const messageBtn = fixture.nativeElement.querySelector('[data-testid="message-contact-btn-contact-1"]');
    messageBtn.click();

    expect(selectSpy).toHaveBeenCalledWith('conv-123');
    expect(closeSpy).toHaveBeenCalled();
  });

  it('should show inline confirmation when remove button is clicked and handle cancel', () => {
    const removeBtn = fixture.nativeElement.querySelector('[data-testid="remove-contact-btn-contact-1"]');
    removeBtn.click();
    fixture.detectChanges();

    expect(component.confirmingRemoveId()).toBe('contact-1');
    const confirmBox = fixture.nativeElement.querySelector('[data-testid="remove-confirm-box"]');
    expect(confirmBox).toBeTruthy();

    const cancelBtn = fixture.nativeElement.querySelector('[data-testid="cancel-remove-btn-contact-1"]');
    cancelBtn.click();
    fixture.detectChanges();

    expect(component.confirmingRemoveId()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="remove-confirm-box"]')).toBeNull();
  });

  it('should call removeContact and display success feedback when unfriend is confirmed', () => {
    component.promptRemoveContact('contact-1');
    fixture.detectChanges();

    const confirmBtn = fixture.nativeElement.querySelector('[data-testid="confirm-remove-btn-contact-1"]');
    confirmBtn.click();
    fixture.detectChanges();

    expect(mockContactService.removeContact).toHaveBeenCalledWith('contact-1');
    expect(component.successMessage()).toBe('Removed Ananya Roy from your contacts.');
    expect(component.confirmingRemoveId()).toBeNull();
  });

  it('should switch between Direct Message and Add Connection tabs', () => {
    const connectTabBtn = fixture.nativeElement.querySelector('[data-testid="tab-connect-btn"]');
    connectTabBtn.click();
    fixture.detectChanges();

    expect(component.activeTab()).toBe('connect');
    expect(fixture.nativeElement.querySelector('[data-testid="connect-tab-content"]')).toBeTruthy();

    const contactsTabBtn = fixture.nativeElement.querySelector('[data-testid="tab-contacts-btn"]');
    contactsTabBtn.click();
    fixture.detectChanges();

    expect(component.activeTab()).toBe('contacts');
    expect(fixture.nativeElement.querySelector('[data-testid="contacts-tab-content"]')).toBeTruthy();
  });

  it('should display empty state in Direct Message tab when contact list is empty', () => {
    mockContactService.contacts.set([]);
    component.setActiveTab('contacts');
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('[data-testid="no-contacts-empty-state"]');
    expect(emptyState).toBeTruthy();
    expect(emptyState.textContent).toContain('No connections yet');

    const switchBtn = fixture.nativeElement.querySelector('[data-testid="switch-to-connect-tab-btn"]');
    switchBtn.click();
    fixture.detectChanges();

    expect(component.activeTab()).toBe('connect');
  });

  it('should send connection request when entering target user ID in connect tab', () => {
    component.setActiveTab('connect');
    fixture.detectChanges();

    const response = {
      id: 'req-1',
      status: 'PENDING' as const,
      toUser: { id: 'target-user-99', displayName: 'Target User' },
      createdAt: '2026-10-21T00:00:00Z'
    };
    mockContactService.sendConnectionRequest.mockReturnValue(of(response));

    component.directTargetUserId.set('target-user-99');
    component.connectDirect();
    fixture.detectChanges();

    expect(mockContactService.sendConnectionRequest).toHaveBeenCalledWith('target-user-99');
    expect(component.successMessage()).toContain('Connection request sent to Target User.');
    expect(component.directTargetUserId()).toBe('');
  });

  it('should display error message when connect request fails', () => {
    component.setActiveTab('connect');
    fixture.detectChanges();

    mockContactService.sendConnectionRequest.mockReturnValue(
      throwError(() => ({ error: { message: 'A connection request has already been sent to this user' } }))
    );

    component.directTargetUserId.set('target-user-99');
    component.connectDirect();
    fixture.detectChanges();

    expect(component.errorMessage()).toBe('A connection request has already been sent to this user');
    const errorAlert = fixture.nativeElement.querySelector('[data-testid="new-chat-error-alert"]');
    expect(errorAlert.textContent).toContain('A connection request has already been sent to this user');
  });

  it('should send connection request when clicking + Connect on suggested user', () => {
    component.setActiveTab('connect');
    fixture.detectChanges();

    const response = {
      id: 'req-2',
      status: 'PENDING' as const,
      toUser: { id: 'vikram-k-id', displayName: 'Vikram K' },
      createdAt: '2026-10-21T00:00:00Z'
    };
    mockContactService.sendConnectionRequest.mockReturnValue(of(response));

    const connectBtn = fixture.nativeElement.querySelector('[data-testid="connect-btn-vikram-k-id"]');
    connectBtn.click();
    fixture.detectChanges();

    expect(mockContactService.sendConnectionRequest).toHaveBeenCalledWith('vikram-k-id');
    expect(component.successMessage()).toContain('Connection request sent to Vikram K.');
  });

  it('should render Pending button when a user has a pending request', () => {
    component.setActiveTab('connect');
    mockContactService.hasPendingRequest.mockImplementation((id: string) => id === 'rohan-mehta-id');
    fixture.detectChanges();

    const pendingBtn = fixture.nativeElement.querySelector('[data-testid="pending-btn-rohan-mehta-id"]');
    expect(pendingBtn).toBeTruthy();
    expect(pendingBtn.disabled).toBe(true);
    expect(pendingBtn.textContent).toContain('Pending...');
  });

  it('should render incoming requests section in modal when incomingRequests signal has items', () => {
    component.setActiveTab('connect');
    mockContactService.incomingRequests.set([mockIncomingRequest]);
    mockContactService.incomingCount.set(1);
    fixture.detectChanges();

    const section = fixture.nativeElement.querySelector('[data-testid="modal-incoming-section"]');
    expect(section).not.toBeNull();
    expect(section.textContent).toContain('Sneha Kapoor');
    expect(section.textContent).toContain('INCOMING REQUESTS (1)');
  });

  it('should respond to incoming request with ACCEPT when Accept button clicked in modal', () => {
    component.setActiveTab('connect');
    mockContactService.incomingRequests.set([mockIncomingRequest]);
    mockContactService.incomingCount.set(1);
    fixture.detectChanges();

    const acceptBtn = fixture.nativeElement.querySelector('[data-testid="modal-accept-btn-req-inv-1"]');
    expect(acceptBtn).not.toBeNull();
    acceptBtn.click();

    expect(mockContactService.respondToRequest).toHaveBeenCalledWith('req-inv-1', 'ACCEPT');
    expect(component.successMessage()).toContain('Connection request accepted.');
  });

  it('should respond to incoming request with DECLINE when Decline button clicked in modal', () => {
    component.setActiveTab('connect');
    mockContactService.respondToRequest.mockReturnValue(of(undefined));
    mockContactService.incomingRequests.set([mockIncomingRequest]);
    mockContactService.incomingCount.set(1);
    fixture.detectChanges();

    const declineBtn = fixture.nativeElement.querySelector('[data-testid="modal-decline-btn-req-inv-1"]');
    expect(declineBtn).not.toBeNull();
    declineBtn.click();

    expect(mockContactService.respondToRequest).toHaveBeenCalledWith('req-inv-1', 'DECLINE');
    expect(component.successMessage()).toContain('Connection request declined.');
  });
});
