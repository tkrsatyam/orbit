import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConversationItem, ConversationListResponse, LastMessageSummary } from '../models/conversation.model';

@Injectable({
  providedIn: 'root'
})
export class ConversationService {
  private readonly http = inject(HttpClient);

  readonly conversations = signal<ConversationItem[]>([]);
  readonly isLoading = signal<boolean>(false);

  readonly unreadTotalCount = computed(() => {
    return this.conversations().reduce((acc, item) => acc + (item.unreadCount || 0), 0);
  });

  loadConversations(): Observable<ConversationListResponse> {
    this.isLoading.set(true);
    return this.http
      .get<ConversationListResponse>(`${environment.apiBaseUrl}/api/v1/conversations`, {
        withCredentials: true
      })
      .pipe(
        tap({
          next: response => {
            this.conversations.set(response.content || []);
            this.isLoading.set(false);
          },
          error: () => {
            this.isLoading.set(false);
          }
        })
      );
  }

  updatePresence(userId: string, online: boolean): void {
    this.conversations.update(items =>
      items.map(item => {
        if (item.participant && item.participant.id === userId) {
          return {
            ...item,
            participant: {
              ...item.participant,
              online
            }
          };
        }
        return item;
      })
    );
  }

  resetUnreadCount(conversationId: string): void {
    this.conversations.update(items =>
      items.map(item => {
        if (item.id === conversationId && item.unreadCount > 0) {
          return {
            ...item,
            unreadCount: 0
          };
        }
        return item;
      })
    );
  }

  incrementUnreadCount(conversationId: string): void {
    this.conversations.update(items =>
      items.map(item => {
        if (item.id === conversationId) {
          return {
            ...item,
            unreadCount: (item.unreadCount || 0) + 1
          };
        }
        return item;
      })
    );
  }

  updateLastMessage(conversationId: string, lastMessage: LastMessageSummary): void {
    this.conversations.update(items => {
      const idx = items.findIndex(i => i.id === conversationId);
      if (idx === -1) {
        return items;
      }
      const updated = {
        ...items[idx],
        lastMessage
      };
      // Move to top
      const remaining = items.filter((_, i) => i !== idx);
      return [updated, ...remaining];
    });
  }
}
