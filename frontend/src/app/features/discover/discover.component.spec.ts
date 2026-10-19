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
  });

  it('should render register link for guest when not authenticated', () => {
    authServiceMock.isLoading.mockReturnValue(false);
    authServiceMock.isAuthenticated.mockReturnValue(false);

    fixture = TestBed.createComponent(DiscoverComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.register-link')?.textContent).toContain('Register to join');
    expect(compiled.querySelector('.join-button')).toBeNull();
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
  });
});
