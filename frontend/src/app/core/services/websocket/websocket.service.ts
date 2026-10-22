import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../auth.service';

export type WebSocketStatus = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';

interface PendingSubscription {
  destination: string;
  callback: (payload: any) => void;
  stompSub?: StompSubscription;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  private readonly authService = inject(AuthService);

  private client: Client | null = null;
  private currentToken: string | null = null;
  private readonly subscriptions = new Map<string, PendingSubscription>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  readonly status = signal<WebSocketStatus>('DISCONNECTED');
  readonly reconnectAttempts = signal<number>(0);

  readonly isConnected = computed(() => this.status() === 'CONNECTED');
  readonly isReconnecting = computed(() => this.status() === 'CONNECTING' && this.reconnectAttempts() > 0);
  readonly showReconnectAlert = computed(() => this.reconnectAttempts() >= 5);

  /**
   * Initializes and activates the WebSocket connection using the provided or active token.
   */
  connect(token?: string): void {
    const activeToken = token ?? this.authService.accessToken();
    if (!activeToken) {
      this.disconnect();
      return;
    }

    if (this.client?.active && this.currentToken === activeToken && this.status() === 'CONNECTED') {
      return;
    }

    this.disconnect();
    this.currentToken = activeToken;
    this.status.set('CONNECTING');

    const sockJsUrl = this.buildSockJsUrl(activeToken);

    this.client = new Client({
      webSocketFactory: () => new SockJS(sockJsUrl),
      heartbeatIncoming: 25000,
      heartbeatOutgoing: 25000,
      reconnectDelay: 0, // Managed manually via scheduleReconnect()
      onConnect: () => {
        this.status.set('CONNECTED');
        this.reconnectAttempts.set(0);
        this.resubscribeAll();
      },
      onDisconnect: () => {
        this.status.set('DISCONNECTED');
      },
      onStompError: (frame) => {
        console.error('STOMP Broker Error:', frame.headers['message'], frame.body);
      },
      onWebSocketClose: () => {
        if (this.currentToken) {
          this.scheduleReconnect();
        } else {
          this.status.set('DISCONNECTED');
        }
      }
    });

    this.client.activate();
  }

  /**
   * Cleanly closes the WebSocket connection and resets internal retry counters.
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.currentToken = null;
    this.reconnectAttempts.set(0);

    if (this.client) {
      for (const sub of this.subscriptions.values()) {
        sub.stompSub?.unsubscribe();
        sub.stompSub = undefined;
      }
      this.client.deactivate();
      this.client = null;
    }

    this.status.set('DISCONNECTED');
  }

  /**
   * Subscribes to a STOMP destination.
   * If disconnected, automatically establishes subscription upon connection.
   * Automatically re-subscribes upon reconnection.
   */
  subscribe<T>(destination: string, callback: (payload: T) => void): () => void {
    const subKey = `${destination}_${Math.random().toString(36).substring(2, 9)}`;
    const pendingSub: PendingSubscription = {
      destination,
      callback,
      stompSub: undefined
    };

    this.subscriptions.set(subKey, pendingSub);

    if (this.status() === 'CONNECTED' && this.client?.connected) {
      pendingSub.stompSub = this.client.subscribe(destination, (msg: IMessage) => {
        this.handleMessage(msg, callback);
      });
    }

    return () => {
      const active = this.subscriptions.get(subKey);
      active?.stompSub?.unsubscribe();
      this.subscriptions.delete(subKey);
    };
  }

  /**
   * Publishes a message to a STOMP destination.
   */
  publish(destination: string, body: unknown, headers?: Record<string, string>): void {
    if (!this.client?.connected) {
      console.warn(`Cannot publish to ${destination}: STOMP client is not connected.`);
      return;
    }

    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    this.client.publish({
      destination,
      body: payload,
      headers
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.subscriptions.clear();
  }

  private scheduleReconnect(): void {
    this.status.set('CONNECTING');
    const attempts = this.reconnectAttempts() + 1;
    this.reconnectAttempts.set(attempts);

    // Exponential backoff: 100ms, 200ms, 400ms, 800ms ... max 30000ms
    const delay = Math.min(100 * Math.pow(2, attempts - 1), 30000);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      if (this.currentToken) {
        this.connect(this.currentToken);
      }
    }, delay);
  }

  private resubscribeAll(): void {
    if (!this.client?.connected) return;

    for (const pending of this.subscriptions.values()) {
      pending.stompSub?.unsubscribe();
      pending.stompSub = this.client.subscribe(pending.destination, (msg: IMessage) => {
        this.handleMessage(msg, pending.callback);
      });
    }
  }

  private handleMessage<T>(msg: IMessage, callback: (payload: T) => void): void {
    try {
      const parsed = JSON.parse(msg.body) as T;
      callback(parsed);
    } catch {
      callback(msg.body as unknown as T);
    }
  }

  private buildSockJsUrl(token: string): string {
    const rawWsUrl = environment.wsUrl || '/ws';
    const httpUrl = rawWsUrl.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://');
    const separator = httpUrl.includes('?') ? '&' : '?';
    return `${httpUrl}${separator}token=${encodeURIComponent(token)}`;
  }
}
