import { Component, EventEmitter, HostListener, inject, Input, OnChanges, OnInit, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ContactResponse } from '../../../core/models/contact.model';
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
  @Output() selectConversation = new EventEmitter<string>();

  readonly activeTab = signal<'contacts' | 'connect'>('contacts');
  private userExplicitlySelectedTab = false;

  directTargetUserId = signal<string>('');
  isConnecting = signal<boolean>(false);
  activeTargetId = signal<string | null>(null);
  activeRespondingId = signal<string | null>(null);
  confirmingRemoveId = signal<string | null>(null);
  isRemovingContact = signal<boolean>(false);
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
    this.contactService.loadContacts().subscribe({
      next: (res) => {
        if ((!res.content || res.content.length === 0) && !this.userExplicitlySelectedTab) {
          this.activeTab.set('connect');
        }
      },
      error: () => {
        if (!this.userExplicitlySelectedTab) {
          this.activeTab.set('connect');
        }
      }
    });

    this.contactService.loadIncomingRequests().subscribe({
      error: () => {
        // Non-blocking initial fetch
      }
    });

    this.loadSuggestedUsers();
  }

  setActiveTab(tab: 'contacts' | 'connect'): void {
    this.userExplicitlySelectedTab = true;
    this.activeTab.set(tab);
    this.errorMessage.set(null);
    this.successMessage.set(null);
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

  messageContact(contact: ContactResponse): void {
    this.selectConversation.emit(contact.conversationId);
    this.closeModal.emit();
  }

  promptRemoveContact(contactId: string): void {
    this.confirmingRemoveId.set(contactId);
  }

  cancelRemoveContact(): void {
    this.confirmingRemoveId.set(null);
  }

  confirmRemoveContact(contact: ContactResponse): void {
    this.isRemovingContact.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.contactService.removeContact(contact.id).subscribe({
      next: () => {
        this.isRemovingContact.set(false);
        this.confirmingRemoveId.set(null);
        this.successMessage.set(`Removed ${contact.displayName} from your contacts.`);
      },
      error: (err) => {
        this.isRemovingContact.set(false);
        this.confirmingRemoveId.set(null);
        const msg = err.error?.message || 'Failed to remove contact.';
        this.errorMessage.set(msg);
      }
    });
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
          this.contactService.loadContacts().subscribe();
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
