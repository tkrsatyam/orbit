import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ConversationsComponent } from './conversations.component';

describe('ConversationsComponent', () => {
  let component: ConversationsComponent;
  let fixture: ComponentFixture<ConversationsComponent>;
  let authServiceMock: {
    currentUser: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };
  let router: Router;

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

    await TestBed.configureTestingModule({
      imports: [ConversationsComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock }
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
    expect(compiled.querySelector('.modal-backdrop')).toBeNull();

    const avatarBadge = compiled.querySelector('[data-testid="user-avatar-badge"]') as HTMLButtonElement;
    avatarBadge.click();
    fixture.detectChanges();

    const myProfileBtn = compiled.querySelector('[data-testid="menu-my-profile-btn"]') as HTMLButtonElement;
    myProfileBtn.click();
    fixture.detectChanges();

    expect(component.isMenuOpen()).toBe(false);
    expect(compiled.querySelector('.modal-backdrop')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="self-profile-name"]')?.textContent?.trim()).toBe('Satyam Kumar');
    expect(compiled.querySelector('[data-testid="self-profile-email"]')?.textContent?.trim()).toBe('satyam@orbit.local');
    expect(compiled.querySelector('[data-testid="self-profile-bio"]')?.textContent?.trim()).toBe('SWE @ Orbit');

    const closeBtn = compiled.querySelector('[data-testid="close-profile-btn"]') as HTMLButtonElement;
    closeBtn.click();
    fixture.detectChanges();

    expect(compiled.querySelector('.modal-backdrop')).toBeNull();
  });

  it('should close dropdown menu on escape key', () => {
    component.isMenuOpen.set(true);
    fixture.detectChanges();

    component.onEscapeKey();
    fixture.detectChanges();

    expect(component.isMenuOpen()).toBe(false);
  });
});
