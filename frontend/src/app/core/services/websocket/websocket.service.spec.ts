import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '../auth.service';
import { WebSocketService } from './websocket.service';
import { Client } from '@stomp/stompjs';

describe('WebSocketService', () => {
  let service: WebSocketService;
  let authServiceMock: {
    accessToken: ReturnType<typeof signal<string | null>>;
  };

  beforeEach(() => {
    authServiceMock = {
      accessToken: signal<string | null>('mock-access-token')
    };

    TestBed.configureTestingModule({
      providers: [
        WebSocketService,
        { provide: AuthService, useValue: authServiceMock }
      ]
    });

    service = TestBed.inject(WebSocketService);
  });

  afterEach(() => {
    service.disconnect();
    vi.restoreAllMocks();
  });

  it('should be created with initial DISCONNECTED status and 0 reconnect attempts', () => {
    expect(service).toBeTruthy();
    expect(service.status()).toBe('DISCONNECTED');
    expect(service.isConnected()).toBe(false);
    expect(service.reconnectAttempts()).toBe(0);
    expect(service.showReconnectAlert()).toBe(false);
  });

  it('should not connect when no access token is available', () => {
    authServiceMock.accessToken.set(null);
    service.connect();

    expect(service.status()).toBe('DISCONNECTED');
    expect(service.isConnected()).toBe(false);
  });

  it('should transition to CONNECTING and initialize STOMP client on connect()', () => {
    service.connect('custom-token');

    expect(service.status()).toBe('CONNECTING');
  });

  it('should update status to CONNECTED and reset retry counter when onConnect triggers', () => {
    service.connect('test-token');

    const client = (service as any).client as Client;
    expect(client).toBeDefined();

    client.onConnect?.({} as any);

    expect(service.status()).toBe('CONNECTED');
    expect(service.isConnected()).toBe(true);
    expect(service.reconnectAttempts()).toBe(0);
  });

  it('should transition to DISCONNECTED when onDisconnect triggers', () => {
    service.connect('test-token');
    const client = (service as any).client as Client;

    client.onConnect?.({} as any);
    expect(service.status()).toBe('CONNECTED');

    client.onDisconnect?.({} as any);
    expect(service.status()).toBe('DISCONNECTED');
    expect(service.isConnected()).toBe(false);
  });

  it('should disconnect cleanly and reset state on disconnect()', () => {
    service.connect('test-token');
    const client = (service as any).client as Client;
    client.onConnect?.({} as any);

    service.disconnect();

    expect(service.status()).toBe('DISCONNECTED');
    expect(service.isConnected()).toBe(false);
    expect((service as any).client).toBeNull();
    expect((service as any).currentToken).toBeNull();
  });

  it('should register and dispatch messages to subscriptions', () => {
    service.connect('test-token');
    const client = (service as any).client as Client;
    vi.spyOn(client, 'connected', 'get').mockReturnValue(true);
    client.onConnect?.({} as any);

    let receivedPayload: any = null;
    let subscribeDestination = '';
    let messageHandler: any = null;

    vi.spyOn(client, 'subscribe').mockImplementation((dest: string, callback: any) => {
      subscribeDestination = dest;
      messageHandler = callback;
      return { id: 'sub-1', unsubscribe: vi.fn() } as any;
    });

    const unsubscribe = service.subscribe<{ text: string }>('/topic/test', (data) => {
      receivedPayload = data;
    });

    expect(subscribeDestination).toBe('/topic/test');
    expect(messageHandler).toBeDefined();

    messageHandler?.({ body: JSON.stringify({ text: 'Hello WebSocket' }) });
    expect(receivedPayload).toEqual({ text: 'Hello WebSocket' });

    unsubscribe();
  });

  it('should re-subscribe to all active destinations on reconnect', () => {
    service.connect('test-token');
    const client = (service as any).client as Client;
    vi.spyOn(client, 'connected', 'get').mockReturnValue(true);
    client.onConnect?.({} as any);

    const subscribedDestinations: string[] = [];
    vi.spyOn(client, 'subscribe').mockImplementation((dest: string) => {
      subscribedDestinations.push(dest);
      return { id: `sub-${dest}`, unsubscribe: vi.fn() } as any;
    });

    service.subscribe('/topic/conversations/1', () => {});
    service.subscribe('/topic/presence/user-a', () => {});

    expect(subscribedDestinations).toEqual(['/topic/conversations/1', '/topic/presence/user-a']);

    subscribedDestinations.length = 0;
    client.onConnect?.({} as any);

    expect(subscribedDestinations).toEqual(['/topic/conversations/1', '/topic/presence/user-a']);
  });

  it('should publish JSON serialized payload when connected', () => {
    service.connect('test-token');
    const client = (service as any).client as Client;
    vi.spyOn(client, 'connected', 'get').mockReturnValue(true);
    client.onConnect?.({} as any);

    const publishSpy = vi.spyOn(client, 'publish').mockImplementation(() => {});

    service.publish('/app/chat', { message: 'hi' }, { header1: 'val' });

    expect(publishSpy).toHaveBeenCalledWith({
      destination: '/app/chat',
      body: JSON.stringify({ message: 'hi' }),
      headers: { header1: 'val' }
    });
  });

  it('should schedule reconnection on unexpected websocket close', () => {
    vi.useFakeTimers();
    try {
      service.connect('test-token');
      const client = (service as any).client as Client;
      client.onConnect?.({} as any);

      client.onWebSocketClose?.({} as any);

      expect(service.status()).toBe('CONNECTING');
      expect(service.reconnectAttempts()).toBe(1);

      vi.advanceTimersByTime(110);

      expect((service as any).client).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should set showReconnectAlert to true after 5 failed reconnect attempts', () => {
    (service as any).reconnectAttempts.set(5);
    expect(service.showReconnectAlert()).toBe(true);

    (service as any).reconnectAttempts.set(4);
    expect(service.showReconnectAlert()).toBe(false);
  });
});
