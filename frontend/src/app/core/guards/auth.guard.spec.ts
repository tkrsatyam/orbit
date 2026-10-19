import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let router: { createUrlTree: ReturnType<typeof vi.fn> };
  let authServiceMock: {
    isLoading: ReturnType<typeof vi.fn>;
    isAuthenticated: ReturnType<typeof vi.fn>;
  };

  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = { url: '/conversations' } as RouterStateSnapshot;

  beforeEach(() => {
    router = {
      createUrlTree: vi.fn((commands: string[], extras: unknown) => ({ commands, extras } as unknown as UrlTree))
    };

    authServiceMock = {
      isLoading: vi.fn(),
      isAuthenticated: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: authServiceMock }
      ]
    });
  });

  it('should allow navigation when authenticated and not loading', () => {
    authServiceMock.isLoading.mockReturnValue(false);
    authServiceMock.isAuthenticated.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
    expect(result).toBe(true);
  });

  it('should redirect to /login with returnUrl when unauthenticated and not loading', () => {
    authServiceMock.isLoading.mockReturnValue(false);
    authServiceMock.isAuthenticated.mockReturnValue(false);

    const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
    expect(result).not.toBe(true);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/conversations' }
    });
  });
});
