import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AuthComponent } from './auth.component';

describe('AuthComponent', () => {
  let component: AuthComponent;
  let fixture: ComponentFixture<AuthComponent>;
  let authServiceMock: {
    isAuthenticated: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
  };
  let routerMock: {
    navigateByUrl: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    authServiceMock = {
      isAuthenticated: vi.fn().mockReturnValue(false),
      login: vi.fn(),
      register: vi.fn()
    };

    routerMock = {
      navigateByUrl: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [AuthComponent],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: routerMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { mode: 'login' },
              queryParams: { returnUrl: '/discover' }
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AuthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize with login mode and switch between modes', () => {
    expect(component.mode()).toBe('login');

    component.setMode('register');
    expect(component.mode()).toBe('register');
    expect(component.formError()).toBeNull();

    component.setMode('login');
    expect(component.mode()).toBe('login');
  });

  it('should update tab active class and subtitle when switching modes via UI tabs', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.auth-subtitle')?.textContent).toContain(
      'Welcome back! Sign in to continue.'
    );
    expect(compiled.querySelector('app-login-form')).not.toBeNull();
    expect(compiled.querySelector('app-register-form')).toBeNull();

    const tabs = compiled.querySelectorAll('.tab-button');
    const registerTab = tabs[1] as HTMLButtonElement;
    registerTab.click();
    fixture.detectChanges();

    expect(component.mode()).toBe('register');
    expect(compiled.querySelector('.auth-subtitle')?.textContent).toContain(
      'Create an account to join Orbit.'
    );
    expect(compiled.querySelector('app-register-form')).not.toBeNull();
    expect(compiled.querySelector('app-login-form')).toBeNull();
  });

  it('should call login on authService and navigate to returnUrl on success', () => {
    authServiceMock.login.mockReturnValue(of({ accessToken: 'new_token' }));

    component.handleLogin({ email: 'test@example.com', password: 'Password123!' });

    expect(authServiceMock.login).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'Password123!'
    });
    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/discover', { replaceUrl: true });
    expect(component.isSubmitting()).toBe(false);
  });

  it('should capture error message on login failure', () => {
    authServiceMock.login.mockReturnValue(
      throwError(() => ({
        error: { message: 'Invalid credentials provided' }
      }))
    );

    component.handleLogin({ email: 'test@example.com', password: 'WrongPassword' });

    expect(component.formError()).toBe('Invalid credentials provided');
    expect(component.isSubmitting()).toBe(false);
  });

  it('should call register on authService and navigate to returnUrl on success', () => {
    authServiceMock.register.mockReturnValue(of({ accessToken: 'new_token' }));

    component.handleRegister({
      displayName: 'Satyam',
      email: 'satyam@test.com',
      password: 'Password123!'
    });

    expect(authServiceMock.register).toHaveBeenCalledWith({
      displayName: 'Satyam',
      email: 'satyam@test.com',
      password: 'Password123!'
    });
    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/discover', { replaceUrl: true });
  });

  it('should capture error message on register failure', () => {
    authServiceMock.register.mockReturnValue(
      throwError(() => ({
        error: { message: 'Email is already in use' }
      }))
    );

    component.handleRegister({
      displayName: 'Satyam',
      email: 'satyam@test.com',
      password: 'Password123!'
    });

    expect(component.formError()).toBe('Email is already in use');
    expect(component.isSubmitting()).toBe(false);
  });
});
