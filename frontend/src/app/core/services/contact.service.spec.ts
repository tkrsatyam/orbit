import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AcceptRequestResponse, ConnectionRequestResponse, IncomingRequestsResponse } from '../models/contact.model';
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

  it('should be created with empty pending user IDs and empty incoming requests', () => {
    expect(service).toBeTruthy();
    expect(service.pendingUserIds().size).toBe(0);
    expect(service.hasPendingRequest('user-1')).toBe(false);
    expect(service.incomingRequests().length).toBe(0);
    expect(service.incomingCount()).toBe(0);
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

  it('should load incoming requests and populate incomingRequests signal', () => {
    const mockIncoming: IncomingRequestsResponse = {
      content: [
        {
          id: 'req-1',
          fromUser: { id: 'u-1', displayName: 'Ananya Roy' },
          createdAt: '2026-10-21T00:00:00Z'
        }
      ]
    };

    service.loadIncomingRequests().subscribe();

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/contacts/requests`);
    expect(req.request.method).toBe('GET');

    req.flush(mockIncoming);

    expect(service.incomingRequests().length).toBe(1);
    expect(service.incomingCount()).toBe(1);
    expect(service.incomingRequests()[0].fromUser.displayName).toBe('Ananya Roy');
  });

  it('should dispatch PATCH with ACCEPT and remove request from incomingRequests signal', () => {
    service.incomingRequests.set([
      { id: 'req-1', fromUser: { id: 'u-1', displayName: 'Ananya Roy' }, createdAt: '2026-10-21T00:00:00Z' },
      { id: 'req-2', fromUser: { id: 'u-2', displayName: 'Vikram K' }, createdAt: '2026-10-21T00:00:00Z' }
    ]);

    const mockResponse: AcceptRequestResponse = {
      status: 'ACCEPTED',
      conversationId: 'conv-123'
    };

    let result: AcceptRequestResponse | void = undefined;
    service.respondToRequest('req-1', 'ACCEPT').subscribe(res => {
      result = res;
    });

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/contacts/requests/req-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ action: 'ACCEPT' });

    req.flush(mockResponse);

    expect(result).toEqual(mockResponse);
    expect(service.incomingRequests().length).toBe(1);
    expect(service.incomingRequests()[0].id).toBe('req-2');
  });

  it('should dispatch PATCH with DECLINE and remove request from incomingRequests signal', () => {
    service.incomingRequests.set([
      { id: 'req-1', fromUser: { id: 'u-1', displayName: 'Ananya Roy' }, createdAt: '2026-10-21T00:00:00Z' }
    ]);

    service.respondToRequest('req-1', 'DECLINE').subscribe();

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/contacts/requests/req-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ action: 'DECLINE' });

    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(service.incomingRequests().length).toBe(0);
    expect(service.incomingCount()).toBe(0);
  });
});
