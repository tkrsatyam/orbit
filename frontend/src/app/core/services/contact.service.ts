import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AcceptRequestResponse,
  ConnectionRequestResponse,
  IncomingRequest,
  IncomingRequestsResponse,
  RequestAction,
  RespondRequestPayload,
  SendRequestDto
} from '../models/contact.model';

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1/contacts`;

  /**
   * Tracks IDs of target users to whom connection requests have been dispatched during the current session.
   */
  private readonly sentPendingUserIds = signal<Set<string>>(new Set<string>());
  readonly pendingUserIds = this.sentPendingUserIds.asReadonly();

  /**
   * Reactive state for pending incoming connection requests.
   */
  readonly incomingRequests = signal<IncomingRequest[]>([]);
  readonly incomingCount = computed(() => this.incomingRequests().length);

  /**
   * Sends an outbound connection request to a target user.
   * On success, registers the targetUserId into pendingUserIds signal.
   *
   * @param targetUserId ID of the target recipient
   */
  sendConnectionRequest(targetUserId: string): Observable<ConnectionRequestResponse> {
    const payload: SendRequestDto = { targetUserId };
    return this.http.post<ConnectionRequestResponse>(`${this.baseUrl}/requests`, payload).pipe(
      tap(() => {
        this.sentPendingUserIds.update(set => {
          const updated = new Set(set);
          updated.add(targetUserId);
          return updated;
        });
      })
    );
  }

  /**
   * Checks if a request has been dispatched to the given target user during this session.
   */
  hasPendingRequest(targetUserId: string): boolean {
    return this.sentPendingUserIds().has(targetUserId);
  }

  /**
   * Retrieves all pending incoming connection requests for the authenticated user.
   * Updates the reactive incomingRequests signal.
   */
  loadIncomingRequests(): Observable<IncomingRequestsResponse> {
    return this.http.get<IncomingRequestsResponse>(`${this.baseUrl}/requests`).pipe(
      tap(response => {
        this.incomingRequests.set(response.content || []);
      })
    );
  }

  /**
   * Accepts or declines an incoming connection request.
   * Updates the reactive incomingRequests signal by removing the acted-upon request.
   *
   * @param requestId ID of the connection request
   * @param action ACCEPT or DECLINE
   */
  respondToRequest(requestId: string, action: RequestAction): Observable<AcceptRequestResponse | void> {
    const payload: RespondRequestPayload = { action };
    return this.http.patch<AcceptRequestResponse | void>(`${this.baseUrl}/requests/${requestId}`, payload).pipe(
      tap(() => {
        this.incomingRequests.update(requests => requests.filter(req => req.id !== requestId));
      })
    );
  }
}
