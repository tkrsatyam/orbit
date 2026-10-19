import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), AuthService]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should initialize with default unauthenticated state', () => {
    expect(service.accessToken()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(service.isLoading()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should authenticate and persist user on login', () => {
    const mockUser = { id: 'u_1', email: 'satyam@test.com', displayName: 'Satyam' };
    const mockResponse = { accessToken: 'jwt_token_123', user: mockUser };

    service.login({ email: 'satyam@test.com', password: 'Password1!' }).subscribe((res) => {
      expect(res.accessToken).toBe('jwt_token_123');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush(mockResponse);

    expect(service.accessToken()).toBe('jwt_token_123');
    expect(service.currentUser()).toEqual(mockUser);
    expect(service.isAuthenticated()).toBe(true);
    expect(localStorage.getItem('orbit_user')).toContain('satyam@test.com');
  });

  it('should authenticate and persist user on register', () => {
    const mockUser = { id: 'u_2', email: 'new@test.com', displayName: 'New User' };
    const mockResponse = { accessToken: 'jwt_token_456', user: mockUser };

    service
      .register({ email: 'new@test.com', password: 'Password1!', displayName: 'New User' })
      .subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/auth/register`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);

    expect(service.accessToken()).toBe('jwt_token_456');
    expect(service.currentUser()).toEqual(mockUser);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('should deduplicate concurrent refresh calls into a single HTTP request', () => {
    const mockResponse = { accessToken: 'refreshed_token' };

    let res1: unknown = null;
    let res2: unknown = null;

    service.refresh().subscribe((r) => (res1 = r));
    service.refresh().subscribe((r) => (res2 = r));

    const reqs = httpMock.match(`${environment.apiBaseUrl}/api/v1/auth/refresh`);
    expect(reqs.length).toBe(1);
    reqs[0].flush(mockResponse);

    expect(res1).toEqual(mockResponse);
    expect(res2).toEqual(mockResponse);
    expect(service.accessToken()).toBe('refreshed_token');
  });

  it('should clear state and localStorage on logout', () => {
    localStorage.setItem('orbit_user', JSON.stringify({ id: 'u_1' }));

    service.logout().subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/auth/logout`);
    expect(req.request.method).toBe('POST');
    req.flush({});

    expect(service.accessToken()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('orbit_user')).toBeNull();
  });

  it('should resolve false gracefully when init fails on 401', () => {
    service.init().subscribe((success) => {
      expect(success).toBe(false);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/auth/refresh`);
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(service.isLoading()).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
  });
});
