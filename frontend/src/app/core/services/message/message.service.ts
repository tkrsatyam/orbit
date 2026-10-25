import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  EditMessagePayload,
  MessageDeleteMode,
  MessageDeletedEventPayload,
  MessageEditedEventPayload,
  MessageHistoryResponse,
  MessageResponse,
  ReadReceiptEventPayload,
  SendMessagePayload,
  TypingEventPayload,
  TypingRequestPayload
} from '../../models/message.model';
import { WebSocketService } from '../websocket/websocket.service';

/**
 * Service managing message sending across STOMP WebSocket with transparent REST fallback.
 * Follows Flow A and Flow C from docs/architecture/sequences/message_send_flow.md.
 */
@Injectable({
  providedIn: 'root'
})
export class MessageService {
  private readonly http = inject(HttpClient);
  private readonly webSocketService = inject(WebSocketService);

  /**
   * Subscribes to real-time incoming messages for a conversation.
   *
   * @param conversationId destination conversation ID
   * @param callback handler invoked when a message arrives
   * @returns unsubscription cleanup function
   */
  subscribeToConversation(
    conversationId: string,
    callback: (message: MessageResponse) => void
  ): () => void {
    const destination = `/topic/conversations/${conversationId}/messages`;
    return this.webSocketService.subscribe<MessageResponse>(destination, callback);
  }

  /**
   * Subscribes to direct STOMP send receipts on /user/queue/receipts.
   *
   * @param callback handler invoked on server confirmation receipt
   * @returns unsubscription cleanup function
   */
  subscribeToReceipts(
    callback: (receipt: MessageResponse) => void
  ): () => void {
    return this.webSocketService.subscribe<MessageResponse>('/user/queue/receipts', callback);
  }

  /**
   * Retrieves paginated message history for a conversation.
   *
   * @param conversationId destination conversation ID
   * @param size page size (default 50, max 100)
   * @param before message ID cursor to paginate backwards from
   * @returns Observable of paginated message history envelope
   */
  getConversationMessages(
    conversationId: string,
    size?: number,
    before?: string
  ): Observable<MessageHistoryResponse> {
    let params = new HttpParams();
    if (size !== undefined && size !== null) {
      params = params.set('size', size.toString());
    }
    if (before) {
      params = params.set('before', before);
    }

    return this.http.get<MessageHistoryResponse>(
      `${environment.apiBaseUrl}/api/v1/conversations/${conversationId}/messages`,
      {
        params,
        withCredentials: true
      }
    );
  }

  /**
   * Sends a message to a conversation.
   * Uses STOMP WebSocket when connected; falls back automatically to REST POST when disconnected.
   *
   * @param conversationId the target conversation ID
   * @param content text body of the message
   * @param idempotencyKey client UUID for deduplication
   * @returns Observable resolving to the message response (via REST) or void (via STOMP)
   */
  sendMessageRest(
    conversationId: string,
    content: string,
    idempotencyKey?: string
  ): Observable<MessageResponse> {
    const payload: SendMessagePayload = {
      content,
      type: 'TEXT',
      idempotencyKey
    };

    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }

    return this.http.post<MessageResponse>(
      `${environment.apiBaseUrl}/api/v1/conversations/${conversationId}/messages`,
      payload,
      {
        headers,
        withCredentials: true
      }
    );
  }

  /**
   * Publishes message directly over STOMP WebSocket.
   *
   * @param conversationId the target conversation ID
   * @param content text body of the message
   * @param idempotencyKey client UUID for deduplication
   */
  sendMessageStomp(
    conversationId: string,
    content: string,
    idempotencyKey?: string
  ): void {
    const payload: SendMessagePayload = {
      content,
      type: 'TEXT',
      idempotencyKey
    };

    this.webSocketService.publish(`/app/conversations/${conversationId}/send`, payload);
  }

  /**
   * Returns true if WebSocket connection is active.
   */
  isWebSocketConnected(): boolean {
    return this.webSocketService.isConnected();
  }

  /**
   * Subscribes to real-time message edits on /topic/conversations/{id}/messages/edited.
   */
  subscribeToEdits(
    conversationId: string,
    callback: (edited: MessageEditedEventPayload) => void
  ): () => void {
    const destination = `/topic/conversations/${conversationId}/messages/edited`;
    return this.webSocketService.subscribe<MessageEditedEventPayload>(destination, callback);
  }

  /**
   * Subscribes to real-time message deletions on /topic/conversations/{id}/messages/deleted.
   */
  subscribeToDeletes(
    conversationId: string,
    callback: (deleted: MessageDeletedEventPayload) => void
  ): () => void {
    const destination = `/topic/conversations/${conversationId}/messages/deleted`;
    return this.webSocketService.subscribe<MessageDeletedEventPayload>(destination, callback);
  }

  /**
   * Edits a message via PATCH /api/v1/conversations/{conversationId}/messages/{messageId}.
   */
  editMessage(
    conversationId: string,
    messageId: string,
    content: string
  ): Observable<MessageResponse> {
    const payload: EditMessagePayload = { content };
    return this.http.patch<MessageResponse>(
      `${environment.apiBaseUrl}/api/v1/conversations/${conversationId}/messages/${messageId}`,
      payload,
      { withCredentials: true }
    );
  }

  /**
   * Deletes a message via DELETE /api/v1/conversations/{conversationId}/messages/{messageId}.
   * Supports mode=FOR_EVERYONE (soft delete) and mode=FOR_ME (per-user delete).
   */
  deleteMessage(
    conversationId: string,
    messageId: string,
    mode: MessageDeleteMode = 'FOR_EVERYONE'
  ): Observable<void> {
    const params = new HttpParams().set('mode', mode);
    return this.http.delete<void>(
      `${environment.apiBaseUrl}/api/v1/conversations/${conversationId}/messages/${messageId}`,
      {
        params,
        withCredentials: true
      }
    );
  }

  /**
   * Publishes ephemeral typing indicator over STOMP WebSocket.
   * Destination: /app/conversations/{conversationId}/typing
   *
   * @param conversationId destination conversation ID
   * @param typing true if user is actively typing, false if stopped
   */
  sendTyping(conversationId: string, typing: boolean): void {
    const payload: TypingRequestPayload = { typing };
    this.webSocketService.publish(`/app/conversations/${conversationId}/typing`, payload);
  }

  /**
   * Subscribes to real-time typing indicators for a conversation.
   * Destination: /topic/conversations/{conversationId}/typing
   *
   * @param conversationId destination conversation ID
   * @param callback handler invoked when typing events arrive
   * @returns unsubscription cleanup function
   */
  subscribeToTyping(
    conversationId: string,
    callback: (event: TypingEventPayload) => void
  ): () => void {
    const destination = `/topic/conversations/${conversationId}/typing`;
    return this.webSocketService.subscribe<TypingEventPayload>(destination, callback);
  }

  /**
   * Marks a message as read.
   * Sends via STOMP destination /app/conversations/{id}/read and falls back to REST POST.
   */
  markMessageAsRead(conversationId: string, messageId: string): Observable<void> {
    if (this.isWebSocketConnected()) {
      this.webSocketService.publish(`/app/conversations/${conversationId}/read`, { messageId });
    }
    return this.http.post<void>(
      `${environment.apiBaseUrl}/api/v1/conversations/${conversationId}/messages/${messageId}/read`,
      {},
      { withCredentials: true }
    );
  }

  /**
   * Subscribes to real-time read receipts for a conversation.
   * Destination: /topic/conversations/{conversationId}/read
   */
  subscribeToReadReceipts(
    conversationId: string,
    callback: (event: ReadReceiptEventPayload) => void
  ): () => void {
    const destination = `/topic/conversations/${conversationId}/read`;
    return this.webSocketService.subscribe<ReadReceiptEventPayload>(destination, callback);
  }
}
