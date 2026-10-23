import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatMessageItem, MessageResponse } from '../../../core/models/message.model';
import { AuthService } from '../../../core/services/auth.service';
import { ContactService } from '../../../core/services/contact.service';
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
  private readonly userService = inject(UserService);
  readonly webSocketService = inject(WebSocketService);

  @ViewChild('messagesScroll') private messagesScrollContainer?: ElementRef<HTMLDivElement>;

  readonly conversationId = signal<string>('');
  readonly peerId = signal<string>('');
  readonly peerName = signal<string>('Orbit User');
  readonly peerInitial = computed(() => this.peerName().trim().charAt(0).toUpperCase() || 'U');
  readonly peerOnline = signal<boolean>(false);

  readonly messageInput = signal<string>('');
  readonly messages = signal<ChatMessageItem[]>([]);
  readonly isSending = signal<boolean>(false);

  readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? '');

  /**
   * Block status per ADR 007 Decision 5:
   * Composer is disabled client-side when viewing a conversation where the active user blocked the peer.
   */
  readonly isPeerBlockedByMe = signal<boolean>(false);

  private unsubscribeTopic?: () => void;
  private unsubscribeReceipts?: () => void;
  private routeSub?: Subscription;

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const id = params.get('id') || '';
      if (id && id !== this.conversationId()) {
        this.conversationId.set(id);
        this.setupConversation(id);
      }
    });

    this.route.queryParamMap.subscribe(queryParams => {
      const pName = queryParams.get('peerName');
      const pId = queryParams.get('peerId');
      if (pName) this.peerName.set(pName);
      if (pId) {
        this.peerId.set(pId);
        this.checkBlockStatus(pId);
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.cleanupSubscriptions();
  }

  private setupConversation(id: string): void {
    this.cleanupSubscriptions();

    // Subscribe to incoming messages on this conversation topic
    this.unsubscribeTopic = this.messageService.subscribeToConversation(id, (incoming: MessageResponse) => {
      this.handleIncomingMessage(incoming);
    });

    // Subscribe to direct send receipts
    this.unsubscribeReceipts = this.messageService.subscribeToReceipts((receipt: MessageResponse) => {
      this.handleReceipt(receipt);
    });
  }

  private cleanupSubscriptions(): void {
    if (this.unsubscribeTopic) {
      this.unsubscribeTopic();
      this.unsubscribeTopic = undefined;
    }
    if (this.unsubscribeReceipts) {
      this.unsubscribeReceipts();
      this.unsubscribeReceipts = undefined;
    }
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

  onKeydown(event: KeyboardEvent): void {
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
        // If already promoted to DELIVERED by topic event, keep DELIVERED, otherwise set SENT
        const currentStatus = updated[idx].deliveryStatus;
        const newStatus = currentStatus === 'DELIVERED' ? 'DELIVERED' : 'SENT';
        updated[idx] = { ...receipt, deliveryStatus: newStatus };
        return updated;
      }
      return list;
    });
  }

  private handleIncomingMessage(incoming: MessageResponse): void {
    this.messages.update(list => {
      // If already present by server ID (e.g. from receipt)
      const existingIdx = list.findIndex(m => m.id === incoming.id);
      if (existingIdx !== -1) {
        if (list[existingIdx].senderId === this.currentUserId()) {
          const updated = [...list];
          updated[existingIdx] = { ...list[existingIdx], deliveryStatus: 'DELIVERED' };
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
        const status = incoming.senderId === this.currentUserId() ? 'DELIVERED' : 'SENT';
        updated[pendingIdx] = { ...incoming, deliveryStatus: status };
        return updated;
      }

      // Incoming message from peer
      return [...list, { ...incoming, deliveryStatus: 'DELIVERED' }];
    });
    this.scrollToBottom();
  }

  private confirmMessage(idempotencyKey: string, serverMsg: MessageResponse): void {
    this.messages.update(list => {
      const idx = list.findIndex(m => m.idempotencyKey === idempotencyKey);
      if (idx !== -1) {
        const updated = [...list];
        const currentStatus = updated[idx].deliveryStatus;
        const newStatus = currentStatus === 'DELIVERED' ? 'DELIVERED' : 'SENT';
        updated[idx] = { ...serverMsg, deliveryStatus: newStatus };
        return updated;
      }
      return list;
    });
    this.scrollToBottom();
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
