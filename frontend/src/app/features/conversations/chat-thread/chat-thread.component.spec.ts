import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { MessageResponse } from '../../../core/models/message.model';
import { AuthService } from '../../../core/services/auth.service';
import { ContactService } from '../../../core/services/contact.service';
import { MessageService } from '../../../core/services/message/message.service';
import { UserService } from '../../../core/services/user.service';
import { WebSocketService } from '../../../core/services/websocket/websocket.service';
import { ChatThreadComponent } from './chat-thread.component';

describe('ChatThreadComponent', () => {
  let component: ChatThreadComponent;
  let fixture: ComponentFixture<ChatThreadComponent>;

  let authServiceMock: {
    currentUser: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    subscribeToConversation: ReturnType<typeof vi.fn>;
    subscribeToReceipts: ReturnType<typeof vi.fn>;
    sendMessageStomp: ReturnType<typeof vi.fn>;
    sendMessageRest: ReturnType<typeof vi.fn>;
    isWebSocketConnected: ReturnType<typeof vi.fn>;
  };
  let contactServiceMock: {
    contacts: ReturnType<typeof vi.fn>;
    loadContacts: ReturnType<typeof vi.fn>;
  };
  let userServiceMock: {
    getUserProfile: ReturnType<typeof vi.fn>;
    unblockUser: ReturnType<typeof vi.fn>;
  };
  let webSocketServiceMock: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    isConnected: ReturnType<typeof vi.fn>;
    showReconnectAlert: ReturnType<typeof vi.fn>;
  };

  const paramMap$ = new BehaviorSubject(convertToParamMap({ id: 'conv-test-1' }));
  const queryParamMap$ = new BehaviorSubject(convertToParamMap({ peerName: 'Ananya Roy', peerId: 'peer-user-1' }));

  let conversationCallback: ((msg: MessageResponse) => void) | undefined;
  let receiptCallback: ((receipt: MessageResponse) => void) | undefined;

  beforeEach(async () => {
    authServiceMock = {
      currentUser: vi.fn().mockReturnValue({ id: 'my-user-id', email: 'me@example.com', displayName: 'Satyam Kumar' })
    };

    messageServiceMock = {
      subscribeToConversation: vi.fn().mockImplementation((_convId: string, cb: (msg: MessageResponse) => void) => {
        conversationCallback = cb;
        return () => {};
      }),
      subscribeToReceipts: vi.fn().mockImplementation((cb: (receipt: MessageResponse) => void) => {
        receiptCallback = cb;
        return () => {};
      }),
      sendMessageStomp: vi.fn(),
      sendMessageRest: vi.fn(),
      isWebSocketConnected: vi.fn().mockReturnValue(true)
    };

    contactServiceMock = {
      contacts: vi.fn().mockReturnValue([]),
      loadContacts: vi.fn().mockReturnValue(of({ content: [] }))
    };

    userServiceMock = {
      getUserProfile: vi.fn().mockReturnValue(of({ id: 'peer-user-1', connectionStatus: 'CONNECTED' })),
      unblockUser: vi.fn().mockReturnValue(of(undefined))
    };

    webSocketServiceMock = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true),
      showReconnectAlert: vi.fn().mockReturnValue(false)
    };

    await TestBed.configureTestingModule({
      imports: [ChatThreadComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: ContactService, useValue: contactServiceMock },
        { provide: UserService, useValue: userServiceMock },
        { provide: WebSocketService, useValue: webSocketServiceMock },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap$.asObservable(),
            queryParamMap: queryParamMap$.asObservable()
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChatThreadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create and initialize conversation from route params', () => {
    expect(component).toBeTruthy();
    expect(component.conversationId()).toBe('conv-test-1');
    expect(component.peerName()).toBe('Ananya Roy');
    expect(component.peerId()).toBe('peer-user-1');
    expect(messageServiceMock.subscribeToConversation).toHaveBeenCalledWith('conv-test-1', expect.any(Function));
    expect(messageServiceMock.subscribeToReceipts).toHaveBeenCalled();
  });

  it('should send message via STOMP when WebSocket is connected', () => {
    messageServiceMock.isWebSocketConnected.mockReturnValue(true);
    component.messageInput.set('Hello from STOMP test!');

    component.sendMessage();

    expect(component.messages().length).toBe(1);
    const sent = component.messages()[0];
    expect(sent.content).toBe('Hello from STOMP test!');
    expect(sent.deliveryStatus).toBe('SENDING');
    expect(component.messageInput()).toBe('');

    expect(messageServiceMock.sendMessageStomp).toHaveBeenCalledWith(
      'conv-test-1',
      'Hello from STOMP test!',
      expect.any(String)
    );
  });

  it('should send message via REST fallback when WebSocket is disconnected', () => {
    messageServiceMock.isWebSocketConnected.mockReturnValue(false);
    const mockResponse: MessageResponse = {
      id: 'msg-server-123',
      conversationId: 'conv-test-1',
      senderId: 'my-user-id',
      senderName: 'Satyam Kumar',
      type: 'TEXT',
      content: 'Hello fallback REST!',
      deleted: false,
      edited: false,
      createdAt: '2026-10-23T22:30:00Z'
    };
    messageServiceMock.sendMessageRest.mockReturnValue(of(mockResponse));

    component.messageInput.set('Hello fallback REST!');
    component.sendMessage();

    expect(messageServiceMock.sendMessageRest).toHaveBeenCalled();
    expect(component.messages().length).toBe(1);
    expect(component.messages()[0].id).toBe('msg-server-123');
    expect(component.messages()[0].deliveryStatus).toBe('SENT');
  });

  it('should mark message as FAILED when REST send fails', () => {
    messageServiceMock.isWebSocketConnected.mockReturnValue(false);
    messageServiceMock.sendMessageRest.mockReturnValue(throwError(() => new Error('Network error')));

    component.messageInput.set('This will fail');
    component.sendMessage();

    expect(component.messages().length).toBe(1);
    expect(component.messages()[0].deliveryStatus).toBe('FAILED');
  });

  it('should retry failed message via REST', () => {
    const failedMsg = {
      id: 'temp-failed-1',
      conversationId: 'conv-test-1',
      senderId: 'my-user-id',
      senderName: 'Satyam Kumar',
      type: 'TEXT' as const,
      content: 'Retry message',
      deleted: false,
      edited: false,
      createdAt: '2026-10-23T22:30:00Z',
      deliveryStatus: 'FAILED' as const,
      idempotencyKey: 'idem-retry-1'
    };
    component.messages.set([failedMsg]);

    const mockResponse: MessageResponse = {
      id: 'msg-retried-success',
      conversationId: 'conv-test-1',
      senderId: 'my-user-id',
      senderName: 'Satyam Kumar',
      type: 'TEXT',
      content: 'Retry message',
      deleted: false,
      edited: false,
      createdAt: '2026-10-23T22:31:00Z'
    };
    messageServiceMock.sendMessageRest.mockReturnValue(of(mockResponse));

    component.retryMessage(failedMsg);

    expect(messageServiceMock.sendMessageRest).toHaveBeenCalledWith('conv-test-1', 'Retry message', 'idem-retry-1');
    expect(component.messages()[0].deliveryStatus).toBe('SENT');
    expect(component.messages()[0].id).toBe('msg-retried-success');
  });

  it('should handle incoming message from peer', () => {
    const incoming: MessageResponse = {
      id: 'msg-incoming-1',
      conversationId: 'conv-test-1',
      senderId: 'peer-user-1',
      senderName: 'Ananya Roy',
      type: 'TEXT',
      content: 'Hey there!',
      deleted: false,
      edited: false,
      createdAt: '2026-10-23T22:35:00Z'
    };

    expect(conversationCallback).toBeDefined();
    conversationCallback!(incoming);

    expect(component.messages().length).toBe(1);
    expect(component.messages()[0].id).toBe('msg-incoming-1');
    expect(component.messages()[0].content).toBe('Hey there!');
    expect(component.messages()[0].deliveryStatus).toBe('SENT');
  });

  it('should handle receipt for optimistic message', () => {
    messageServiceMock.isWebSocketConnected.mockReturnValue(true);
    component.messageInput.set('Receipt test message');
    component.sendMessage();

    const pendingMsg = component.messages()[0];
    expect(pendingMsg.deliveryStatus).toBe('SENDING');

    const receipt: MessageResponse = {
      id: 'server-confirmed-id',
      conversationId: 'conv-test-1',
      senderId: 'my-user-id',
      senderName: 'Satyam Kumar',
      type: 'TEXT',
      content: 'Receipt test message',
      deleted: false,
      edited: false,
      createdAt: '2026-10-23T22:40:00Z'
    };

    expect(receiptCallback).toBeDefined();
    receiptCallback!(receipt);

    expect(component.messages().length).toBe(1);
    expect(component.messages()[0].deliveryStatus).toBe('SENT');
    expect(component.messages()[0].id).toBe('server-confirmed-id');
  });

  it('should enforce blocker client-side per ADR 007 Decision 5 and allow unblocking', () => {
    component.isPeerBlockedByMe.set(true);
    fixture.detectChanges();

    const blockedCard = fixture.nativeElement.querySelector('[data-testid="composer-blocked-card"]');
    expect(blockedCard).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="message-input"]')).toBeNull();

    // Trying to send while blocked does nothing
    component.messageInput.set('Should not send');
    component.sendMessage();
    expect(component.messages().length).toBe(0);

    // Unblock peer
    component.unblockPeer();
    expect(userServiceMock.unblockUser).toHaveBeenCalledWith('peer-user-1');
    expect(component.isPeerBlockedByMe()).toBe(false);

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="composer-blocked-card"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="message-input"]')).toBeTruthy();
  });
});
