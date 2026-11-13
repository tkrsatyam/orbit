import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { ConversationItem } from '../../models/conversation.model';
import { NotificationPayload } from '../../models/notification.model';
import { ConversationService } from '../conversation.service';
import { WebSocketService } from '../websocket/websocket.service';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let conversationServiceMock: {
    conversations: ReturnType<typeof signal<ConversationItem[]>>;
    setUnreadCount: ReturnType<typeof vi.fn>;
    loadConversations: ReturnType<typeof vi.fn>;
  };
  let webSocketServiceMock: {
    subscribe: ReturnType<typeof vi.fn>;
  };
  let routerMock: {
    navigate: ReturnType<typeof vi.fn>;
  };

  let capturedCallback: ((payload: NotificationPayload) => void) | undefined;
  const originalNotification = (window as any).Notification;

  const mockConversations: ConversationItem[] = [
    {
      id: 'conv-1',
      type: 'DIRECT',
      participant: { id: 'user-2', displayName: 'Bob', online: true },
      unreadCount: 0,
      muted: false
    },
    {
      id: 'conv-2',
      type: 'GROUP',
      group: { id: 'grp-1', name: 'Design Space', memberCount: 4 },
      unreadCount: 1,
      muted: true
    }
  ];

  beforeEach(() => {
    localStorage.removeItem('orbit_notification_banner_dismissed');

    conversationServiceMock = {
      conversations: signal<ConversationItem[]>(mockConversations),
      setUnreadCount: vi.fn(),
      loadConversations: vi.fn().mockReturnValue(of({ content: mockConversations }))
    };

    webSocketServiceMock = {
      subscribe: vi.fn().mockImplementation((dest: string, cb: any) => {
        if (dest === '/user/queue/notifications') {
          capturedCallback = cb;
        }
        return () => {};
      })
    };

    routerMock = {
      navigate: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        { provide: ConversationService, useValue: conversationServiceMock },
        { provide: WebSocketService, useValue: webSocketServiceMock },
        { provide: Router, useValue: routerMock }
      ]
    });

    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    localStorage.removeItem('orbit_notification_banner_dismissed');
    (window as any).Notification = originalNotification;
    vi.restoreAllMocks();
  });

  it('should be created and subscribe to /user/queue/notifications', () => {
    expect(service).toBeTruthy();
    expect(webSocketServiceMock.subscribe).toHaveBeenCalledWith(
      '/user/queue/notifications',
      expect.any(Function)
    );
  });

  it('should update conversation unread count on UNREAD_COUNT notification event', () => {
    expect(capturedCallback).toBeDefined();
    capturedCallback!({
      type: 'UNREAD_COUNT',
      conversationId: 'conv-1',
      count: 4
    });

    expect(conversationServiceMock.setUnreadCount).toHaveBeenCalledWith('conv-1', 4);
  });

  it('should reload conversations if unread notification arrives for unknown conversation', () => {
    capturedCallback!({
      type: 'UNREAD_COUNT',
      conversationId: 'conv-999',
      count: 2
    });

    expect(conversationServiceMock.setUnreadCount).toHaveBeenCalledWith('conv-999', 2);
    expect(conversationServiceMock.loadConversations).toHaveBeenCalled();
  });

  it('dismissBanner should set isBannerDismissed to true and persist in localStorage', () => {
    expect(service.isBannerDismissed()).toBe(false);
    service.dismissBanner();
    expect(service.isBannerDismissed()).toBe(true);
    expect(localStorage.getItem('orbit_notification_banner_dismissed')).toBe('true');
  });

  it('requestPermission should request browser permission and update signal', async () => {
    (window as any).Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted')
    };

    const result = await service.requestPermission();
    expect(result).toBe('granted');
    expect(service.permission()).toBe('granted');
  });

  it('notifyIncomingMessage should not fire when tab is focused and visible', () => {
    service.permission.set('granted');
    const notifSpy = vi.fn();
    (notifSpy as any).permission = 'granted';
    (window as any).Notification = notifSpy;

    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

    service.notifyIncomingMessage({
      conversationId: 'conv-1',
      senderId: 'user-2',
      senderName: 'Bob',
      content: 'Hey there'
    });

    expect(notifSpy).not.toHaveBeenCalled();
  });

  it('notifyIncomingMessage should not fire for muted conversation', () => {
    service.permission.set('granted');
    const notifSpy = vi.fn();
    (notifSpy as any).permission = 'granted';
    (window as any).Notification = notifSpy;

    vi.spyOn(document, 'hasFocus').mockReturnValue(false);

    service.notifyIncomingMessage({
      conversationId: 'conv-2', // conv-2 is muted
      senderId: 'user-3',
      senderName: 'Charlie',
      content: 'Muted space update'
    });

    expect(notifSpy).not.toHaveBeenCalled();
  });

  it('notifyIncomingMessage should trigger Notification when tab is unfocused and unmuted', () => {
    service.permission.set('granted');

    let createdInstance: any;
    class MockNotification {
      static permission: NotificationPermission = 'granted';
      static requestPermission = vi.fn().mockResolvedValue('granted');
      body: string;
      icon: string;
      tag: string;
      onclick?: () => void;
      close = vi.fn();
      constructor(public title: string, options: any) {
        this.body = options?.body;
        this.icon = options?.icon;
        this.tag = options?.tag;
        createdInstance = this;
      }
    }
    (window as any).Notification = MockNotification;

    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    vi.spyOn(window, 'focus').mockImplementation(() => {});

    service.notifyIncomingMessage({
      conversationId: 'conv-1',
      senderId: 'user-2',
      senderName: 'Bob',
      content: 'Hello in the background'
    });

    expect(createdInstance).toBeDefined();
    expect(createdInstance.title).toBe('Bob');
    expect(createdInstance.body).toBe('Hello in the background');
    expect(createdInstance.tag).toBe('conv-1');

    createdInstance.onclick();
    expect(window.focus).toHaveBeenCalled();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/conversations', 'conv-1']);
    expect(createdInstance.close).toHaveBeenCalled();
  });
});
