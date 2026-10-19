import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authServiceMock: {
    accessToken: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    authServiceMock = {
      accessToken: vi.fn(),
      refresh: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceMock }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should attach withCredentials without Authorization header for auth endpoints', () => {
    authServiceMock.accessToken.mockReturnValue('some_token');

    http.post('/api/v1/auth/login', {}).subscribe();

    const req = httpMock.expectOne('/api/v1/auth/login');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('should attach Authorization Bearer header when token is present', () => {
    authServiceMock.accessToken.mockReturnValue('valid_jwt_token');

    http.get('/api/v1/conversations').subscribe();

    const req = httpMock.expectOne('/api/v1/conversations');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('Authorization')).toBe('Bearer valid_jwt_token');
    req.flush([]);
  });

  it('should catch 401, call refresh, and retry request with new token', () => {
    authServiceMock.accessToken.mockReturnValue('expired_token');
    authServiceMock.refresh.mockReturnValue(of({ accessToken: 'brand_new_token' }));

    http.get('/api/v1/conversations').subscribe((res) => {
      expect(res).toEqual(['conv1']);
    });

    // Initial failed request
    const req1 = httpMock.expectOne('/api/v1/conversations');
    expect(req1.request.headers.get('Authorization')).toBe('Bearer expired_token');
    req1.flush('Token expired', { status: 401, statusText: 'Unauthorized' });

    // Retried request with new token
    const req2 = httpMock.expectOne('/api/v1/conversations');
    expect(req2.request.headers.get('Authorization')).toBe('Bearer brand_new_token');
    req2.flush(['conv1']);
  });
});
