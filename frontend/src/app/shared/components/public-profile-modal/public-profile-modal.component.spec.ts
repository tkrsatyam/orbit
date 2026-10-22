import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { PublicProfileModalComponent } from './public-profile-modal.component';
import { UserService } from '../../../core/services/user.service';
import { ContactService } from '../../../core/services/contact.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserProfile } from '../../../core/models/user.model';

describe('PublicProfileModalComponent', () => {
  let component: PublicProfileModalComponent;
  let componentRef: ComponentRef<PublicProfileModalComponent>;
  let fixture: ComponentFixture<PublicProfileModalComponent>;

  let mockUserService: {
    getUserProfile: ReturnType<typeof vi.fn>;
    blockUser: ReturnType<typeof vi.fn>;
    unblockUser: ReturnType<typeof vi.fn>;
  };

  let mockContactService: {
    sendConnectionRequest: ReturnType<typeof vi.fn>;
    removeContact: ReturnType<typeof vi.fn>;
  };

  let mockAuthService: {
    currentUser: ReturnType<typeof vi.fn>;
  };

  const sampleProfile: UserProfile = {
    id: 'user-123',
    displayName: 'Aarav Sharma',
    bio: 'Distributed systems engineer',
    avatarUrl: null,
    connectionStatus: 'NONE',
    available: true
  };

  const unavailableProfile: UserProfile = {
    id: 'user-blocked',
    displayName: null,
    bio: null,
    avatarUrl: null,
    connectionStatus: 'NONE',
    available: false
  };

  beforeEach(async () => {
    mockUserService = {
      getUserProfile: vi.fn().mockReturnValue(of(sampleProfile)),
      blockUser: vi.fn().mockReturnValue(of(undefined)),
      unblockUser: vi.fn().mockReturnValue(of(undefined))
    };

    mockContactService = {
      sendConnectionRequest: vi.fn().mockReturnValue(of({
        id: 'req-1',
        requesterId: 'current-user-id',
        targetUserId: 'user-123',
        status: 'PENDING',
        createdAt: '2026-10-22T00:00:00Z'
      })),
      removeContact: vi.fn().mockReturnValue(of(undefined))
    };

    mockAuthService = {
      currentUser: vi.fn().mockReturnValue({
        id: 'current-user-id',
        email: 'tester@orbit.local',
        displayName: 'Self User'
      })
    };

    await TestBed.configureTestingModule({
      imports: [PublicProfileModalComponent],
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: ContactService, useValue: mockContactService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PublicProfileModalComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('does not render dialog when isOpen is false', () => {
    componentRef.setInput('isOpen', false);
    componentRef.setInput('userId', 'user-123');
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();
  });

  it('fetches and renders profile when isOpen is true and userId is provided', () => {
    componentRef.setInput('isOpen', true);
    componentRef.setInput('userId', 'user-123');
    fixture.detectChanges();

    expect(mockUserService.getUserProfile).toHaveBeenCalledWith('user-123');

    const nameEl = fixture.nativeElement.querySelector('[data-testid="profile-display-name"]');
    expect(nameEl).not.toBeNull();
    expect(nameEl?.textContent?.trim()).toBe('Aarav Sharma');

    const initialsEl = fixture.nativeElement.querySelector('[data-testid="profile-avatar-initials"]');
    expect(initialsEl?.textContent?.trim()).toBe('A');

    const bioEl = fixture.nativeElement.querySelector('[data-testid="profile-bio"]');
    expect(bioEl?.textContent?.trim()).toBe('Distributed systems engineer');

    const badgeEl = fixture.nativeElement.querySelector('[data-testid="connection-status-badge"]');
    expect(badgeEl?.textContent?.trim()).toBe('Not Connected');
  });

  it('renders Profile Unavailable card per ADR 007 when available is false', () => {
    mockUserService.getUserProfile.mockReturnValue(of(unavailableProfile));

    componentRef.setInput('isOpen', true);
    componentRef.setInput('userId', 'user-blocked');
    fixture.detectChanges();

    const unavailableCard = fixture.nativeElement.querySelector('[data-testid="profile-unavailable-state"]');
    expect(unavailableCard).not.toBeNull();

    const titleEl = fixture.nativeElement.querySelector('[data-testid="unavailable-title"]');
    expect(titleEl?.textContent?.trim()).toBe('Profile Unavailable');

    // Normal profile content must NOT be rendered
    const normalContent = fixture.nativeElement.querySelector('[data-testid="profile-content"]');
    expect(normalContent).toBeNull();
  });

  it('renders Add Contact button when status is NONE and dispatches sendConnectionRequest', () => {
    componentRef.setInput('isOpen', true);
    componentRef.setInput('userId', 'user-123');
    fixture.detectChanges();

    const addBtn = fixture.nativeElement.querySelector('[data-testid="send-contact-request-btn"]');
    expect(addBtn).not.toBeNull();

    addBtn.click();
    fixture.detectChanges();

    expect(mockContactService.sendConnectionRequest).toHaveBeenCalledWith('user-123');
    expect(component.connectionStatus()).toBe('PENDING_SENT');
  });

  it('shows confirmation dialog before blocking a user and invokes blockUser', () => {
    componentRef.setInput('isOpen', true);
    componentRef.setInput('userId', 'user-123');
    fixture.detectChanges();

    const blockBtn = fixture.nativeElement.querySelector('[data-testid="block-user-btn"]');
    expect(blockBtn).not.toBeNull();

    blockBtn.click();
    fixture.detectChanges();

    const confirmCard = fixture.nativeElement.querySelector('[data-testid="confirm-action-card"]');
    expect(confirmCard).not.toBeNull();

    const executeBtn = fixture.nativeElement.querySelector('[data-testid="confirm-execute-btn"]');
    executeBtn.click();
    fixture.detectChanges();

    expect(mockUserService.blockUser).toHaveBeenCalledWith('user-123');
    expect(component.connectionStatus()).toBe('BLOCKED');
  });

  it('emits closeModal event when close button is clicked', () => {
    const emitSpy = vi.spyOn(component.closeModal, 'emit');

    componentRef.setInput('isOpen', true);
    componentRef.setInput('userId', 'user-123');
    fixture.detectChanges();

    const closeBtn = fixture.nativeElement.querySelector('[data-testid="close-public-profile-btn"]');
    closeBtn.click();

    expect(emitSpy).toHaveBeenCalled();
  });

  it('emits closeModal event when backdrop is clicked', () => {
    const emitSpy = vi.spyOn(component.closeModal, 'emit');

    componentRef.setInput('isOpen', true);
    componentRef.setInput('userId', 'user-123');
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector('.modal-backdrop');
    backdrop.click();

    expect(emitSpy).toHaveBeenCalled();
  });

  it('handles error state gracefully on 404', () => {
    mockUserService.getUserProfile.mockReturnValue(throwError(() => ({ status: 404 })));

    componentRef.setInput('isOpen', true);
    componentRef.setInput('userId', 'nonexistent-user');
    fixture.detectChanges();

    const errorState = fixture.nativeElement.querySelector('[data-testid="profile-error-state"]');
    expect(errorState).not.toBeNull();
    expect(errorState.textContent).toContain('User account not found');
  });
});
