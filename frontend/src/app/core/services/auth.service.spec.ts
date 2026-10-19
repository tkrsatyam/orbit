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

  it('should authenticate user on login without using localStorage', () => {
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
    expect(localStorage.getItem('orbit_user')).toBeNull();
  });

  it('should authenticate user on register', () => {
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

  it('should fetch and hydrate user profile via GET /api/v1/users/me on refresh', () => {
    const mockUser = {
      id: 'u_1',
      email: 'satyam@test.com',
      displayName: 'Satyam',
      bio: 'Developer',
      avatarUrl: null
    };

    service.refresh().subscribe((res) => {
      expect(res.accessToken).toBe('refreshed_token');
      expect(res.user).toEqual(mockUser);
    });

    const refreshReq = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/auth/refresh`);
    expect(refreshReq.request.method).toBe('POST');
    expect(refreshReq.request.withCredentials).toBe(true);
    refreshReq.flush({ accessToken: 'refreshed_token' });

    const meReq = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/users/me`);
    expect(meReq.request.method).toBe('GET');
    expect(meReq.request.headers.get('Authorization')).toBe('Bearer refreshed_token');
    meReq.flush(mockUser);

    expect(service.accessToken()).toBe('refreshed_token');
    expect(service.currentUser()).toEqual(mockUser);
    expect(service.isAuthenticated()).toBe(true);
    expect(localStorage.getItem('orbit_user')).toBeNull();
  });

  it('should deduplicate concurrent refresh calls into single refresh and me HTTP requests', () => {
    const mockUser = { id: 'u_1', email: 'satyam@test.com', displayName: 'Satyam' };
    let res1: unknown = null;
    let res2: unknown = null;

    service.refresh().subscribe((r) => (res1 = r));
    service.refresh().subscribe((r) => (res2 = r));

    const refreshReqs = httpMock.match(`${environment.apiBaseUrl}/api/v1/auth/refresh`);
    expect(refreshReqs.length).toBe(1);
    refreshReqs[0].flush({ accessToken: 'refreshed_token' });

    const meReqs = httpMock.match(`${environment.apiBaseUrl}/api/v1/users/me`);
    expect(meReqs.length).toBe(1);
    meReqs[0].flush(mockUser);

    expect(res1).toEqual({ accessToken: 'refreshed_token', user: mockUser });
    expect(res2).toEqual({ accessToken: 'refreshed_token', user: mockUser });
    expect(service.accessToken()).toBe('refreshed_token');
    expect(service.currentUser()).toEqual(mockUser);
  });

  it('should clear in-memory state on logout', () => {
    service.logout().subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/auth/logout`);
    expect(req.request.method).toBe('POST');
    req.flush({});

    expect(service.accessToken()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
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

  it('should fetch self profile directly via getSelfProfile', () => {
    const mockUser = { id: 'u_1', email: 'satyam@test.com', displayName: 'Satyam' };

    service.getSelfProfile('custom_token').subscribe((user) => {
      expect(user).toEqual(mockUser);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/users/me`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer custom_token');
    req.flush(mockUser);
  });

  it('should handle error and clear session if GET /api/v1/users/me fails on refresh', () => {
    let errorCaught: unknown = null;

    service.refresh().subscribe({
      error: (err) => {
        errorCaught = err;
      }
    });

    const refreshReq = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/auth/refresh`);
    refreshReq.flush({ accessToken: 'refreshed_token' });

    const meReq = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/users/me`);
    meReq.flush('User not found', { status: 404, statusText: 'Not Found' });

    expect(errorCaught).toBeDefined();
    expect(service.accessToken()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.isLoading()).toBe(false);
  });

  it('should propagate error when direct getSelfProfile call fails', () => {
    let errorCaught: unknown = null;

    service.getSelfProfile().subscribe({
      error: (err) => {
        errorCaught = err;
      }
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/users/me`);
    req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

    expect(errorCaught).toBeDefined();
  });
});
