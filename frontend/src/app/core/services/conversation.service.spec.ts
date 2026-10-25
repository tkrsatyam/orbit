import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ConversationItem, ConversationListResponse } from '../models/conversation.model';
import { ConversationService } from './conversation.service';

describe('ConversationService', () => {
  let service: ConversationService;
  let httpTesting: HttpTestingController;

  const mockConversations: ConversationItem[] = [
    {
      id: 'conv-1',
      type: 'DIRECT',
      participant: {
        id: 'user-2',
        displayName: 'Bob',
        avatarUrl: null,
        online: true
      },
      lastMessage: {
        content: 'Hey there',
        senderId: 'user-2',
        sentAt: '2026-10-25T10:00:00Z'
      },
      unreadCount: 2,
      muted: false
    },
    {
      id: 'conv-2',
      type: 'GROUP',
      group: {
        id: 'group-1',
        name: 'Tech Talk',
        avatarUrl: null,
        memberCount: 5
      },
      lastMessage: {
        content: 'Meeting tomorrow',
        senderDisplayName: 'Alice',
        sentAt: '2026-10-25T09:30:00Z'
      },
      unreadCount: 0,
      muted: false
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(ConversationService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    assertThatServiceIsDefined();
  });

  function assertThatServiceIsDefined() {
    expect(service).toBeTruthy();
    expect(service.conversations()).toEqual([]);
    expect(service.unreadTotalCount()).toBe(0);
  }

  it('loadConversations should fetch and set conversations signal', () => {
    const response: ConversationListResponse = { content: mockConversations };

    service.loadConversations().subscribe(res => {
      expect(res.content).toEqual(mockConversations);
      expect(service.conversations()).toEqual(mockConversations);
      expect(service.unreadTotalCount()).toBe(2);
      expect(service.isLoading()).toBe(false);
    });

    expect(service.isLoading()).toBe(true);

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/conversations`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush(response);
  });

  it('updatePresence should update participant online flag for matching user', () => {
    service.conversations.set([...mockConversations]);

    service.updatePresence('user-2', false);

    const updated = service.conversations().find(c => c.id === 'conv-1');
    expect(updated?.participant?.online).toBe(false);

    service.updatePresence('user-2', true);
    expect(service.conversations().find(c => c.id === 'conv-1')?.participant?.online).toBe(true);
  });

  it('resetUnreadCount should reset unreadCount to 0 for specified conversation', () => {
    service.conversations.set([...mockConversations]);
    expect(service.unreadTotalCount()).toBe(2);

    service.resetUnreadCount('conv-1');

    const updated = service.conversations().find(c => c.id === 'conv-1');
    expect(updated?.unreadCount).toBe(0);
    expect(service.unreadTotalCount()).toBe(0);
  });

  it('incrementUnreadCount should increment unreadCount for specified conversation', () => {
    service.conversations.set([...mockConversations]);

    service.incrementUnreadCount('conv-1');

    const updated = service.conversations().find(c => c.id === 'conv-1');
    expect(updated?.unreadCount).toBe(3);
    expect(service.unreadTotalCount()).toBe(3);
  });

  it('updateLastMessage should update message and move conversation to top of list', () => {
    service.conversations.set([...mockConversations]);

    const newLastMessage = {
      content: 'New group announcement',
      senderDisplayName: 'Charlie',
      sentAt: '2026-10-25T11:00:00Z'
    };

    service.updateLastMessage('conv-2', newLastMessage);

    const items = service.conversations();
    expect(items[0].id).toBe('conv-2');
    expect(items[0].lastMessage?.content).toBe('New group announcement');
    expect(items[1].id).toBe('conv-1');
  });
});
