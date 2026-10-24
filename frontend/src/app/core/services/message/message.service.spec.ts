import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { MessageHistoryResponse, MessageResponse } from '../../models/message.model';
import { WebSocketService } from '../websocket/websocket.service';
import { MessageService } from './message.service';

describe('MessageService', () => {
  let service: MessageService;
  let httpTesting: HttpTestingController;
  let webSocketServiceMock: {
    publish: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    isConnected: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    webSocketServiceMock = {
      publish: vi.fn(),
      subscribe: vi.fn(),
      isConnected: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        MessageService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: WebSocketService, useValue: webSocketServiceMock }
      ]
    });

    service = TestBed.inject(MessageService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should send message via STOMP to /app/conversations/{id}/send', () => {
    service.sendMessageStomp('conv-123', 'Hello world!', 'idem-key-1');

    expect(webSocketServiceMock.publish).toHaveBeenCalledWith(
      '/app/conversations/conv-123/send',
      {
        content: 'Hello world!',
        type: 'TEXT',
        idempotencyKey: 'idem-key-1'
      }
    );
  });

  it('should send message via REST POST with X-Idempotency-Key and withCredentials', () => {
    const mockResponse: MessageResponse = {
      id: 'msg-999',
      conversationId: 'conv-123',
      senderId: 'user-1',
      senderName: 'Satyam',
      type: 'TEXT',
      content: 'Hello fallback!',
      deleted: false,
      edited: false,
      createdAt: '2026-10-23T22:00:00Z'
    };

    let result: MessageResponse | undefined;
    service.sendMessageRest('conv-123', 'Hello fallback!', 'idem-fallback-key').subscribe(res => {
      result = res;
    });

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/conversations/conv-123/messages`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      content: 'Hello fallback!',
      type: 'TEXT',
      idempotencyKey: 'idem-fallback-key'
    });
    expect(req.request.headers.get('X-Idempotency-Key')).toBe('idem-fallback-key');
    expect(req.request.withCredentials).toBe(true);

    req.flush(mockResponse);
    expect(result).toEqual(mockResponse);
  });

  it('should subscribe to conversation topic', () => {
    const callback = vi.fn();
    const mockUnsubscribe = vi.fn();
    webSocketServiceMock.subscribe.mockReturnValue(mockUnsubscribe);

    const unsub = service.subscribeToConversation('conv-123', callback);

    expect(webSocketServiceMock.subscribe).toHaveBeenCalledWith(
      '/topic/conversations/conv-123/messages',
      callback
    );
    unsub();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should subscribe to user receipts queue', () => {
    const callback = vi.fn();
    const mockUnsubscribe = vi.fn();
    webSocketServiceMock.subscribe.mockReturnValue(mockUnsubscribe);

    const unsub = service.subscribeToReceipts(callback);

    expect(webSocketServiceMock.subscribe).toHaveBeenCalledWith(
      '/user/queue/receipts',
      callback
    );
    unsub();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should get conversation messages with query parameters', () => {
    const mockHistory: MessageHistoryResponse = {
      content: [
        {
          id: 'msg-1',
          conversationId: 'conv-123',
          senderId: 'user-1',
          senderName: 'Satyam',
          type: 'TEXT',
          content: 'Hello history',
          deleted: false,
          edited: false,
          createdAt: '2026-10-24T10:00:00Z'
        }
      ],
      hasMore: true,
      nextCursor: 'msg-1'
    };

    let result: MessageHistoryResponse | undefined;
    service.getConversationMessages('conv-123', 25, 'cursor-prev').subscribe(res => {
      result = res;
    });

    const req = httpTesting.expectOne(
      r => r.url === `${environment.apiBaseUrl}/api/v1/conversations/conv-123/messages`
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('size')).toBe('25');
    expect(req.request.params.get('before')).toBe('cursor-prev');
    expect(req.request.withCredentials).toBe(true);

    req.flush(mockHistory);
    expect(result).toEqual(mockHistory);
  });

  it('should delegate isWebSocketConnected to WebSocketService.isConnected()', () => {
    webSocketServiceMock.isConnected.mockReturnValue(true);
    expect(service.isWebSocketConnected()).toBe(true);

    webSocketServiceMock.isConnected.mockReturnValue(false);
    expect(service.isWebSocketConnected()).toBe(false);
  });

  it('should edit message via PATCH with withCredentials', () => {
    const mockResponse: MessageResponse = {
      id: 'msg-1',
      conversationId: 'conv-123',
      senderId: 'user-1',
      senderName: 'Satyam',
      type: 'TEXT',
      content: 'Updated content',
      deleted: false,
      edited: true,
      editedAt: '2026-10-24T12:00:00Z',
      createdAt: '2026-10-24T10:00:00Z'
    };

    let result: MessageResponse | undefined;
    service.editMessage('conv-123', 'msg-1', 'Updated content').subscribe(res => {
      result = res;
    });

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/conversations/conv-123/messages/msg-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ content: 'Updated content' });
    expect(req.request.withCredentials).toBe(true);

    req.flush(mockResponse);
    expect(result).toEqual(mockResponse);
  });

  it('should delete message with FOR_EVERYONE via DELETE with mode param', () => {
    service.deleteMessage('conv-123', 'msg-1', 'FOR_EVERYONE').subscribe();

    const req = httpTesting.expectOne(
      r => r.url === `${environment.apiBaseUrl}/api/v1/conversations/conv-123/messages/msg-1`
    );
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.get('mode')).toBe('FOR_EVERYONE');
    expect(req.request.withCredentials).toBe(true);
    req.flush(null);
  });

  it('should delete message with FOR_ME via DELETE with mode param', () => {
    service.deleteMessage('conv-123', 'msg-1', 'FOR_ME').subscribe();

    const req = httpTesting.expectOne(
      r => r.url === `${environment.apiBaseUrl}/api/v1/conversations/conv-123/messages/msg-1`
    );
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.get('mode')).toBe('FOR_ME');
    expect(req.request.withCredentials).toBe(true);
    req.flush(null);
  });

  it('should subscribe to edits on /topic/conversations/{id}/messages/edited', () => {
    const callback = vi.fn();
    service.subscribeToEdits('conv-123', callback);

    expect(webSocketServiceMock.subscribe).toHaveBeenCalledWith(
      '/topic/conversations/conv-123/messages/edited',
      callback
    );
  });

  it('should subscribe to deletes on /topic/conversations/{id}/messages/deleted', () => {
    const callback = vi.fn();
    service.subscribeToDeletes('conv-123', callback);

    expect(webSocketServiceMock.subscribe).toHaveBeenCalledWith(
      '/topic/conversations/conv-123/messages/deleted',
      callback
    );
  });
});
