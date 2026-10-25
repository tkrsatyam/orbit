import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, HostListener, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  ChatMessageItem,
  MessageDeleteMode,
  MessageDeletedEventPayload,
  MessageDeliveryStatus,
  MessageEditedEventPayload,
  MessageResponse,
  PresenceEventPayload,
  ReadReceiptEventPayload,
  TypingEventPayload
} from '../../../core/models/message.model';
import { AuthService } from '../../../core/services/auth.service';
import { ContactService } from '../../../core/services/contact.service';
import { ConversationService } from '../../../core/services/conversation.service';
import { MessageService } from '../../../core/services/message/message.service';
import { UserService } from '../../../core/services/user.service';
import { WebSocketService } from '../../../core/services/websocket/websocket.service';

@Component({
  selector: 'app-chat-thread',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-thread.component.html',
  styleUrl: './chat-thread.component.scss'
})
export class ChatThreadComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly contactService = inject(ContactService);
  private readonly conversationService = inject(ConversationService);
  private readonly userService = inject(UserService);
  readonly webSocketService = inject(WebSocketService);

  @ViewChild('messagesScroll') private messagesScrollContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('composerTextarea') private composerTextarea?: ElementRef<HTMLTextAreaElement>;

  readonly conversationId = signal<string>('');
  readonly peerId = signal<string>('');
  readonly peerName = signal<string>('Orbit User');
  readonly peerInitial = computed(() => this.peerName().trim().charAt(0).toUpperCase() || 'U');
  readonly peerOnline = signal<boolean>(false);

  readonly messageInput = signal<string>('');
  readonly messages = signal<ChatMessageItem[]>([]);
  readonly isSending = signal<boolean>(false);
  readonly hasMore = signal<boolean>(false);
  readonly nextCursor = signal<string | null>(null);
  readonly isLoadingOlder = signal<boolean>(false);
  readonly isLoadingInitial = signal<boolean>(false);

  // Edit message state
  readonly editingMessage = signal<ChatMessageItem | null>(null);
  readonly isEditing = computed(() => this.editingMessage() !== null);

  // Active floating action bar (message ID)
  readonly activeActionMessageId = signal<string | null>(null);

  // Delete modal state
  readonly deleteModalMessage = signal<ChatMessageItem | null>(null);
  readonly isDeleting = signal<boolean>(false);

  // Typing indicator state
  readonly isPeerTyping = signal<boolean>(false);
  readonly typingPeerName = signal<string>('');

  readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? '');

  /**
   * Block status per ADR 007 Decision 5:
   * Composer is disabled client-side when viewing a conversation where the active user blocked the peer.
   */
  readonly isPeerBlockedByMe = signal<boolean>(false);

  private unsubscribeTopic?: () => void;
  private unsubscribeReceipts?: () => void;
  private unsubscribeReadReceipts?: () => void;
  private unsubscribeEdits?: () => void;
  private unsubscribeDeletes?: () => void;
  private unsubscribeTyping?: () => void;
  private unsubscribePresence?: () => void;
  private routeSub?: Subscription;
  private touchTimer?: ReturnType<typeof setTimeout>;
  private stopTypingTimer?: ReturnType<typeof setTimeout>;
  private typingSafetyTimer?: ReturnType<typeof setTimeout>;
  private isActivelyTyping = false;
  private lastTypingSentAt = 0;

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const id = params.get('id') || '';
      if (id && id !== this.conversationId()) {
        this.conversationId.set(id);
        this.setupConversation(id);
      }
    });

    this.routeSub.add(
      this.route.queryParamMap.subscribe(queryParams => {
        const pName = queryParams.get('peerName');
        const pId = queryParams.get('peerId');
        if (pName) this.peerName.set(pName);
        if (pId) {
          this.peerId.set(pId);
          this.checkBlockStatus(pId);
          this.setupPeerPresence(pId);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.cleanupSubscriptions();
  }

  private setupConversation(id: string): void {
    this.cleanupSubscriptions();

    this.messages.set([]);
    this.hasMore.set(false);
    this.nextCursor.set(null);
    this.isLoadingOlder.set(false);
    this.isLoadingInitial.set(true);
    this.editingMessage.set(null);
    this.activeActionMessageId.set(null);
    this.deleteModalMessage.set(null);
    this.isPeerTyping.set(false);
    this.typingPeerName.set('');
    this.isActivelyTyping = false;
    this.lastTypingSentAt = 0;

    this.loadInitialHistory(id);

    // Subscribe to incoming messages on this conversation topic
    this.unsubscribeTopic = this.messageService.subscribeToConversation(id, (incoming: MessageResponse) => {
      this.handleIncomingMessage(incoming);
    });

    // Subscribe to direct send receipts
    this.unsubscribeReceipts = this.messageService.subscribeToReceipts((receipt: MessageResponse) => {
      this.handleReceipt(receipt);
    });

    // Subscribe to message edits
    this.unsubscribeEdits = this.messageService.subscribeToEdits(id, (edited: MessageEditedEventPayload) => {
      this.handleEditedMessage(edited);
    });

    // Subscribe to message deletions
    this.unsubscribeDeletes = this.messageService.subscribeToDeletes(id, (deleted: MessageDeletedEventPayload) => {
      this.handleDeletedMessage(deleted);
    });

    // Subscribe to typing indicator signals
    this.unsubscribeTyping = this.messageService.subscribeToTyping(id, (event: TypingEventPayload) => {
      this.handleTypingEvent(event);
    });

    // Subscribe to read receipts
    this.unsubscribeReadReceipts = this.messageService.subscribeToReadReceipts(id, (event: ReadReceiptEventPayload) => {
      this.handleReadReceipt(event);
    });

    this.conversationService.resetUnreadCount(id);
  }

  loadInitialHistory(id: string): void {
    this.messageService.getConversationMessages(id).subscribe({
      next: (history) => {
        if (this.conversationId() !== id) return;

        const items: ChatMessageItem[] = history.content.map(m => {
          const isMe = m.senderId === this.currentUserId();
          const isRead = (m.readBy && m.readBy.length > 0) || m.deliveryStatus === 'READ';
          return {
            ...m,
            deliveryStatus: isMe
              ? (isRead ? 'READ' : (m.deliveryStatus ?? 'DELIVERED'))
              : undefined
          };
        });
        this.messages.set(items);
        this.hasMore.set(history.hasMore);
        this.nextCursor.set(history.nextCursor ?? null);
        this.isLoadingInitial.set(false);
        this.scrollToBottom();

        // Mark unread incoming messages as read
        const unreadIncoming = history.content.filter(
          m => m.senderId !== this.currentUserId() && (!m.readBy || !m.readBy.includes(this.currentUserId()))
        );
        for (const msg of unreadIncoming) {
          this.messageService.markMessageAsRead(id, msg.id).subscribe({
            error: () => {}
          });
        }
        this.conversationService.resetUnreadCount(id);
      },
      error: (err) => {
        console.error('Failed to load conversation history', err);
        this.isLoadingInitial.set(false);
      }
    });
  }

  loadOlderMessages(): void {
    const convId = this.conversationId();
    const cursor = this.nextCursor();
    if (!convId || !cursor || this.isLoadingOlder() || !this.hasMore()) {
      return;
    }

    const viewport = this.messagesScrollContainer?.nativeElement;
    const prevScrollHeight = viewport ? viewport.scrollHeight : 0;
    const prevScrollTop = viewport ? viewport.scrollTop : 0;

    this.isLoadingOlder.set(true);
    this.messageService.getConversationMessages(convId, 50, cursor).subscribe({
      next: (history) => {
        if (this.conversationId() !== convId) return;

        const olderItems: ChatMessageItem[] = history.content.map(m => {
          const isMe = m.senderId === this.currentUserId();
          const isRead = (m.readBy && m.readBy.length > 0) || m.deliveryStatus === 'READ';
          return {
            ...m,
            deliveryStatus: isMe
              ? (isRead ? 'READ' : (m.deliveryStatus ?? 'DELIVERED'))
              : undefined
          };
        });

        this.messages.update(existing => {
          const existingIds = new Set(existing.map(m => m.id));
          const filteredOlder = olderItems.filter(m => !existingIds.has(m.id));
          return [...filteredOlder, ...existing];
        });

        this.hasMore.set(history.hasMore);
        this.nextCursor.set(history.nextCursor ?? null);
        this.isLoadingOlder.set(false);

        // Maintain scroll anchor position so view doesn't jump
        setTimeout(() => {
          if (viewport) {
            const newScrollHeight = viewport.scrollHeight;
            viewport.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
          }
        }, 0);
      },
      error: (err) => {
        console.error('Failed to load older messages', err);
        this.isLoadingOlder.set(false);
      }
    });
  }

  onScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target) return;

    if (target.scrollTop <= 60 && this.hasMore() && !this.isLoadingOlder()) {
      this.loadOlderMessages();
    }
  }

  private cleanupSubscriptions(): void {
    this.sendStopTyping();
    if (this.unsubscribeTopic) {
      this.unsubscribeTopic();
      this.unsubscribeTopic = undefined;
    }
    if (this.unsubscribeReceipts) {
      this.unsubscribeReceipts();
      this.unsubscribeReceipts = undefined;
    }
    if (this.unsubscribeEdits) {
      this.unsubscribeEdits();
      this.unsubscribeEdits = undefined;
    }
    if (this.unsubscribeDeletes) {
      this.unsubscribeDeletes();
      this.unsubscribeDeletes = undefined;
    }
    if (this.unsubscribeTyping) {
      this.unsubscribeTyping();
      this.unsubscribeTyping = undefined;
    }
    if (this.unsubscribeReadReceipts) {
      this.unsubscribeReadReceipts();
      this.unsubscribeReadReceipts = undefined;
    }
    if (this.unsubscribePresence) {
      this.unsubscribePresence();
      this.unsubscribePresence = undefined;
    }
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = undefined;
    }
    if (this.stopTypingTimer) {
      clearTimeout(this.stopTypingTimer);
      this.stopTypingTimer = undefined;
    }
    if (this.typingSafetyTimer) {
      clearTimeout(this.typingSafetyTimer);
      this.typingSafetyTimer = undefined;
    }
    this.isPeerTyping.set(false);
  }

  private setupPeerPresence(peerId: string): void {
    if (this.unsubscribePresence) {
      this.unsubscribePresence();
      this.unsubscribePresence = undefined;
    }
    const existing = this.conversationService.conversations().find(c => c.participant?.id === peerId);
    if (existing?.participant?.online !== undefined) {
      this.peerOnline.set(existing.participant.online);
    }
    this.unsubscribePresence = this.webSocketService.subscribe<PresenceEventPayload>(
      `/topic/presence/${peerId}`,
      event => {
        if (event && event.userId === peerId) {
          this.peerOnline.set(event.online);
          this.conversationService.updatePresence(peerId, event.online);
          this.contactService.updatePresence(peerId, event.online);
        }
      }
    );
  }

  checkBlockStatus(peerId: string): void {
    if (!peerId) return;
    this.userService.getUserProfile(peerId).subscribe({
      next: (profile) => {
        this.isPeerBlockedByMe.set(profile.connectionStatus === 'BLOCKED');
      },
      error: () => {}
    });
  }

  unblockPeer(): void {
    const peer = this.peerId();
    if (!peer) return;
    this.userService.unblockUser(peer).subscribe({
      next: () => {
        this.isPeerBlockedByMe.set(false);
        this.contactService.loadContacts().subscribe();
      },
      error: () => {}
    });
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.activeActionMessageId()) {
      this.activeActionMessageId.set(null);
    }
  }

  toggleActions(msg: ChatMessageItem, event: MouseEvent): void {
    event.stopPropagation();
    this.activeActionMessageId.update(curr => curr === msg.id ? null : msg.id);
  }

  onContextMenu(msg: ChatMessageItem, event: MouseEvent): void {
    if (msg.deleted) return;
    event.preventDefault();
    event.stopPropagation();
    this.activeActionMessageId.set(msg.id);
  }

  onTouchStart(msg: ChatMessageItem, _event: TouchEvent): void {
    if (msg.deleted) return;
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
    }
    this.touchTimer = setTimeout(() => {
      this.activeActionMessageId.set(msg.id);
    }, 500);
  }

  onTouchEnd(): void {
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = undefined;
    }
  }

  onTouchMove(): void {
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = undefined;
    }
  }

  startEdit(msg: ChatMessageItem): void {
    if (msg.senderId !== this.currentUserId() || msg.deleted || msg.type !== 'TEXT') {
      return;
    }
    this.editingMessage.set(msg);
    this.messageInput.set(msg.content);
    this.activeActionMessageId.set(null);
    setTimeout(() => {
      this.composerTextarea?.nativeElement?.focus();
    }, 0);
  }

  cancelEdit(): void {
    this.editingMessage.set(null);
    this.messageInput.set('');
  }

  openDeleteModal(msg: ChatMessageItem): void {
    this.activeActionMessageId.set(null);
    this.deleteModalMessage.set(msg);
  }

  closeDeleteModal(): void {
    this.deleteModalMessage.set(null);
  }

  confirmDelete(mode: MessageDeleteMode): void {
    const target = this.deleteModalMessage();
    const convId = this.conversationId();
    if (!target || !convId || this.isDeleting()) {
      return;
    }

    this.isDeleting.set(true);
    this.messageService.deleteMessage(convId, target.id, mode).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.closeDeleteModal();
        if (mode === 'FOR_EVERYONE') {
          this.messages.update(list => list.map(m =>
            m.id === target.id ? { ...m, deleted: true, content: '' } : m
          ));
        } else {
          // FOR_ME: completely remove from current user's local view
          this.messages.update(list => list.filter(m => m.id !== target.id));
        }
      },
      error: (err) => {
        console.error('Failed to delete message', err);
        this.isDeleting.set(false);
      }
    });
  }

  onComposerInput(value: string): void {
    this.messageInput.set(value);
    const convId = this.conversationId();
    if (!convId || this.isPeerBlockedByMe()) {
      return;
    }

    if (!value || value.trim().length === 0) {
      this.sendStopTyping();
      return;
    }

    const now = Date.now();
    // Flow B: Throttle typing: true every 2 seconds while typing continues
    if (!this.isActivelyTyping || (now - this.lastTypingSentAt >= 2000)) {
      this.messageService.sendTyping(convId, true);
      this.lastTypingSentAt = now;
      this.isActivelyTyping = true;
    }

    // 3-second debounce to emit typing: false when user pauses
    if (this.stopTypingTimer) {
      clearTimeout(this.stopTypingTimer);
    }
    this.stopTypingTimer = setTimeout(() => {
      this.sendStopTyping();
    }, 3000);
  }

  sendStopTyping(): void {
    if (this.stopTypingTimer) {
      clearTimeout(this.stopTypingTimer);
      this.stopTypingTimer = undefined;
    }
    const convId = this.conversationId();
    if (convId && this.isActivelyTyping) {
      this.isActivelyTyping = false;
      this.messageService.sendTyping(convId, false);
    }
    this.lastTypingSentAt = 0;
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isEditing()) {
      event.preventDefault();
      this.cancelEdit();
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage(): void {
    const content = this.messageInput().trim();
    const convId = this.conversationId();
    if (!content || !convId || this.isPeerBlockedByMe()) {
      return;
    }

    // If currently in edit mode, submit message edit
    if (this.isEditing()) {
      const editTarget = this.editingMessage();
      if (!editTarget) return;

      if (content === editTarget.content) {
        this.cancelEdit();
        return;
      }

      this.isSending.set(true);
      this.messageService.editMessage(convId, editTarget.id, content).subscribe({
        next: (response) => {
          this.messages.update(list => list.map(m =>
            m.id === editTarget.id ? {
              ...m,
              content: response.content,
              edited: true,
              editedAt: response.editedAt
            } : m
          ));
          this.isSending.set(false);
          this.cancelEdit();
        },
        error: (err) => {
          console.error('Failed to edit message', err);
          this.isSending.set(false);
        }
      });
      return;
    }

    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'idem-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);

    // Optimistic UI update: immediately render message with 'SENDING' status
    const optimisticMessage: ChatMessageItem = {
      id: 'temp-' + idempotencyKey,
      conversationId: convId,
      senderId: this.currentUserId(),
      senderName: this.authService.currentUser()?.displayName ?? 'Me',
      type: 'TEXT',
      content,
      deleted: false,
      edited: false,
      createdAt: new Date().toISOString(),
      deliveryStatus: 'SENDING',
      idempotencyKey
    };

    this.messages.update(list => [...list, optimisticMessage]);
    this.messageInput.set('');
    this.sendStopTyping();
    this.scrollToBottom();

    if (this.messageService.isWebSocketConnected()) {
      // Primary STOMP path
      this.messageService.sendMessageStomp(convId, content, idempotencyKey);
    } else {
      // REST fallback path
      this.dispatchRestSend(convId, content, idempotencyKey);
    }
  }

  retryMessage(failedMsg: ChatMessageItem): void {
    if (!failedMsg.idempotencyKey) return;
    this.updateMessageStatus(failedMsg.idempotencyKey, 'SENDING');
    this.dispatchRestSend(this.conversationId(), failedMsg.content, failedMsg.idempotencyKey);
  }

  private dispatchRestSend(convId: string, content: string, idempotencyKey: string): void {
    this.messageService.sendMessageRest(convId, content, idempotencyKey).subscribe({
      next: (response) => {
        this.confirmMessage(idempotencyKey, response);
      },
      error: () => {
        this.updateMessageStatus(idempotencyKey, 'FAILED');
      }
    });
  }

  private handleReceipt(receipt: MessageResponse): void {
    // Replace optimistic placeholder with confirmed server response (status: SENT = single checkmark)
    this.messages.update(list => {
      const idx = list.findIndex(m => m.id === 'temp-' + receipt.id || (m.idempotencyKey && m.content === receipt.content && m.deliveryStatus === 'SENDING'));
      if (idx !== -1) {
        const updated = [...list];
        const currentStatus = updated[idx].deliveryStatus;
        const isRead = (receipt.readBy && receipt.readBy.length > 0) || receipt.deliveryStatus === 'READ';
        const newStatus = isRead ? 'READ' : (currentStatus === 'DELIVERED' || currentStatus === 'READ' ? currentStatus : 'SENT');
        updated[idx] = { ...receipt, deliveryStatus: newStatus };
        return updated;
      }
      return list;
    });

    this.conversationService.updateLastMessage(this.conversationId(), {
      messageId: receipt.id,
      content: receipt.content,
      senderId: receipt.senderId,
      senderDisplayName: receipt.senderName,
      sentAt: receipt.createdAt
    });
  }

  private handleIncomingMessage(incoming: MessageResponse): void {
    const isMe = incoming.senderId === this.currentUserId();
    const isRead = (incoming.readBy && incoming.readBy.length > 0) || incoming.deliveryStatus === 'READ';

    this.messages.update(list => {
      // If already present by server ID (e.g. from receipt)
      const existingIdx = list.findIndex(m => m.id === incoming.id);
      if (existingIdx !== -1) {
        if (isMe) {
          const updated = [...list];
          updated[existingIdx] = {
            ...list[existingIdx],
            ...incoming,
            deliveryStatus: isRead ? 'READ' : 'DELIVERED'
          };
          return updated;
        }
        return list;
      }

      // If matches optimistic message by content and sender
      const pendingIdx = list.findIndex(m =>
        (m.deliveryStatus === 'SENDING' || m.deliveryStatus === 'SENT') &&
        m.senderId === incoming.senderId &&
        m.content === incoming.content
      );
      if (pendingIdx !== -1) {
        const updated = [...list];
        const status = isMe ? (isRead ? 'READ' : 'DELIVERED') : undefined;
        updated[pendingIdx] = { ...incoming, deliveryStatus: status };
        return updated;
      }

      // Incoming message from peer
      return [...list, { ...incoming, deliveryStatus: isMe ? (isRead ? 'READ' : 'DELIVERED') : 'DELIVERED' }];
    });

    if (!isMe) {
      this.isPeerTyping.set(false);
      if (this.typingSafetyTimer) {
        clearTimeout(this.typingSafetyTimer);
        this.typingSafetyTimer = undefined;
      }
      this.messageService.markMessageAsRead(this.conversationId(), incoming.id).subscribe({
        error: () => {}
      });
      this.conversationService.resetUnreadCount(this.conversationId());
    }

    this.conversationService.updateLastMessage(this.conversationId(), {
      messageId: incoming.id,
      content: incoming.content,
      senderId: incoming.senderId,
      senderDisplayName: incoming.senderName,
      sentAt: incoming.createdAt
    });

    this.scrollToBottom();
  }

  private confirmMessage(idempotencyKey: string, serverMsg: MessageResponse): void {
    const isRead = (serverMsg.readBy && serverMsg.readBy.length > 0) || serverMsg.deliveryStatus === 'READ';
    this.messages.update(list => {
      const idx = list.findIndex(m => m.idempotencyKey === idempotencyKey);
      if (idx !== -1) {
        const updated = [...list];
        const currentStatus = updated[idx].deliveryStatus;
        const newStatus = isRead ? 'READ' : (currentStatus === 'DELIVERED' ? 'DELIVERED' : 'SENT');
        updated[idx] = { ...serverMsg, deliveryStatus: newStatus };
        return updated;
      }
      return list;
    });

    this.conversationService.updateLastMessage(this.conversationId(), {
      messageId: serverMsg.id,
      content: serverMsg.content,
      senderId: serverMsg.senderId,
      senderDisplayName: serverMsg.senderName,
      sentAt: serverMsg.createdAt
    });

    this.scrollToBottom();
  }

  handleReadReceipt(event: ReadReceiptEventPayload): void {
    if (!event || !event.messageId) return;
    this.messages.update(list => list.map(m => {
      if (m.id === event.messageId) {
        const readBy = m.readBy ? [...m.readBy] : [];
        if (!readBy.includes(event.userId)) {
          readBy.push(event.userId);
        }
        return {
          ...m,
          readBy,
          deliveryStatus: 'READ'
        };
      }
      return m;
    }));
  }

  private updateMessageStatus(idempotencyKey: string, status: 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED'): void {
    this.messages.update(list => {
      return list.map(m => m.idempotencyKey === idempotencyKey ? { ...m, deliveryStatus: status } : m);
    });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.messagesScrollContainer?.nativeElement) {
        this.messagesScrollContainer.nativeElement.scrollTop =
          this.messagesScrollContainer.nativeElement.scrollHeight;
      }
    }, 50);
  }

  private scrollToBottomIfNearBottom(): void {
    setTimeout(() => {
      const viewport = this.messagesScrollContainer?.nativeElement;
      if (viewport) {
        const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
        if (distanceFromBottom <= 150) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }
    }, 50);
  }

  handleTypingEvent(event: TypingEventPayload): void {
    if (!event || event.userId === this.currentUserId()) {
      return;
    }

    if (event.typing) {
      const wasTyping = this.isPeerTyping();
      this.isPeerTyping.set(true);
      this.typingPeerName.set(event.displayName || this.peerName() || 'Orbit User');

      if (!wasTyping) {
        this.scrollToBottomIfNearBottom();
      }

      // Flow B: 5-second self-clearing safety net independent of explicit false event
      if (this.typingSafetyTimer) {
        clearTimeout(this.typingSafetyTimer);
      }
      this.typingSafetyTimer = setTimeout(() => {
        this.isPeerTyping.set(false);
      }, 5000);
    } else {
      this.isPeerTyping.set(false);
      if (this.typingSafetyTimer) {
        clearTimeout(this.typingSafetyTimer);
        this.typingSafetyTimer = undefined;
      }
    }
  }

  handleEditedMessage(edited: MessageEditedEventPayload): void {
    this.messages.update(list => list.map(m =>
      m.id === edited.messageId ? {
        ...m,
        content: edited.content,
        edited: true,
        editedAt: edited.editedAt
      } : m
    ));
  }

  handleDeletedMessage(deleted: MessageDeletedEventPayload): void {
    this.messages.update(list => list.map(m =>
      m.id === deleted.messageId ? {
        ...m,
        deleted: true,
        content: ''
      } : m
    ));
    if (this.editingMessage()?.id === deleted.messageId) {
      this.cancelEdit();
    }
  }

  formatTime(isoString: string): string {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '';
    }
  }
}
