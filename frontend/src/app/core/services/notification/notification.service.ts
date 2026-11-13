import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationPayload } from '../../models/notification.model';
import { ConversationService } from '../conversation.service';
import { WebSocketService } from '../websocket/websocket.service';

export interface IncomingMessageNotice {
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  conversationType?: 'DIRECT' | 'GROUP';
  groupName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private readonly router = inject(Router);
  private readonly conversationService = inject(ConversationService);
  private readonly webSocketService = inject(WebSocketService);

  private unsubscribeNotifications?: () => void;

  readonly permission = signal<NotificationPermission>(this.getInitialPermission());
  readonly isBannerDismissed = signal<boolean>(this.getInitialDismissed());

  readonly showPermissionBanner = computed(() => {
    return !this.isBannerDismissed() && this.permission() === 'default';
  });

  constructor() {
    this.init();
  }

  ngOnDestroy(): void {
    if (this.unsubscribeNotifications) {
      this.unsubscribeNotifications();
      this.unsubscribeNotifications = undefined;
    }
  }

  init(): void {
    if (this.unsubscribeNotifications) {
      return;
    }

    this.unsubscribeNotifications = this.webSocketService.subscribe<NotificationPayload>(
      '/user/queue/notifications',
      payload => {
        if (!payload) return;
        if (payload.type === 'UNREAD_COUNT') {
          this.conversationService.setUnreadCount(payload.conversationId, payload.count);
          const exists = this.conversationService.conversations().some(c => c.id === payload.conversationId);
          if (!exists && payload.count > 0) {
            this.conversationService.loadConversations().subscribe({ error: () => {} });
          }
        }
      }
    );
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      this.permission.set('denied');
      return 'denied';
    }

    try {
      const result = await Notification.requestPermission();
      this.permission.set(result);
      return result;
    } catch {
      this.permission.set('denied');
      return 'denied';
    }
  }

  dismissBanner(): void {
    this.isBannerDismissed.set(true);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('orbit_notification_banner_dismissed', 'true');
      } catch {
        // Silently ignore storage quota or sandbox restrictions
      }
    }
  }

  notifyIncomingMessage(message: IncomingMessageNotice): void {
    if (this.permission() !== 'granted') {
      return;
    }

    // Skip notification if the browser window/tab is currently focused and visible (P2-04)
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus()) {
      return;
    }

    const conv = this.conversationService.conversations().find(c => c.id === message.conversationId);
    if (conv?.muted) {
      return;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    const isGroup = message.conversationType === 'GROUP' || conv?.type === 'GROUP';
    const groupTitle = message.groupName || conv?.group?.name || 'Group';
    const title = isGroup ? `#${groupTitle} — ${message.senderName}` : message.senderName;
    const body = (message.content || '').slice(0, 100);

    try {
      const notif = new Notification(title, {
        body,
        icon: 'brand/orbit-icon.svg',
        tag: message.conversationId
      });

      notif.onclick = () => {
        if (typeof window !== 'undefined') {
          window.focus();
        }
        if (isGroup) {
          const gid = conv?.group?.id;
          if (gid) {
            this.router.navigate(['/groups', gid]);
          } else {
            this.router.navigate(['/conversations', message.conversationId]);
          }
        } else {
          this.router.navigate(['/conversations', message.conversationId]);
        }
        notif.close();
      };
    } catch {
      // Ignore notification creation failures in restricted environments
    }
  }

  private getInitialPermission(): NotificationPermission {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      window.Notification &&
      typeof window.Notification.permission === 'string'
    ) {
      return window.Notification.permission;
    }
    return 'denied';
  }

  private getInitialDismissed(): boolean {
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem('orbit_notification_banner_dismissed') === 'true';
      } catch {
        return false;
      }
    }
    return false;
  }
}
