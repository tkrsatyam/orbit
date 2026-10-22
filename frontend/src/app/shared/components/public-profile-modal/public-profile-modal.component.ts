import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserProfile, ConnectionStatus } from '../../../core/models/user.model';
import { UserService } from '../../../core/services/user.service';
import { ContactService } from '../../../core/services/contact.service';
import { AuthService } from '../../../core/services/auth.service';
import { getMaskedDisplayName, isProfileAvailable } from '../../utils/profile-mask.utils';

@Component({
  selector: 'app-public-profile-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './public-profile-modal.component.html',
  styleUrl: './public-profile-modal.component.scss'
})
export class PublicProfileModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly userId = input<string | null>(null);

  readonly closeModal = output<void>();
  readonly connectionChanged = output<void>();

  private readonly userService = inject(UserService);
  private readonly contactService = inject(ContactService);
  private readonly authService = inject(AuthService);

  readonly profile = signal<UserProfile | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly actionLoading = signal<boolean>(false);
  readonly actionMessage = signal<string | null>(null);
  readonly confirmAction = signal<'BLOCK' | 'UNBLOCK' | 'REMOVE' | null>(null);

  readonly isAvailable = computed(() => isProfileAvailable(this.profile()));

  readonly maskedName = computed(() => getMaskedDisplayName(this.profile()));

  readonly avatarInitial = computed(() => {
    const name = this.maskedName();
    return name && name.trim().length > 0 ? name.trim().charAt(0).toUpperCase() : 'U';
  });

  readonly connectionStatus = computed<ConnectionStatus>(() => {
    return this.profile()?.connectionStatus || 'NONE';
  });

  readonly isSelf = computed(() => {
    const current = this.authService.currentUser();
    const id = this.userId();
    return !!current && !!id && current.id === id;
  });

  constructor() {
    effect(
      () => {
        const open = this.isOpen();
        const id = this.userId();
        if (open && id) {
          this.loadProfile(id);
        } else if (!open) {
          this.resetState();
        }
      }
    );
  }

  loadProfile(id: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.actionMessage.set(null);
    this.confirmAction.set(null);

    this.userService.getUserProfile(id).subscribe({
      next: data => {
        this.profile.set(data);
        this.isLoading.set(false);
      },
      error: err => {
        this.isLoading.set(false);
        if (err.status === 404) {
          this.errorMessage.set('User account not found.');
        } else {
          this.errorMessage.set('Failed to load profile. Please try again.');
        }
      }
    });
  }

  resetState(): void {
    this.profile.set(null);
    this.isLoading.set(false);
    this.errorMessage.set(null);
    this.actionLoading.set(false);
    this.actionMessage.set(null);
    this.confirmAction.set(null);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal.emit();
    }
  }

  sendConnectionRequest(): void {
    const id = this.userId();
    if (!id || this.actionLoading()) return;

    this.actionLoading.set(true);
    this.actionMessage.set(null);

    this.contactService.sendConnectionRequest(id).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.actionMessage.set('Connection request sent.');
        this.profile.update(p => (p ? { ...p, connectionStatus: 'PENDING_SENT' } : null));
        this.connectionChanged.emit();
      },
      error: err => {
        this.actionLoading.set(false);
        if (err.status === 409) {
          this.actionMessage.set('Request already sent or already connected.');
          this.profile.update(p => (p ? { ...p, connectionStatus: 'PENDING_SENT' } : null));
        } else {
          this.actionMessage.set('Could not send connection request.');
        }
      }
    });
  }

  openConfirm(action: 'BLOCK' | 'UNBLOCK' | 'REMOVE'): void {
    this.confirmAction.set(action);
  }

  cancelConfirm(): void {
    this.confirmAction.set(null);
  }

  executeConfirm(): void {
    const action = this.confirmAction();
    const id = this.userId();
    if (!action || !id || this.actionLoading()) return;

    this.actionLoading.set(true);

    if (action === 'BLOCK') {
      this.userService.blockUser(id).subscribe({
        next: () => {
          this.actionLoading.set(false);
          this.confirmAction.set(null);
          this.actionMessage.set('User blocked.');
          this.profile.update(p => (p ? { ...p, connectionStatus: 'BLOCKED' } : null));
          this.connectionChanged.emit();
        },
        error: () => {
          this.actionLoading.set(false);
          this.actionMessage.set('Failed to block user.');
        }
      });
    } else if (action === 'UNBLOCK') {
      this.userService.unblockUser(id).subscribe({
        next: () => {
          this.actionLoading.set(false);
          this.confirmAction.set(null);
          this.actionMessage.set('User unblocked.');
          this.profile.update(p => (p ? { ...p, connectionStatus: 'NONE' } : null));
          this.connectionChanged.emit();
        },
        error: () => {
          this.actionLoading.set(false);
          this.actionMessage.set('Failed to unblock user.');
        }
      });
    } else if (action === 'REMOVE') {
      this.contactService.removeContact(id).subscribe({
        next: () => {
          this.actionLoading.set(false);
          this.confirmAction.set(null);
          this.actionMessage.set('Contact removed.');
          this.profile.update(p => (p ? { ...p, connectionStatus: 'NONE' } : null));
          this.connectionChanged.emit();
        },
        error: () => {
          this.actionLoading.set(false);
          this.actionMessage.set('Failed to remove contact.');
        }
      });
    }
  }
}
