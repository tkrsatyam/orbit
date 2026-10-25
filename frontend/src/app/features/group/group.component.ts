import { Component, computed, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { GroupMemberResponse, GroupResponse, GroupService } from '../../core/services/group.service';
import { AuthService } from '../../core/services/auth.service';
import { parseTopicTags } from '../../shared/utils/tag-utils';
import { PublicProfileModalComponent } from '../../shared/components/public-profile-modal/public-profile-modal.component';
import { ChatMessageItem, MessageResponse } from '../../core/models/message.model';
import { MessageService } from '../../core/services/message/message.service';
import { ConversationService } from '../../core/services/conversation.service';

@Component({
  selector: 'app-group',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, FormsModule, PublicProfileModalComponent],
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
  private readonly fb = inject(FormBuilder);

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

  private unsubscribeTopic?: () => void;
  private unsubscribeReceipts?: () => void;

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
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.groupId.set(id);
        this.loadGroupDetails(id);
      } else {
        this.errorMessage.set('Group ID is missing');
        this.loading.set(false);
      }
    });

    this.groupService.loadMyGroups().subscribe({
      error: () => {
        // Silently handle
      }
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

        // Mark unread incoming messages as read
        const unreadIncoming = history.content.filter(
          m => m.senderId !== currentUid && (!m.readBy || !m.readBy.includes(currentUid || ''))
        );
        for (const msg of unreadIncoming) {
          this.messageService.markMessageAsRead(conversationId, msg.id).subscribe({
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
    this.scrollToBottom();

    if (this.messageService.isWebSocketConnected()) {
      this.messageService.sendMessageStomp(convId, text, idempotencyKey);
    } else {
      this.dispatchRestSend(convId, text, idempotencyKey);
    }
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

    // If this matches an optimistic message by content/sender, replace it
    const optimisticIndex = this.messages().findIndex(
      m => m.deliveryStatus === 'SENDING' && m.senderId === incoming.senderId && m.content === incoming.content
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

    // If message from someone else, mark as read
    const convId = this.activeConversationId();
    if (convId && incoming.senderId !== currentUid) {
      this.messageService.markMessageAsRead(convId, incoming.id).subscribe({
        error: () => {}
      });
      this.conversationService.resetUnreadCount(convId);
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
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
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
        this.loadingMembers.set(false);
      },
      error: (err) => {
        this.loadingMembers.set(false);
        const msg = err.error?.message || 'Failed to load group members';
        this.memberActionError.set(msg);
      }
    });
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
