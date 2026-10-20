import { Component, EventEmitter, HostListener, inject, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ContactService } from '../../../core/services/contact.service';

export interface DiscoverUserItem {
  id: string;
  displayName: string;
  bio: string;
  initials: string;
}

@Component({
  selector: 'app-new-chat-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './new-chat-modal.component.html',
  styleUrl: './new-chat-modal.component.scss'
})
export class NewChatModalComponent {
  private readonly contactService = inject(ContactService);

  @Input({ required: true }) isOpen: boolean = false;
  @Output() closeModal = new EventEmitter<void>();

  directTargetUserId = signal<string>('');
  isConnecting = signal<boolean>(false);
  activeTargetId = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  /**
   * Suggested community members for direct connection from Penpot Desktop at x: 10540, y: 800.
   */
  readonly suggestedUsers: DiscoverUserItem[] = [
    {
      id: 'vikram-k-id',
      displayName: 'Vikram K',
      bio: 'Java 25 & Spring Boot enthusiast • Preparing for senior roles',
      initials: 'VK'
    },
    {
      id: 'rohan-mehta-id',
      displayName: 'Rohan Mehta',
      bio: 'Cloud architect & DevOps • AWS, Docker, Kubernetes',
      initials: 'RM'
    },
    {
      id: 'sneha-kapoor-id',
      displayName: 'Sneha Kapoor',
      bio: 'Career switcher from fintech • Angular & TypeScript builder',
      initials: 'SK'
    },
    {
      id: 'tanmay-gupta-id',
      displayName: 'Tanmay Gupta',
      bio: 'DSA problem solver • 300+ LeetCode problems completed',
      initials: 'TG'
    }
  ];

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.closeModal.emit();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeModal.emit();
    }
  }

  isRequestPending(userId: string): boolean {
    return this.contactService.hasPendingRequest(userId);
  }

  connectDirect(): void {
    const targetId = this.directTargetUserId().trim();
    if (!targetId) {
      this.errorMessage.set('Please enter a target user ID');
      return;
    }
    this.executeConnect(targetId);
  }

  connectToUser(user: DiscoverUserItem): void {
    this.executeConnect(user.id, user.displayName);
  }

  private executeConnect(targetUserId: string, displayName?: string): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isConnecting.set(true);
    this.activeTargetId.set(targetUserId);

    this.contactService.sendConnectionRequest(targetUserId).subscribe({
      next: res => {
        this.isConnecting.set(false);
        this.activeTargetId.set(null);
        const name = displayName || res.toUser.displayName || targetUserId;
        this.successMessage.set(`Connection request sent to ${name}.`);
        if (this.directTargetUserId().trim() === targetUserId) {
          this.directTargetUserId.set('');
        }
      },
      error: err => {
        this.isConnecting.set(false);
        this.activeTargetId.set(null);
        const msg = err.error?.message || 'Failed to send connection request. Please check user ID.';
        this.errorMessage.set(msg);
      }
    });
  }
}
