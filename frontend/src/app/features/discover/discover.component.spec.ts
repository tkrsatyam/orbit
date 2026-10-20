import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DiscoverComponent } from './discover.component';

describe('DiscoverComponent', () => {
  let fixture: ComponentFixture<DiscoverComponent>;
  let authServiceMock: {
    isLoading: ReturnType<typeof vi.fn>;
    isAuthenticated: ReturnType<typeof vi.fn>;
    currentUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    authServiceMock = {
      isLoading: vi.fn().mockReturnValue(false),
      isAuthenticated: vi.fn().mockReturnValue(false),
      currentUser: vi.fn().mockReturnValue(null)
    };

    await TestBed.configureTestingModule({
      imports: [DiscoverComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock }
      ]
    }).compileComponents();
  });

  it('should render loading indicator when auth is loading', () => {
    authServiceMock.isLoading.mockReturnValue(true);
    fixture = TestBed.createComponent(DiscoverComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.loading-container')?.textContent).toContain('Loading...');
    expect(compiled.querySelector('.discover-container')).toBeNull();
  });

  it('should render register link for guest when not authenticated', () => {
    authServiceMock.isLoading.mockReturnValue(false);
    authServiceMock.isAuthenticated.mockReturnValue(false);

    fixture = TestBed.createComponent(DiscoverComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.discover-header h2')?.textContent).toContain('Discover Groups');
    expect(compiled.querySelector('.group-card h3')?.textContent).toContain('Orbit Community');
    expect(compiled.querySelector('.register-link')?.textContent).toContain('Register to join');
    expect(compiled.querySelector('.join-button')).toBeNull();
    expect(compiled.querySelector('.member-tag')).toBeNull();
  });

  it('should render join group button and member tag when authenticated', () => {
    authServiceMock.isLoading.mockReturnValue(false);
    authServiceMock.isAuthenticated.mockReturnValue(true);
    authServiceMock.currentUser.mockReturnValue({ displayName: 'Satyam' });

    fixture = TestBed.createComponent(DiscoverComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.join-button')?.textContent).toContain('Join Group');
    expect(compiled.querySelector('.member-tag')?.textContent).toContain('Logged in as Satyam');
    expect(compiled.querySelector('.register-link')).toBeNull();
  });

  it('should fallback to email when authenticated user has no display name', () => {
    authServiceMock.isLoading.mockReturnValue(false);
    authServiceMock.isAuthenticated.mockReturnValue(true);
    authServiceMock.currentUser.mockReturnValue({ email: 'satyam@orbit.local' });

    fixture = TestBed.createComponent(DiscoverComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.member-tag')?.textContent).toContain('Logged in as satyam@orbit.local');
  });

  it('should render back link to conversations', () => {
    authServiceMock.isLoading.mockReturnValue(false);
    fixture = TestBed.createComponent(DiscoverComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const backLink = compiled.querySelector('.back-link') as HTMLAnchorElement;
    expect(backLink).not.toBeNull();
    expect(backLink.textContent).toContain('Back to conversations');
  });
});
