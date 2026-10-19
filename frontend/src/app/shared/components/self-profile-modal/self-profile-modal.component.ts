import { Component, computed, input, output } from '@angular/core';
import { User } from '../../../core/models/auth.model';

@Component({
  selector: 'app-self-profile-modal',
  standalone: true,
  template: `
    @if (isOpen() && user()) {
      <div
        class="modal-backdrop"
        (click)="onBackdropClick($event)"
        (keydown.escape)="closeModal.emit()"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="self-profile-heading"
      >
        <div class="modal-card" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h3 id="self-profile-heading">My Profile</h3>
            <button
              type="button"
              class="close-button"
              aria-label="Close profile modal"
              (click)="closeModal.emit()"
              data-testid="close-profile-btn"
            >
              ✕
            </button>
          </header>

          <div class="profile-body">
            <div class="profile-avatar-wrapper">
              @if (user()?.avatarUrl) {
                <img [src]="user()?.avatarUrl" [alt]="user()?.displayName" class="profile-avatar-img" />
              } @else {
                <div class="profile-avatar-initials" data-testid="self-profile-initials">
                  {{ userInitial() }}
                </div>
              }
            </div>

            <h4 class="profile-name" data-testid="self-profile-name">{{ user()?.displayName }}</h4>
            <p class="profile-email" data-testid="self-profile-email">{{ user()?.email }}</p>

            <div class="profile-section">
              <span class="section-label">Bio</span>
              <p class="section-content" data-testid="self-profile-bio">
                {{ user()?.bio || 'No bio yet. Tell the community about yourself.' }}
              </p>
            </div>

            <div class="profile-section">
              <span class="section-label">Member Since</span>
              <p class="section-content" data-testid="self-profile-joined">
                {{ formattedJoinedDate() }}
              </p>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }

    .modal-card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: var(--shadow);
      width: 100%;
      max-width: 440px;
      overflow: hidden;
      animation: modalFadeIn 0.15s ease-out;
    }

    @keyframes modalFadeIn {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);

      h3 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--text-h);
      }
    }

    .close-button {
      background: none;
      border: none;
      font-size: 1.1rem;
      color: var(--text);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.15s, color 0.15s;

      &:hover {
        background: var(--code-bg);
        color: var(--text-h);
      }
    }

    .profile-body {
      padding: 24px 20px 28px;
      text-align: center;
    }

    .profile-avatar-wrapper {
      margin-bottom: 16px;
      display: flex;
      justify-content: center;
    }

    .profile-avatar-img {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid var(--accent);
    }

    .profile-avatar-initials {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: var(--accent-bg);
      color: var(--accent);
      font-size: 2rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--accent-border);
      text-transform: uppercase;
      user-select: none;
    }

    .profile-name {
      margin: 0 0 4px;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-h);
    }

    .profile-email {
      margin: 0 0 20px;
      font-size: 0.9rem;
      color: var(--text);
    }

    .profile-section {
      text-align: left;
      background: var(--code-bg);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 12px;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .section-label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text);
      margin-bottom: 4px;
    }

    .section-content {
      margin: 0;
      font-size: 0.95rem;
      color: var(--text-h);
      line-height: 1.4;
      word-break: break-word;
    }
  `]
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
