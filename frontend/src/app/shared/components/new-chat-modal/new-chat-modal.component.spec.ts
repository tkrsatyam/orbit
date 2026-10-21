import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { IncomingRequest } from '../../../core/models/contact.model';
import { ContactService } from '../../../core/services/contact.service';
import { NewChatModalComponent } from './new-chat-modal.component';

describe('NewChatModalComponent', () => {
  let component: NewChatModalComponent;
  let fixture: ComponentFixture<NewChatModalComponent>;
  let mockContactService: {
    sendConnectionRequest: ReturnType<typeof vi.fn>;
    hasPendingRequest: ReturnType<typeof vi.fn>;
    loadIncomingRequests: ReturnType<typeof vi.fn>;
    respondToRequest: ReturnType<typeof vi.fn>;
    incomingRequests: ReturnType<typeof signal<IncomingRequest[]>>;
    incomingCount: ReturnType<typeof signal<number>>;
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

  beforeEach(async () => {
    mockContactService = {
      sendConnectionRequest: vi.fn(),
      hasPendingRequest: vi.fn().mockReturnValue(false),
      loadIncomingRequests: vi.fn().mockReturnValue(of({ content: [] })),
      respondToRequest: vi.fn().mockReturnValue(of({ status: 'ACCEPTED', conversationId: 'conv-10' })),
      incomingRequests: signal<IncomingRequest[]>([]),
      incomingCount: signal<number>(0)
    };

    await TestBed.configureTestingModule({
      imports: [NewChatModalComponent],
      providers: [
        { provide: ContactService, useValue: mockContactService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NewChatModalComponent);
    component = fixture.componentInstance;
    component.isOpen = true;
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
    component.isOpen = false;
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

  it('should send connection request when entering target user ID', () => {
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
    mockContactService.hasPendingRequest.mockImplementation((id: string) => id === 'rohan-mehta-id');
    fixture.detectChanges();

    const pendingBtn = fixture.nativeElement.querySelector('[data-testid="pending-btn-rohan-mehta-id"]');
    expect(pendingBtn).toBeTruthy();
    expect(pendingBtn.disabled).toBe(true);
    expect(pendingBtn.textContent).toContain('Pending...');
  });

  it('should render incoming requests section in modal when incomingRequests signal has items', () => {
    mockContactService.incomingRequests.set([mockIncomingRequest]);
    mockContactService.incomingCount.set(1);
    fixture.detectChanges();

    const section = fixture.nativeElement.querySelector('[data-testid="modal-incoming-section"]');
    expect(section).not.toBeNull();
    expect(section.textContent).toContain('Sneha Kapoor');
    expect(section.textContent).toContain('INCOMING REQUESTS (1)');
  });

  it('should respond to incoming request with ACCEPT when Accept button clicked in modal', () => {
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
