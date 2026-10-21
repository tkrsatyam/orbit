import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserProfile, SuggestedUser } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly http = inject(HttpClient);

  /**
   * Fetches the public profile of a user by their ID.
   * If the requester is blocked by the target user, the response degrades to { id, available: false }.
   */
  getUserProfile(userId: string): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${environment.apiBaseUrl}/api/v1/users/${userId}`);
  }

  /**
   * Fetches suggested real users to connect with, excluding current user and existing contacts.
   */
  getSuggestedUsers(): Observable<SuggestedUser[]> {
    return this.http.get<SuggestedUser[]>(`${environment.apiBaseUrl}/api/v1/users/suggested`);
  }

  /**
   * Blocks a target user by their user ID per ADR 007 and ADR 013.
   * Works whether or not an existing contact document exists.
   */
  blockUser(userId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/api/v1/users/${userId}/block`, {});
  }

  /**
   * Unblocks a target user by their user ID per ADR 006 and ADR 013,
   * permanently deleting the contact/block document.
   */
  unblockUser(userId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiBaseUrl}/api/v1/users/${userId}/block`);
  }
}
