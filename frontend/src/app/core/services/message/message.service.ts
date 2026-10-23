import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { MessageResponse, SendMessagePayload } from '../../models/message.model';
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
}
