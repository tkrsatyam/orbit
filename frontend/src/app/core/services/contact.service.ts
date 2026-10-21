import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConnectionRequestResponse, SendRequestDto } from '../models/contact.model';

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
}
