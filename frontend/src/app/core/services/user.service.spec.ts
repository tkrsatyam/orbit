import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { UserProfile } from '../models/user.model';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), UserService]
    });

    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch public user profile by id', () => {
    const mockProfile: UserProfile = {
      id: 'target-123',
      displayName: 'Rahul',
      avatarUrl: 'https://example.com/avatar.jpg',
      bio: 'Preparing for FAANG',
      connectionStatus: 'CONNECTED'
    };

    service.getUserProfile('target-123').subscribe((profile) => {
      expect(profile).toEqual(mockProfile);
      expect(profile.id).toBe('target-123');
      expect(profile.displayName).toBe('Rahul');
      expect(profile.connectionStatus).toBe('CONNECTED');
      expect(profile.available).toBeUndefined();
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/users/target-123`);
    expect(req.request.method).toBe('GET');
    req.flush(mockProfile);
  });

  it('should handle masked profile response when blocked', () => {
    const maskedProfile: UserProfile = {
      id: 'target-123',
      available: false
    };

    service.getUserProfile('target-123').subscribe((profile) => {
      expect(profile.id).toBe('target-123');
      expect(profile.available).toBe(false);
      expect(profile.displayName).toBeUndefined();
      expect(profile.bio).toBeUndefined();
      expect(profile.connectionStatus).toBeUndefined();
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/users/target-123`);
    expect(req.request.method).toBe('GET');
    req.flush(maskedProfile);
  });
});
