import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ConnectionRequestResponse } from '../models/contact.model';
import { ContactService } from './contact.service';

describe('ContactService', () => {
  let service: ContactService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ContactService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(ContactService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created with empty pending user IDs', () => {
    expect(service).toBeTruthy();
    expect(service.pendingUserIds().size).toBe(0);
    expect(service.hasPendingRequest('user-1')).toBe(false);
  });

  it('should dispatch POST to /api/v1/contacts/requests and update pendingUserIds signal on success', () => {
    const targetUserId = 'target-user-123';
    const mockResponse: ConnectionRequestResponse = {
      id: 'req-456',
      status: 'PENDING',
      toUser: {
        id: targetUserId,
        displayName: 'Priya Sharma'
      },
      createdAt: '2026-10-21T00:30:00Z'
    };

    let result: ConnectionRequestResponse | undefined;
    service.sendConnectionRequest(targetUserId).subscribe(res => {
      result = res;
    });

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/contacts/requests`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ targetUserId });

    req.flush(mockResponse);

    expect(result).toEqual(mockResponse);
    expect(service.hasPendingRequest(targetUserId)).toBe(true);
    expect(service.pendingUserIds().has(targetUserId)).toBe(true);
  });

  it('should not add to pendingUserIds signal when request fails', () => {
    const targetUserId = 'target-user-error';

    let errorResponse: any;
    service.sendConnectionRequest(targetUserId).subscribe({
      next: () => {
        throw new Error('expected an error');
      },
      error: err => {
        errorResponse = err;
      }
    });

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/contacts/requests`);
    req.flush({ message: 'A connection request has already been sent' }, { status: 409, statusText: 'Conflict' });

    expect(errorResponse.status).toBe(409);
    expect(service.hasPendingRequest(targetUserId)).toBe(false);
  });
});
