import { Component, computed, DestroyRef, ElementRef, HostListener, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { bufferTime, filter } from 'rxjs/operators';
import { GroupMemberResponse, GroupResponse, GroupService } from '../../core/services/group.service';
import { AuthService } from '../../core/services/auth.service';
import { parseTopicTags } from '../../shared/utils/tag-utils';
import { PublicProfileModalComponent } from '../../shared/components/public-profile-modal/public-profile-modal.component';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { MessageActionsBarComponent } from '../../shared/components/message-actions-bar/message-actions-bar.component';
import { ComposerEditingBannerComponent } from '../../shared/components/composer-editing-banner/composer-editing-banner.component';
import { DeleteMessageModalComponent } from '../../shared/components/delete-message-modal/delete-message-modal.component';
import { TypingIndicatorComponent } from '../../shared/components/typing-indicator/typing-indicator.component';
import {
  ChatMessageItem,
  MessageDeleteMode,
  MessageDeletedEventPayload,
  MessageEditedEventPayload,
  MessageResponse,
  PresenceEventPayload,
  TypingEventPayload
} from '../../core/models/message.model';
import { MessageService } from '../../core/services/message/message.service';
import { ConversationService } from '../../core/services/conversation.service';
import { WebSocketService } from '../../core/services/websocket/websocket.service';

@Component({
  selector: 'app-group',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    FormsModule,
    PublicProfileModalComponent,
    AvatarComponent,
    MessageActionsBarComponent,
    ComposerEditingBannerComponent,
    DeleteMessageModalComponent,
    TypingIndicatorComponent
  ],
  templateUrl: './group.component.html',
  styleUrl: './group.component.scss'
})
export class GroupComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly groupService = inject(GroupService);
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly conversationService = inject(ConversationService);
  private readonly webSocketService = inject(WebSocketService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly incomingReadSubject = new Subject<string>();

  @ViewChild('messagesScroll') private messagesScrollContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('composerTextarea') private composerTextarea?: ElementRef<HTMLTextAreaElement>;

  readonly group = signal<GroupResponse | null>(null);
  readonly loading = signal<boolean>(true);
  readonly errorMessage = signal<string | null>(null);

  // Group messaging state
  readonly messages = signal<ChatMessageItem[]>([]);
  readonly messageInput = signal<string>('');
  readonly isSending = signal<boolean>(false);
  readonly hasMore = signal<boolean>(false);
  readonly nextCursor = signal<string | null>(null);
  readonly isLoadingOlder = signal<boolean>(false);
  readonly isLoadingInitial = signal<boolean>(false);
  readonly activeConversationId = signal<string | null>(null);

  // Message actions & editing (ORDM-54)
  readonly activeActionMessageId = signal<string | null>(null);
  readonly editingMessage = signal<ChatMessageItem | null>(null);
  readonly isEditing = computed(() => this.editingMessage() !== null);
  readonly deleteModalMessage = signal<ChatMessageItem | null>(null);
  readonly isDeletingMessage = signal<boolean>(false);

  // Typing indicator state (ORDM-55)
  private isActivelyTyping = false;
  private lastTypingSentAt = 0;
  private stopTypingTimer?: any;
  private readonly typingSafetyTimers = new Map<string, any>();
  readonly typingUsers = signal<Map<string, string>>(new Map());
  readonly typingIndicatorText = computed(() => {
    const users = Array.from(this.typingUsers().values());
    if (users.length === 0) return null;
    if (users.length === 1) return `${users[0]} is typing...`;
    if (users.length === 2) return `${users[0]} and ${users[1]} are typing...`;
    return `${users.length} people are typing...`;
  });

  // Real-time group subscriptions
  private unsubscribeTopic?: () => void;
  private unsubscribeReceipts?: () => void;
  private unsubscribeEdits?: () => void;
  private unsubscribeDeletes?: () => void;
  private unsubscribeTyping?: () => void;
  private readonly memberPresenceUnsubs = new Map<string, () => void>();

  readonly isEditModalOpen = signal<boolean>(false);
  readonly isSubmittingEdit = signal<boolean>(false);
  readonly editError = signal<string | null>(null);

  readonly inviteLink = signal<string | null>(null);
  readonly inviteCopied = signal<boolean>(false);

  // Member roster state
  readonly isMembersDrawerOpen = signal<boolean>(false);
  readonly members = signal<GroupMemberResponse[]>([]);
  readonly loadingMembers = signal<boolean>(false);
  readonly memberActionError = signal<string | null>(null);
  readonly updatingMemberId = signal<string | null>(null);
  readonly removingMemberId = signal<string | null>(null);
  readonly isRemoveMemberModalOpen = signal<boolean>(false);
  readonly memberToRemove = signal<GroupMemberResponse | null>(null);
  readonly currentUserId = computed(() => this.authService.currentUser()?.id);

  // Leave space state
  readonly isLeaveModalOpen = signal<boolean>(false);
  readonly isLeaving = signal<boolean>(false);
  readonly leaveError = signal<string | null>(null);

  // Delete space state
  readonly isDeleteSpaceModalOpen = signal<boolean>(false);
  readonly isDeletingSpace = signal<boolean>(false);
  readonly deleteSpaceError = signal<string | null>(null);

  // Public profile viewer state
  readonly selectedProfileUserId = signal<string | null>(null);
  readonly isProfileModalOpen = signal<boolean>(false);

  readonly editForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    topicTag: ['', [Validators.maxLength(50)]],
    description: ['', [Validators.maxLength(500)]]
  });

  readonly groupId = signal<string>('');
  readonly isAdmin = computed(() => this.group()?.role === 'ADMIN');
  readonly myGroups = computed(() => this.groupService.myGroups());
  readonly topicTags = computed(() => parseTopicTags(this.group()?.topicTag));
  readonly onlineMemberCount = computed(() => this.members().filter(m => m.online).length);

  readonly leaveWarningMessage = computed(() => {
    const isAdm = this.isAdmin();
    const count = this.group()?.memberCount ?? 1;

    if (count <= 1) {
      return 'You are the last remaining member. If you leave, this space and its entire conversation history will be permanently deleted.';
    }

    if (isAdm) {
      return 'As you are departing, admin privileges will automatically be transferred to the longest-standing member. You will lose access to this space.';
    }

    return 'You will lose access to this space and its messages. To rejoin later, you will need a new invite link from an admin.';
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const id = params.get('id');
        if (id) {
          this.groupId.set(id);
          this.loadGroupDetails(id);
        } else {
          this.errorMessage.set('Group ID is missing');
          this.loading.set(false);
        }
      });

    this.groupService.loadMyGroups()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => {
          // Silently handle
        }
      });

    // Buffer read receipts in 500ms windows to prevent high-volume network storms
    this.incomingReadSubject.pipe(
      bufferTime(500),
      filter(ids => ids.length > 0),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(ids => {
      const convId = this.activeConversationId();
      if (!convId || (typeof document !== 'undefined' && !document.hasFocus())) return;
      const uniqueIds = Array.from(new Set(ids));
      this.messageService.markMessagesAsRead(convId, uniqueIds).subscribe({
        error: () => {}
      });
      this.conversationService.resetUnreadCount(convId);
    });
  }

  ngOnDestroy(): void {
    this.cleanupMessaging();
  }

  loadGroupDetails(id: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.groupService.getGroupDetails(id).subscribe({
      next: (details) => {
        this.group.set(details);
        this.loading.set(false);
        if (details.conversationId) {
          this.activeConversationId.set(details.conversationId);
          this.setupGroupMessaging(details.conversationId);
        }
        this.loadMembers();
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err.error?.message || 'Failed to load group details';
        this.errorMessage.set(msg);
      }
    });
  }

  private setupGroupMessaging(conversationId: string): void {
    this.cleanupMessaging();
    this.messages.set([]);
    this.hasMore.set(false);
    this.nextCursor.set(null);
    this.isLoadingOlder.set(false);

    this.loadInitialHistory(conversationId);

    this.unsubscribeTopic = this.messageService.subscribeToConversation(conversationId, (incoming: MessageResponse) => {
      this.handleIncomingMessage(incoming);
    });

    this.unsubscribeReceipts = this.messageService.subscribeToReceipts((receipt: MessageResponse) => {
      this.handleReceipt(receipt);
    });

    this.unsubscribeEdits = this.messageService.subscribeToEdits(conversationId, (edited: MessageEditedEventPayload) => {
      this.handleMessageEdited(edited);
    });

    this.unsubscribeDeletes = this.messageService.subscribeToDeletes(conversationId, (deleted: MessageDeletedEventPayload) => {
      this.handleMessageDeleted(deleted);
    });

    this.unsubscribeTyping = this.messageService.subscribeToTyping(conversationId, (event: TypingEventPayload) => {
      this.handleIncomingTyping(event);
    });

    this.conversationService.resetUnreadCount(conversationId);
  }

  private cleanupMessaging(): void {
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
    for (const timer of this.typingSafetyTimers.values()) {
      clearTimeout(timer);
    }
    this.typingSafetyTimers.clear();
    this.typingUsers.set(new Map());
    this.sendStopTyping();

    for (const unsub of this.memberPresenceUnsubs.values()) {
      unsub();
    }
    this.memberPresenceUnsubs.clear();
  }

  loadInitialHistory(conversationId: string): void {
    this.isLoadingInitial.set(true);
    this.messageService.getConversationMessages(conversationId).subscribe({
      next: (history) => {
        if (this.activeConversationId() !== conversationId) return;

        const currentUid = this.authService.currentUser()?.id;
        const items: ChatMessageItem[] = history.content.map(m => ({
          ...m,
          deliveryStatus: m.senderId === currentUid ? (m.deliveryStatus ?? 'DELIVERED') : undefined
        }));

        this.messages.set(items);
        this.hasMore.set(history.hasMore);
        this.nextCursor.set(history.nextCursor ?? null);
        this.isLoadingInitial.set(false);
        this.scrollToBottom();

        // Mark unread incoming messages as read in bulk
        const unreadIncoming = history.content.filter(
          m => m.senderId !== currentUid && (!m.readBy || !m.readBy.includes(currentUid || ''))
        );
        if (unreadIncoming.length > 0) {
          const unreadIds = unreadIncoming.map(m => m.id);
          this.messageService.markMessagesAsRead(conversationId, unreadIds).subscribe({
            error: () => {}
          });
        }
        this.conversationService.resetUnreadCount(conversationId);
      },
      error: (err) => {
        console.error('Failed to load group conversation history', err);
        this.isLoadingInitial.set(false);
      }
    });
  }

  loadOlderMessages(): void {
    const convId = this.activeConversationId();
    const cursor = this.nextCursor();
    if (!convId || !cursor || this.isLoadingOlder() || !this.hasMore()) {
      return;
    }

    const viewport = this.messagesScrollContainer?.nativeElement;
    const previousScrollHeight = viewport ? viewport.scrollHeight : 0;
    const previousScrollTop = viewport ? viewport.scrollTop : 0;

    this.isLoadingOlder.set(true);
    this.messageService.getConversationMessages(convId, 50, cursor).subscribe({
      next: (history) => {
        if (this.activeConversationId() !== convId) return;

        const currentUid = this.authService.currentUser()?.id;
        const olderItems: ChatMessageItem[] = history.content.map(m => ({
          ...m,
          deliveryStatus: m.senderId === currentUid ? (m.deliveryStatus ?? 'DELIVERED') : undefined
        }));

        this.messages.update(current => [...olderItems, ...current]);
        this.hasMore.set(history.hasMore);
        this.nextCursor.set(history.nextCursor ?? null);
        this.isLoadingOlder.set(false);

        // Anchor scroll position
        setTimeout(() => {
          if (viewport) {
            const newScrollHeight = viewport.scrollHeight;
            viewport.scrollTop = newScrollHeight - previousScrollHeight + previousScrollTop;
          }
        }, 0);
      },
      error: (err) => {
        console.error('Failed to load older group messages', err);
        this.isLoadingOlder.set(false);
      }
    });
  }

  sendMessage(): void {
    const text = this.messageInput().trim();
    const convId = this.activeConversationId();
    if (!text || !convId || this.isSending()) {
      return;
    }

    // If currently editing, submit message edit
    if (this.isEditing()) {
      const editTarget = this.editingMessage();
      if (!editTarget) return;

      if (text === editTarget.content) {
        this.cancelEdit();
        return;
      }

      this.isSending.set(true);
      this.messageService.editMessage(convId, editTarget.id, text).subscribe({
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
          console.error('Failed to edit group message', err);
          this.isSending.set(false);
        }
      });
      this.sendStopTyping();
      return;
    }

    const idempotencyKey = crypto.randomUUID();
    const currentUid = this.authService.currentUser()?.id || '';
    const currentUserName = this.authService.currentUser()?.displayName || 'Orbit User';

    const optimisticMessage: ChatMessageItem = {
      id: 'temp-' + idempotencyKey,
      conversationId: convId,
      senderId: currentUid,
      senderName: currentUserName,
      type: 'TEXT',
      content: text,
      deleted: false,
      edited: false,
      createdAt: new Date().toISOString(),
      deliveryStatus: 'SENDING',
      idempotencyKey
    };

    this.messages.update(current => [...current, optimisticMessage]);
    this.messageInput.set('');
    this.sendStopTyping();
    this.scrollToBottom();

    if (this.messageService.isWebSocketConnected()) {
      this.messageService.sendMessageStomp(convId, text, idempotencyKey);
    } else {
      this.dispatchRestSend(convId, text, idempotencyKey);
    }
  }

  onComposerInput(value: string): void {
    this.messageInput.set(value);
    const convId = this.activeConversationId();
    if (!convId) return;

    if (!value || value.trim().length === 0) {
      this.sendStopTyping();
      return;
    }

    const now = Date.now();
    // 2-second interval throttle for typing: true
    if (!this.isActivelyTyping || (now - this.lastTypingSentAt >= 2000)) {
      this.messageService.sendTyping(convId, true);
      this.lastTypingSentAt = now;
      this.isActivelyTyping = true;
    }

    // 3-second debounce to send typing: false
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
    const convId = this.activeConversationId();
    if (convId && this.isActivelyTyping) {
      this.isActivelyTyping = false;
      this.messageService.sendTyping(convId, false);
    }
    this.lastTypingSentAt = 0;
  }

  toggleActions(msg: ChatMessageItem, event: Event): void {
    event.stopPropagation();
    if (this.activeActionMessageId() === msg.id) {
      this.activeActionMessageId.set(null);
    } else {
      this.activeActionMessageId.set(msg.id);
    }
  }

  onContextMenu(msg: ChatMessageItem, event: MouseEvent): void {
    if (msg.deleted) return;
    event.preventDefault();
    event.stopPropagation();
    this.activeActionMessageId.set(msg.id);
  }

  startEdit(msg: ChatMessageItem): void {
    if (msg.deleted || msg.type !== 'TEXT') return;
    this.editingMessage.set(msg);
    this.messageInput.set(msg.content);
    this.activeActionMessageId.set(null);
    setTimeout(() => {
      this.composerTextarea?.nativeElement?.focus();
    }, 50);
  }

  cancelEdit(): void {
    this.editingMessage.set(null);
    this.messageInput.set('');
    this.sendStopTyping();
  }

  openDeleteModal(msg: ChatMessageItem): void {
    this.deleteModalMessage.set(msg);
    this.activeActionMessageId.set(null);
  }

  closeDeleteModal(): void {
    this.deleteModalMessage.set(null);
  }

  confirmDeleteMessage(mode: MessageDeleteMode): void {
    const target = this.deleteModalMessage();
    const convId = this.activeConversationId();
    if (!target || !convId || this.isDeletingMessage()) return;

    this.isDeletingMessage.set(true);
    this.messageService.deleteMessage(convId, target.id, mode).subscribe({
      next: () => {
        this.isDeletingMessage.set(false);
        this.closeDeleteModal();
        if (mode === 'FOR_EVERYONE') {
          this.messages.update(list => list.map(m =>
            m.id === target.id ? { ...m, deleted: true, content: '' } : m
          ));
        } else {
          this.messages.update(list => list.filter(m => m.id !== target.id));
        }
      },
      error: (err) => {
        console.error('Failed to delete group message', err);
        this.isDeletingMessage.set(false);
      }
    });
  }

  private dispatchRestSend(convId: string, content: string, idempotencyKey: string): void {
    this.isSending.set(true);
    this.messageService.sendMessageRest(convId, content, idempotencyKey).subscribe({
      next: (response: MessageResponse) => {
        this.isSending.set(false);
        this.messages.update(current =>
          current.map(m => (m.id === 'temp-' + idempotencyKey || m.idempotencyKey === idempotencyKey ? { ...response, deliveryStatus: 'SENT' } : m))
        );
      },
      error: () => {
        this.isSending.set(false);
        this.messages.update(current =>
          current.map(m => (m.id === 'temp-' + idempotencyKey ? { ...m, deliveryStatus: 'FAILED' } : m))
        );
      }
    });
  }

  private handleIncomingMessage(incoming: MessageResponse): void {
    const currentUid = this.authService.currentUser()?.id;

    // Avoid duplicate if already exists
    const exists = this.messages().some(m => m.id === incoming.id);
    if (exists) {
      this.messages.update(current =>
        current.map(m => m.id === incoming.id ? { ...m, ...incoming } : m)
      );
      return;
    }

    // Match by idempotencyKey first to prevent collisions from rapid identical messages, with content/sender fallback
    const optimisticIndex = this.messages().findIndex(
      m => (incoming.idempotencyKey && m.idempotencyKey === incoming.idempotencyKey) ||
           (m.deliveryStatus === 'SENDING' && m.senderId === incoming.senderId && m.content === incoming.content)
    );
    if (optimisticIndex !== -1) {
      this.messages.update(current => {
        const copy = [...current];
        copy[optimisticIndex] = { ...incoming, deliveryStatus: 'DELIVERED' };
        return copy;
      });
    } else {
      const item: ChatMessageItem = {
        ...incoming,
        deliveryStatus: incoming.senderId === currentUid ? 'DELIVERED' : undefined
      };
      this.messages.update(current => [...current, item]);
    }

    this.scrollToBottom();

    // Buffer read receipt for incoming message if from another member and window has focus
    if (incoming.senderId !== currentUid && typeof document !== 'undefined' && document.hasFocus()) {
      this.incomingReadSubject.next(incoming.id);
    }
  }

  private handleReceipt(receipt: MessageResponse): void {
    if (receipt.conversationId !== this.activeConversationId()) return;

    this.messages.update(current =>
      current.map(m => {
        if (m.id === receipt.id || (m.idempotencyKey && m.content === receipt.content)) {
          return { ...m, ...receipt, deliveryStatus: 'SENT' };
        }
        return m;
      })
    );
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

  private handleMessageEdited(edited: MessageEditedEventPayload): void {
    this.messages.update(list => list.map(m =>
      m.id === edited.messageId ? { ...m, content: edited.content, edited: true, editedAt: edited.editedAt } : m
    ));
  }

  private handleMessageDeleted(deleted: MessageDeletedEventPayload): void {
    this.messages.update(list => list.map(m =>
      m.id === deleted.messageId ? { ...m, deleted: true, content: '' } : m
    ));
  }

  private handleIncomingTyping(event: TypingEventPayload): void {
    const currentUid = this.authService.currentUser()?.id;
    if (!event || event.userId === currentUid) return;

    if (event.typing) {
      const existingTimer = this.typingSafetyTimers.get(event.userId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      const timer = setTimeout(() => {
        this.typingUsers.update(map => {
          const copy = new Map(map);
          copy.delete(event.userId);
          return copy;
        });
        this.typingSafetyTimers.delete(event.userId);
      }, 5000);
      this.typingSafetyTimers.set(event.userId, timer);

      this.typingUsers.update(map => {
        const copy = new Map(map);
        copy.set(event.userId, event.displayName || 'Member');
        return copy;
      });
    } else {
      const existingTimer = this.typingSafetyTimers.get(event.userId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.typingSafetyTimers.delete(event.userId);
      }
      this.typingUsers.update(map => {
        const copy = new Map(map);
        copy.delete(event.userId);
        return copy;
      });
    }
  }

  onScroll(): void {
    const el = this.messagesScrollContainer?.nativeElement;
    if (!el) return;
    if (el.scrollTop < 60 && this.hasMore() && !this.isLoadingOlder()) {
      this.loadOlderMessages();
    }
  }

  scrollToBottom(): void {
    setTimeout(() => {
      const el = this.messagesScrollContainer?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 0);
  }

  isGroupAdmin(userId: string): boolean {
    return this.members().some(m => m.userId === userId && m.role === 'ADMIN');
  }

  formatTime(isoString?: string | null): string {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '';
    }
  }

  navigateBack(): void {
    this.router.navigate(['/']);
  }

  openEditModal(): void {
    const g = this.group();
    if (!g) return;

    this.editForm.patchValue({
      name: g.name,
      topicTag: g.topicTag ? g.topicTag.replace(/^#/, '') : '',
      description: g.description || ''
    });
    this.editError.set(null);
    this.isEditModalOpen.set(true);
  }

  closeEditModal(): void {
    this.isEditModalOpen.set(false);
    this.editError.set(null);
  }

  submitEdit(): void {
    if (this.editForm.invalid || this.isSubmittingEdit()) {
      this.editForm.markAllAsTouched();
      return;
    }

    const g = this.group();
    if (!g) return;

    this.isSubmittingEdit.set(true);
    this.editError.set(null);

    const val = this.editForm.value;
    let topic = val.topicTag ? val.topicTag.trim() : null;
    if (topic && !topic.startsWith('#')) {
      topic = '#' + topic;
    }

    this.groupService.updateGroup(g.id, {
      name: val.name.trim(),
      topicTag: topic,
      description: val.description ? val.description.trim() : null
    }).subscribe({
      next: (updated) => {
        this.group.set(updated);
        this.isSubmittingEdit.set(false);
        this.closeEditModal();
      },
      error: (err) => {
        this.isSubmittingEdit.set(false);
        const msg = err.error?.message || 'Failed to update group';
        this.editError.set(msg);
      }
    });
  }

  generateInviteLink(): void {
    const g = this.group();
    if (!g) return;

    this.groupService.generateInvite(g.id).subscribe({
      next: (res) => {
        this.inviteLink.set(res.inviteLink);
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(res.inviteLink);
          this.inviteCopied.set(true);
          setTimeout(() => this.inviteCopied.set(false), 3000);
        }
      },
      error: (err) => {
        const msg = err.error?.message || 'Failed to generate invite';
        this.errorMessage.set(msg);
      }
    });
  }

  toggleMembersDrawer(): void {
    const nextState = !this.isMembersDrawerOpen();
    this.isMembersDrawerOpen.set(nextState);
    if (nextState) {
      this.loadMembers();
    }
  }

  openMemberProfile(member: GroupMemberResponse): void {
    this.selectedProfileUserId.set(member.userId);
    this.isProfileModalOpen.set(true);
  }

  closeProfileModal(): void {
    this.isProfileModalOpen.set(false);
    this.selectedProfileUserId.set(null);
  }

  loadMembers(): void {
    const gid = this.groupId();
    if (!gid) return;

    this.loadingMembers.set(true);
    this.memberActionError.set(null);
    this.groupService.getGroupMembers(gid).subscribe({
      next: (res) => {
        this.members.set(res.content);
        this.setupMemberPresence(res.content);
        this.loadingMembers.set(false);
      },
      error: (err) => {
        this.loadingMembers.set(false);
        const msg = err.error?.message || 'Failed to load group members';
        this.memberActionError.set(msg);
      }
    });
  }

  private setupMemberPresence(memberList: GroupMemberResponse[]): void {
    const currentMemberIds = new Set(memberList.map(m => m.userId));
    for (const [userId, unsub] of this.memberPresenceUnsubs.entries()) {
      if (!currentMemberIds.has(userId)) {
        unsub();
        this.memberPresenceUnsubs.delete(userId);
      }
    }

    for (const member of memberList) {
      if (!this.memberPresenceUnsubs.has(member.userId)) {
        const unsub = this.webSocketService.subscribe<PresenceEventPayload>(
          `/topic/presence/${member.userId}`,
          (presence) => {
            if (presence && presence.userId === member.userId) {
              this.members.update(list =>
                list.map(m => m.userId === member.userId ? { ...m, online: presence.online } : m)
              );
            }
          }
        );
        this.memberPresenceUnsubs.set(member.userId, unsub);
      }
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.activeActionMessageId()) {
      this.activeActionMessageId.set(null);
    }
  }

  toggleMemberRole(targetMember: GroupMemberResponse): void {
    const gid = this.groupId();
    if (!gid || this.updatingMemberId()) return;

    const newRole = targetMember.role === 'ADMIN' ? 'MEMBER' : 'ADMIN';
    this.updatingMemberId.set(targetMember.userId);
    this.memberActionError.set(null);

    this.groupService.updateMemberRole(gid, targetMember.userId, { role: newRole }).subscribe({
      next: (updatedMember) => {
        this.members.update((list) =>
          list.map((m) => (m.userId === updatedMember.userId ? updatedMember : m))
        );
        this.updatingMemberId.set(null);
      },
      error: (err) => {
        this.updatingMemberId.set(null);
        const msg = err.error?.message || 'Failed to update member role';
        this.memberActionError.set(msg);
      }
    });
  }

  openLeaveModal(): void {
    this.leaveError.set(null);
    this.isLeaveModalOpen.set(true);
  }

  closeLeaveModal(): void {
    this.isLeaveModalOpen.set(false);
    this.leaveError.set(null);
  }

  confirmLeaveGroup(): void {
    const gid = this.groupId();
    if (!gid || this.isLeaving()) return;

    this.isLeaving.set(true);
    this.leaveError.set(null);

    this.groupService.leaveGroup(gid).subscribe({
      next: () => {
        this.isLeaving.set(false);
        this.closeLeaveModal();
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isLeaving.set(false);
        const msg = err.error?.message || 'Failed to leave space';
        this.leaveError.set(msg);
      }
    });
  }

  openRemoveMemberModal(member: GroupMemberResponse): void {
    this.memberToRemove.set(member);
    this.isRemoveMemberModalOpen.set(true);
  }

  closeRemoveMemberModal(): void {
    this.memberToRemove.set(null);
    this.isRemoveMemberModalOpen.set(false);
  }

  confirmRemoveMember(): void {
    const m = this.memberToRemove();
    if (m) {
      this.removeMember(m);
      this.closeRemoveMemberModal();
    }
  }

  removeMember(targetMember: GroupMemberResponse): void {
    const gid = this.groupId();
    if (!gid || this.removingMemberId()) return;

    this.removingMemberId.set(targetMember.userId);
    this.memberActionError.set(null);

    this.groupService.removeMember(gid, targetMember.userId).subscribe({
      next: () => {
        this.members.update((list) => list.filter((m) => m.userId !== targetMember.userId));
        this.group.update((g) => (g ? { ...g, memberCount: Math.max(0, g.memberCount - 1) } : null));
        this.removingMemberId.set(null);
      },
      error: (err) => {
        this.removingMemberId.set(null);
        const msg = err.error?.message || 'Failed to remove member';
        this.memberActionError.set(msg);
      }
    });
  }

  openDeleteSpaceModal(): void {
    this.deleteSpaceError.set(null);
    this.isDeleteSpaceModalOpen.set(true);
  }

  closeDeleteSpaceModal(): void {
    this.isDeleteSpaceModalOpen.set(false);
    this.deleteSpaceError.set(null);
  }

  confirmDeleteSpace(): void {
    const gid = this.groupId();
    if (!gid || this.isDeletingSpace()) return;

    this.isDeletingSpace.set(true);
    this.deleteSpaceError.set(null);

    this.groupService.deleteGroup(gid).subscribe({
      next: () => {
        this.isDeletingSpace.set(false);
        this.closeDeleteSpaceModal();
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isDeletingSpace.set(false);
        const msg = err.error?.message || 'Failed to delete space';
        this.deleteSpaceError.set(msg);
      }
    });
  }
}
