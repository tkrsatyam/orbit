import { Component, EventEmitter, HostListener, inject, Input, OnChanges, OnInit, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ContactService } from '../../../core/services/contact.service';
import { UserService } from '../../../core/services/user.service';
import { SuggestedUser } from '../../../core/models/user.model';

@Component({
  selector: 'app-new-chat-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './new-chat-modal.component.html',
  styleUrl: './new-chat-modal.component.scss'
})
export class NewChatModalComponent implements OnInit, OnChanges {
  readonly contactService = inject(ContactService);
  private readonly userService = inject(UserService);

  @Input({ required: true }) isOpen: boolean = false;
  @Output() closeModal = new EventEmitter<void>();

  directTargetUserId = signal<string>('');
  isConnecting = signal<boolean>(false);
  activeTargetId = signal<string | null>(null);
  activeRespondingId = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  readonly suggestedUsers = signal<SuggestedUser[]>([]);
  readonly isLoadingSuggestions = signal<boolean>(false);

  ngOnInit(): void {
    if (this.isOpen) {
      this.refreshData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.refreshData();
    }
  }

  private refreshData(): void {
    this.contactService.loadIncomingRequests().subscribe({
      error: () => {
        // Non-blocking initial fetch
      }
    });
    this.loadSuggestedUsers();
  }

  loadSuggestedUsers(): void {
    this.isLoadingSuggestions.set(true);
    this.userService.getSuggestedUsers().subscribe({
      next: (users) => {
        this.suggestedUsers.set(users);
        this.isLoadingSuggestions.set(false);
      },
      error: () => {
        this.suggestedUsers.set([]);
        this.isLoadingSuggestions.set(false);
      }
    });
  }

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

  isResponding(requestId: string): boolean {
    return this.activeRespondingId() === requestId;
  }

  connectDirect(): void {
    const targetId = this.directTargetUserId().trim();
    if (!targetId) {
      this.errorMessage.set('Please enter a target user ID');
      return;
    }
    this.executeConnect(targetId);
  }

  connectToUser(user: SuggestedUser): void {
    this.executeConnect(user.id, user.displayName);
  }

  respondToIncoming(requestId: string, action: 'ACCEPT' | 'DECLINE'): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.activeRespondingId.set(requestId);

    this.contactService.respondToRequest(requestId, action).subscribe({
      next: () => {
        this.activeRespondingId.set(null);
        if (action === 'ACCEPT') {
          this.successMessage.set('Connection request accepted.');
        } else {
          this.successMessage.set('Connection request declined.');
        }
      },
      error: err => {
        this.activeRespondingId.set(null);
        const msg = err.error?.message || `Failed to ${action.toLowerCase()} request.`;
        this.errorMessage.set(msg);
      }
    });
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
