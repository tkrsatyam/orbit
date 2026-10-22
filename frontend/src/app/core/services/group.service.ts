import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type GroupVisibility = 'PUBLIC' | 'PRIVATE';
export type GroupRole = 'ADMIN' | 'MEMBER';

export interface CreateGroupPayload {
  name: string;
  description?: string | null;
  topicTag?: string | null;
  visibility: GroupVisibility;
}

export interface UpdateGroupPayload {
  name?: string;
  description?: string | null;
  topicTag?: string | null;
}

export interface GroupResponse {
  id: string;
  name: string;
  description: string | null;
  topicTag: string | null;
  visibility: GroupVisibility;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  memberCount: number;
  conversationId: string;
  createdAt: string;
  role: GroupRole;
}

export interface InviteResponse {
  inviteLink: string;
  expiresAt: string;
}

export interface GroupJoinResponse {
  groupId: string;
  conversationId: string;
  role: GroupRole;
}

@Injectable({
  providedIn: 'root'
})
export class GroupService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1/groups`;

  // Reactive signal of user's joined groups
  readonly myGroups = signal<GroupResponse[]>([]);

  /**
   * Fetches the list of groups the current user is a member of.
   */
  loadMyGroups(): Observable<GroupResponse[]> {
    return this.http.get<GroupResponse[]>(`${this.baseUrl}/mine`).pipe(
      tap((groups) => this.myGroups.set(groups))
    );
  }

  /**
   * Creates a new group and automatically prepends it to myGroups signal.
   */
  createGroup(payload: CreateGroupPayload): Observable<GroupResponse> {
    return this.http.post<GroupResponse>(this.baseUrl, payload).pipe(
      tap((newGroup) => {
        this.myGroups.update((current) => [newGroup, ...current]);
      })
    );
  }

  /**
   * Generates a 7-day invite link for the specified group (Admin-only).
   */
  generateInvite(groupId: string): Observable<InviteResponse> {
    return this.http.post<InviteResponse>(`${this.baseUrl}/${groupId}/invite`, {});
  }

  /**
   * Joins a private group using the secret invite token.
   */
  joinViaInvite(token: string): Observable<GroupJoinResponse> {
    return this.http.post<GroupJoinResponse>(`${this.baseUrl}/join-via-invite/${token}`, {});
  }

  /**
   * Retrieves group details for a given group ID.
   */
  getGroupDetails(groupId: string): Observable<GroupResponse> {
    return this.http.get<GroupResponse>(`${this.baseUrl}/${groupId}`);
  }

  /**
   * Updates group metadata. Admin-only operation.
   */
  updateGroup(groupId: string, payload: UpdateGroupPayload): Observable<GroupResponse> {
    return this.http.patch<GroupResponse>(`${this.baseUrl}/${groupId}`, payload).pipe(
      tap((updatedGroup) => {
        this.myGroups.update((list) =>
          list.map((g) => (g.id === updatedGroup.id ? updatedGroup : g))
        );
      })
    );
  }
}
