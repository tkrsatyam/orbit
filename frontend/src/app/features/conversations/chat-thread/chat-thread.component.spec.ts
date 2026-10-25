import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
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
    subscribeToEdits: ReturnType<typeof vi.fn>;
    subscribeToDeletes: ReturnType<typeof vi.fn>;
    subscribeToTyping: ReturnType<typeof vi.fn>;
    sendTyping: ReturnType<typeof vi.fn>;
    sendMessageStomp: ReturnType<typeof vi.fn>;
    sendMessageRest: ReturnType<typeof vi.fn>;
    editMessage: ReturnType<typeof vi.fn>;
    deleteMessage: ReturnType<typeof vi.fn>;
    getConversationMessages: ReturnType<typeof vi.fn>;
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
  let editCallback: ((edited: any) => void) | undefined;
  let deleteCallback: ((deleted: any) => void) | undefined;
  let typingCallback: ((typing: any) => void) | undefined;

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
      subscribeToEdits: vi.fn().mockImplementation((_convId: string, cb: (edited: any) => void) => {
        editCallback = cb;
        return () => {};
      }),
      subscribeToDeletes: vi.fn().mockImplementation((_convId: string, cb: (deleted: any) => void) => {
        deleteCallback = cb;
        return () => {};
      }),
      subscribeToTyping: vi.fn().mockImplementation((_convId: string, cb: (typing: any) => void) => {
        typingCallback = cb;
        return () => {};
      }),
      sendTyping: vi.fn(),
      sendMessageStomp: vi.fn(),
      sendMessageRest: vi.fn(),
      editMessage: vi.fn().mockReturnValue(of({ id: 'msg-1', content: 'Updated content', edited: true, editedAt: '2026-10-24T10:00:00Z' })),
      deleteMessage: vi.fn().mockReturnValue(of(undefined)),
      getConversationMessages: vi.fn().mockReturnValue(of({ content: [], hasMore: false, nextCursor: null })),
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
        provideRouter([]),
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
    expect(component.messages()[0].deliveryStatus).toBe('DELIVERED');
  });

  it('should transition own message from SENT to DELIVERED when topic event arrives', () => {
    messageServiceMock.isWebSocketConnected.mockReturnValue(true);
    component.messageInput.set('Delivered test');
    component.sendMessage();

    const receipt: MessageResponse = {
      id: 'msg-delivered-1',
      conversationId: 'conv-test-1',
      senderId: 'my-user-id',
      senderName: 'Satyam Kumar',
      type: 'TEXT',
      content: 'Delivered test',
      deleted: false,
      edited: false,
      createdAt: '2026-10-23T22:40:00Z'
    };
    receiptCallback!(receipt);
    expect(component.messages()[0].deliveryStatus).toBe('SENT');

    // Topic broadcast arrives
    conversationCallback!(receipt);
    expect(component.messages()[0].deliveryStatus).toBe('DELIVERED');
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

  it('should navigate back to root when goBack is called', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    component.goBack();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('should load initial message history and hydrate messages signal', () => {
    const mockHistory = {
      content: [
        {
          id: 'hist-1',
          conversationId: 'conv-test-1',
          senderId: 'peer-user-1',
          senderName: 'Ananya Roy',
          type: 'TEXT' as const,
          content: 'Hello historical 1',
          deleted: false,
          edited: false,
          createdAt: '2026-10-24T09:00:00Z'
        },
        {
          id: 'hist-2',
          conversationId: 'conv-test-1',
          senderId: 'my-user-id',
          senderName: 'Satyam Kumar',
          type: 'TEXT' as const,
          content: 'Hello historical 2',
          deleted: false,
          edited: false,
          createdAt: '2026-10-24T09:01:00Z'
        }
      ],
      hasMore: true,
      nextCursor: 'hist-1'
    };

    messageServiceMock.getConversationMessages.mockReturnValue(of(mockHistory));
    component.loadInitialHistory('conv-test-1');

    expect(component.messages().length).toBe(2);
    expect(component.messages()[0].content).toBe('Hello historical 1');
    expect(component.messages()[1].content).toBe('Hello historical 2');
    expect(component.messages()[1].deliveryStatus).toBe('DELIVERED');
    expect(component.hasMore()).toBe(true);
    expect(component.nextCursor()).toBe('hist-1');
  });

  it('should load older messages and prepend them without duplicates', () => {
    component.messages.set([
      {
        id: 'msg-recent',
        conversationId: 'conv-test-1',
        senderId: 'peer-user-1',
        senderName: 'Ananya Roy',
        type: 'TEXT',
        content: 'Recent message',
        deleted: false,
        edited: false,
        createdAt: '2026-10-24T10:00:00Z'
      }
    ]);
    component.hasMore.set(true);
    component.nextCursor.set('msg-recent');

    const olderHistory = {
      content: [
        {
          id: 'msg-older',
          conversationId: 'conv-test-1',
          senderId: 'peer-user-1',
          senderName: 'Ananya Roy',
          type: 'TEXT' as const,
          content: 'Older message',
          deleted: false,
          edited: false,
          createdAt: '2026-10-24T09:30:00Z'
        }
      ],
      hasMore: false,
      nextCursor: null
    };

    messageServiceMock.getConversationMessages.mockReturnValue(of(olderHistory));
    component.loadOlderMessages();

    expect(messageServiceMock.getConversationMessages).toHaveBeenCalledWith('conv-test-1', 50, 'msg-recent');
    expect(component.messages().length).toBe(2);
    expect(component.messages()[0].id).toBe('msg-older');
    expect(component.messages()[1].id).toBe('msg-recent');
    expect(component.hasMore()).toBe(false);
    expect(component.nextCursor()).toBeNull();
  });

  it('should trigger loadOlderMessages when scrolled near top and hasMore is true', () => {
    const loadSpy = vi.spyOn(component, 'loadOlderMessages');
    component.hasMore.set(true);

    const mockEvent = {
      target: {
        scrollTop: 20
      }
    } as unknown as Event;

    component.onScroll(mockEvent);
    expect(loadSpy).toHaveBeenCalled();
  });

  it('should render deleted message notice when deleted is true', () => {
    component.messages.set([
      {
        id: 'msg-del',
        conversationId: 'conv-test-1',
        senderId: 'peer-user-1',
        senderName: 'Ananya Roy',
        type: 'TEXT',
        content: '',
        deleted: true,
        edited: false,
        createdAt: '2026-10-24T09:00:00Z'
      }
    ]);
    fixture.detectChanges();

    const delNotice = fixture.nativeElement.querySelector('.deleted-text');
    expect(delNotice).toBeTruthy();
    expect(delNotice.textContent).toContain('This message was deleted.');
  });

  it('should render "You deleted this message." when sender deletes own message', () => {
    component.messages.set([
      {
        id: 'msg-del-own',
        conversationId: 'conv-test-1',
        senderId: 'my-user-id',
        senderName: 'Satyam Kumar',
        type: 'TEXT',
        content: '',
        deleted: true,
        edited: false,
        createdAt: '2026-10-24T09:00:00Z',
        deliveryStatus: 'DELIVERED'
      }
    ]);
    fixture.detectChanges();

    const delNotice = fixture.nativeElement.querySelector('.message-bubble.outgoing .deleted-text');
    expect(delNotice).toBeTruthy();
    expect(delNotice.textContent).toContain('You deleted this message.');
  });

  it('should preserve SENT deliveryStatus for blocked messages in history', () => {
    const mockHistory = {
      content: [
        {
          id: 'blocked-msg-1',
          conversationId: 'conv-test-1',
          senderId: 'my-user-id',
          senderName: 'Satyam Kumar',
          type: 'TEXT' as const,
          content: 'Blocked message attempt',
          deleted: false,
          edited: false,
          createdAt: '2026-10-24T09:00:00Z',
          deliveryStatus: 'SENT' as const
        }
      ],
      hasMore: false,
      nextCursor: null
    };

    messageServiceMock.getConversationMessages.mockReturnValue(of(mockHistory));
    component.loadInitialHistory('conv-test-1');
    fixture.detectChanges();

    expect(component.messages().length).toBe(1);
    expect(component.messages()[0].deliveryStatus).toBe('SENT');
    const sentCheck = fixture.nativeElement.querySelector('.delivery-status.sent');
    expect(sentCheck).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.delivery-status.delivered')).toBeNull();
  });

  describe('Edit Message Functionality', () => {
    const ownMessage = {
      id: 'msg-own-1',
      conversationId: 'conv-test-1',
      senderId: 'my-user-id',
      senderName: 'Satyam Kumar',
      type: 'TEXT' as const,
      content: 'Original content',
      deleted: false,
      edited: false,
      createdAt: '2026-10-24T09:00:00Z',
      deliveryStatus: 'DELIVERED' as const
    };

    it('should set editingMessage and populate input on startEdit', () => {
      component.messages.set([ownMessage]);
      component.startEdit(ownMessage);

      expect(component.isEditing()).toBe(true);
      expect(component.editingMessage()?.id).toBe('msg-own-1');
      expect(component.messageInput()).toBe('Original content');
    });

    it('should clear editing state on cancelEdit', () => {
      component.messages.set([ownMessage]);
      component.startEdit(ownMessage);
      component.cancelEdit();

      expect(component.isEditing()).toBe(false);
      expect(component.editingMessage()).toBeNull();
      expect(component.messageInput()).toBe('');
    });

    it('should cancel edit on Escape keydown', () => {
      component.messages.set([ownMessage]);
      component.startEdit(ownMessage);

      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      component.onKeydown(escEvent);

      expect(component.isEditing()).toBe(false);
      expect(component.messageInput()).toBe('');
    });

    it('should send edit request and update message optimistically on save', () => {
      component.messages.set([ownMessage]);
      component.startEdit(ownMessage);
      component.messageInput.set('Updated content');

      messageServiceMock.editMessage.mockReturnValue(of({
        id: 'msg-own-1',
        conversationId: 'conv-test-1',
        senderId: 'my-user-id',
        senderName: 'Satyam Kumar',
        type: 'TEXT',
        content: 'Updated content',
        deleted: false,
        edited: true,
        editedAt: '2026-10-24T09:05:00Z',
        createdAt: '2026-10-24T09:00:00Z'
      }));

      component.sendMessage();

      expect(messageServiceMock.editMessage).toHaveBeenCalledWith('conv-test-1', 'msg-own-1', 'Updated content');
      expect(component.isEditing()).toBe(false);
      const updated = component.messages().find(m => m.id === 'msg-own-1');
      expect(updated?.content).toBe('Updated content');
      expect(updated?.edited).toBe(true);
    });

    it('should handle real-time message edit event from websocket', () => {
      component.messages.set([ownMessage]);

      component.handleEditedMessage({
        messageId: 'msg-own-1',
        content: 'Edited via STOMP',
        editedAt: '2026-10-24T09:06:00Z'
      });

      const updated = component.messages().find(m => m.id === 'msg-own-1');
      expect(updated?.content).toBe('Edited via STOMP');
      expect(updated?.edited).toBe(true);
    });

    it('should render edited label when message has edited: true', () => {
      component.messages.set([{
        ...ownMessage,
        edited: true,
        editedAt: '2026-10-24T09:05:00Z'
      }]);
      fixture.detectChanges();

      const editedIndicator = fixture.nativeElement.querySelector('.edited-indicator');
      expect(editedIndicator).toBeTruthy();
      expect(editedIndicator.textContent.trim()).toBe('edited');
    });
  });

  describe('Delete Message Functionality', () => {
    const ownMessage = {
      id: 'msg-del-1',
      conversationId: 'conv-test-1',
      senderId: 'my-user-id',
      senderName: 'Satyam Kumar',
      type: 'TEXT' as const,
      content: 'Message to delete',
      deleted: false,
      edited: false,
      createdAt: '2026-10-24T09:00:00Z',
      deliveryStatus: 'DELIVERED' as const
    };

    const peerMessage = {
      id: 'msg-peer-del',
      conversationId: 'conv-test-1',
      senderId: 'peer-user-1',
      senderName: 'Ananya Roy',
      type: 'TEXT' as const,
      content: 'Peer message',
      deleted: false,
      edited: false,
      createdAt: '2026-10-24T09:01:00Z'
    };

    it('should open and close delete modal dialog', () => {
      component.openDeleteModal(ownMessage);
      expect(component.deleteModalMessage()?.id).toBe('msg-del-1');

      component.closeDeleteModal();
      expect(component.deleteModalMessage()).toBeNull();
    });

    it('should confirm delete with FOR_EVERYONE and mark message as deleted placeholder', () => {
      component.messages.set([ownMessage]);
      component.openDeleteModal(ownMessage);

      messageServiceMock.deleteMessage.mockReturnValue(of(undefined));
      component.confirmDelete('FOR_EVERYONE');

      expect(messageServiceMock.deleteMessage).toHaveBeenCalledWith('conv-test-1', 'msg-del-1', 'FOR_EVERYONE');
      expect(component.deleteModalMessage()).toBeNull();

      const msg = component.messages().find(m => m.id === 'msg-del-1');
      expect(msg?.deleted).toBe(true);
      expect(msg?.content).toBe('');
    });

    it('should confirm delete with FOR_ME and completely remove message from local list', () => {
      component.messages.set([ownMessage, peerMessage]);
      component.openDeleteModal(ownMessage);

      messageServiceMock.deleteMessage.mockReturnValue(of(undefined));
      component.confirmDelete('FOR_ME');

      expect(messageServiceMock.deleteMessage).toHaveBeenCalledWith('conv-test-1', 'msg-del-1', 'FOR_ME');
      expect(component.deleteModalMessage()).toBeNull();
      expect(component.messages().length).toBe(1);
      expect(component.messages().find(m => m.id === 'msg-del-1')).toBeUndefined();
    });

    it('should handle real-time message deleted event from websocket', () => {
      component.messages.set([ownMessage]);

      component.handleDeletedMessage({
        messageId: 'msg-del-1'
      });

      const deleted = component.messages().find(m => m.id === 'msg-del-1');
      expect(deleted?.deleted).toBe(true);
      expect(deleted?.content).toBe('');
    });
  });

  describe('Mobile Touch Interaction', () => {
    it('should trigger active action bar on 500ms long press and dismiss on document click', () => {
      vi.useFakeTimers();
      const testMsg = {
        id: 'msg-touch-1',
        conversationId: 'conv-test-1',
        senderId: 'my-user-id',
        senderName: 'Satyam Kumar',
        type: 'TEXT' as const,
        content: 'Touch target',
        deleted: false,
        edited: false,
        createdAt: '2026-10-24T09:00:00Z'
      };

      component.onTouchStart(testMsg, {} as TouchEvent);
      expect(component.activeActionMessageId()).toBeNull();

      vi.advanceTimersByTime(500);
      expect(component.activeActionMessageId()).toBe('msg-touch-1');

      // Click outside dismisses
      component.onDocumentClick();
      expect(component.activeActionMessageId()).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('Typing Indicator', () => {
    it('should send typing: true on composer input and debounce typing: false after 3 seconds', () => {
      vi.useFakeTimers();

      component.onComposerInput('Hello peer');
      expect(messageServiceMock.sendTyping).toHaveBeenCalledWith('conv-test-1', true);

      // Fast typing within 2s interval shouldn't spam typing: true
      component.onComposerInput('Hello peer, how are');
      expect(messageServiceMock.sendTyping).toHaveBeenCalledTimes(1);

      // Advance 3s idle debounce
      vi.advanceTimersByTime(3000);
      expect(messageServiceMock.sendTyping).toHaveBeenCalledWith('conv-test-1', false);

      vi.useRealTimers();
    });

    it('should send typing: false immediately if input is cleared', () => {
      component.onComposerInput('Hello');
      expect(messageServiceMock.sendTyping).toHaveBeenCalledWith('conv-test-1', true);

      component.onComposerInput('');
      expect(messageServiceMock.sendTyping).toHaveBeenCalledWith('conv-test-1', false);
    });

    it('should send typing: false immediately on message submission', () => {
      component.onComposerInput('Hello world');
      expect(messageServiceMock.sendTyping).toHaveBeenCalledWith('conv-test-1', true);

      component.sendMessage();
      expect(messageServiceMock.sendTyping).toHaveBeenCalledWith('conv-test-1', false);
    });

    it('should display typing indicator pill with peer name when peer sends typing: true', () => {
      expect(component.isPeerTyping()).toBe(false);

      component.handleTypingEvent({
        userId: 'peer-user-1',
        displayName: 'Ananya Roy',
        typing: true
      });

      expect(component.isPeerTyping()).toBe(true);
      expect(component.typingPeerName()).toBe('Ananya Roy');
    });

    it('should ignore typing events originating from current user', () => {
      component.handleTypingEvent({
        userId: 'my-user-id',
        displayName: 'Satyam Kumar',
        typing: true
      });

      expect(component.isPeerTyping()).toBe(false);
    });

    it('should hide typing indicator pill when peer sends typing: false', () => {
      component.handleTypingEvent({
        userId: 'peer-user-1',
        displayName: 'Ananya Roy',
        typing: true
      });
      expect(component.isPeerTyping()).toBe(true);

      component.handleTypingEvent({
        userId: 'peer-user-1',
        displayName: 'Ananya Roy',
        typing: false
      });
      expect(component.isPeerTyping()).toBe(false);
    });

    it('should auto-clear typing indicator after 5-second safety timer', () => {
      vi.useFakeTimers();

      component.handleTypingEvent({
        userId: 'peer-user-1',
        displayName: 'Ananya Roy',
        typing: true
      });
      expect(component.isPeerTyping()).toBe(true);

      vi.advanceTimersByTime(5000);
      expect(component.isPeerTyping()).toBe(false);

      vi.useRealTimers();
    });

    it('should clear peer typing indicator when incoming message from peer arrives', () => {
      component.handleTypingEvent({
        userId: 'peer-user-1',
        displayName: 'Ananya Roy',
        typing: true
      });
      expect(component.isPeerTyping()).toBe(true);

      // Incoming message from peer
      if (conversationCallback) {
        conversationCallback({
          id: 'msg-incoming-1',
          conversationId: 'conv-test-1',
          senderId: 'peer-user-1',
          senderName: 'Ananya Roy',
          type: 'TEXT',
          content: 'Here is my reply!',
          deleted: false,
          edited: false,
          createdAt: new Date().toISOString()
        });
      }

      expect(component.isPeerTyping()).toBe(false);
    });

    it('should render incoming-avatar with peerInitial alongside typing bubble in the message stream', () => {
      component.handleTypingEvent({
        userId: 'peer-user-1',
        displayName: 'Ananya Roy',
        typing: true
      });
      fixture.detectChanges();

      const typingRow = fixture.nativeElement.querySelector('[data-testid="typing-indicator-row"]');
      expect(typingRow).toBeTruthy();

      const avatar = typingRow.querySelector('.incoming-avatar');
      expect(avatar).toBeTruthy();
      expect(avatar.textContent.trim()).toBe(component.peerInitial());

      const bubble = typingRow.querySelector('[data-testid="typing-bubble"]');
      expect(bubble).toBeTruthy();
      const dots = bubble.querySelectorAll('.typing-dot');
      expect(dots.length).toBe(3);
    });

    it('should open message action bar on chevron click', () => {
      const mockMsg = {
        id: 'msg-test-chevron',
        conversationId: 'conv-test-1',
        senderId: 'user-me-1',
        senderName: 'Satyam',
        type: 'TEXT',
        content: 'Testing chevron action trigger',
        deleted: false,
        edited: false,
        createdAt: new Date().toISOString()
      };
      (component as any).messages.set([mockMsg]);
      fixture.detectChanges();

      const chevron = fixture.nativeElement.querySelector('[data-testid="message-chevron-btn-msg-test-chevron"]');
      expect(chevron).toBeTruthy();

      chevron.click();
      fixture.detectChanges();

      expect(component.activeActionMessageId()).toBe('msg-test-chevron');
      const actionsBar = fixture.nativeElement.querySelector('[data-testid="message-actions-msg-test-chevron"]');
      expect(actionsBar.classList.contains('visible')).toBe(true);
    });

    it('should open message action bar on contextmenu (right-click)', () => {
      const mockMsg = {
        id: 'msg-test-contextmenu',
        conversationId: 'conv-test-1',
        senderId: 'peer-user-1',
        senderName: 'Ananya',
        type: 'TEXT',
        content: 'Testing contextmenu trigger',
        deleted: false,
        edited: false,
        createdAt: new Date().toISOString()
      };
      (component as any).messages.set([mockMsg]);
      fixture.detectChanges();

      const bubble = fixture.nativeElement.querySelector('.message-bubble.incoming');
      expect(bubble).toBeTruthy();

      const event = new MouseEvent('contextmenu', { cancelable: true });
      bubble.dispatchEvent(event);
      fixture.detectChanges();

      expect(component.activeActionMessageId()).toBe('msg-test-contextmenu');
    });
  });
});
