import { Component, computed, input, output } from '@angular/core';
import { User } from '../../../core/models/auth.model';

@Component({
  selector: 'app-self-profile-modal',
  standalone: true,
  templateUrl: './self-profile-modal.component.html',
  styleUrl: './self-profile-modal.component.scss'
})
export class SelfProfileModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly user = input<User | null>(null);
  readonly closeModal = output<void>();

  readonly userInitial = computed(() => {
    const name = this.user()?.displayName;
    return name && name.trim().length > 0 ? name.trim().charAt(0).toUpperCase() : 'U';
  });

  readonly formattedJoinedDate = computed(() => {
    const raw = this.user()?.createdAt;
    if (!raw) return 'Recently';
    try {
      const date = new Date(raw);
      if (isNaN(date.getTime())) return 'Recently';
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(date);
    } catch {
      return 'Recently';
    }
  });

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal.emit();
    }
  }
}
