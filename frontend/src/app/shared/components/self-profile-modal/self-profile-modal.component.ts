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
          <div class="drag-handle-mobile" aria-hidden="true"></div>
          <div class="amber-top-stripe" aria-hidden="true"></div>

          <header class="modal-header">
            <h3 id="self-profile-heading">My Profile</h3>
            <button
              type="button"
              class="close-button"
              aria-label="Close profile modal"
              (click)="closeModal.emit()"
              data-testid="close-profile-btn"
            >
              <svg
                class="close-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </header>

          <div class="avatar-row">
            <div class="avatar-ring">
              @if (user()?.avatarUrl) {
                <img [src]="user()?.avatarUrl" [alt]="user()?.displayName" class="profile-avatar-img" />
              } @else {
                <div class="profile-avatar-initials" data-testid="self-profile-initials">
                  {{ userInitial() }}
                </div>
              }
            </div>
          </div>

          <div class="identity-section">
            <h4 class="profile-name" data-testid="self-profile-name">{{ user()?.displayName }}</h4>
            <p class="profile-email" data-testid="self-profile-email">{{ user()?.email }}</p>
          </div>

          <div class="profile-bio-card">
            <span class="section-label">Bio</span>
            <p class="section-content" data-testid="self-profile-bio">
              {{ user()?.bio || 'No bio yet. Tell the community about yourself.' }}
            </p>
          </div>

          <div class="profile-meta-card">
            <span class="meta-label">Member Since</span>
            <p class="meta-val" data-testid="self-profile-joined">{{ formattedJoinedDate() }}</p>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(10, 10, 12, 0.72);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
      animation: backdropFadeIn 0.15s ease-out;
    }

    @keyframes backdropFadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .modal-card {
      background: var(--orbit-surface);
      border: 1.5px solid var(--orbit-border);
      border-radius: 16px;
      box-shadow: 0 20px 40px -8px rgba(0, 0, 0, 0.7);
      width: 100%;
      max-width: 480px;
      overflow: hidden;
      position: relative;
      animation: modalSlideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes modalSlideUp {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .drag-handle-mobile {
      display: none;
    }

    .amber-top-stripe {
      height: 3px;
      width: 100%;
      background: var(--orbit-accent);
    }

    .modal-header {
      background: var(--orbit-elevated);
      height: 84px;
      padding: 18px 24px;
      box-sizing: border-box;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;

      h3 {
        margin: 0;
        font-size: 17px;
        font-weight: 600;
        color: var(--orbit-text-primary);
        letter-spacing: -0.01em;
      }
    }

    .close-button {
      background: rgba(24, 24, 27, 0.6);
      border: 1px solid var(--orbit-border);
      width: 32px;
      height: 32px;
      border-radius: 50%;
      color: var(--orbit-text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: all 0.15s ease-in-out;

      &:hover {
        background: var(--orbit-surface);
        border-color: var(--orbit-accent);
        color: var(--orbit-text-primary);
      }
    }

    .close-icon {
      width: 16px;
      height: 16px;
    }

    .avatar-row {
      padding: 0 24px;
      margin-top: -40px;
      display: flex;
      align-items: flex-end;
    }

    .avatar-ring {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: #2a2015;
      border: 2.5px solid var(--orbit-accent);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .profile-avatar-img {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      object-fit: cover;
    }

    .profile-avatar-initials {
      font-size: 26px;
      font-weight: 700;
      color: var(--orbit-accent);
      text-transform: uppercase;
      user-select: none;
    }

    .identity-section {
      padding: 14px 24px 0;
      text-align: left;
    }

    .profile-name {
      margin: 0 0 2px;
      font-size: 20px;
      font-weight: 700;
      color: var(--orbit-text-primary);
      letter-spacing: -0.01em;
    }

    .profile-email {
      margin: 0 0 16px;
      font-size: 13px;
      color: var(--orbit-text-muted);
    }

    .profile-bio-card {
      margin: 0 24px 14px;
      text-align: left;
      background: #202024;
      border: 1px solid var(--orbit-border);
      border-radius: 8px;
      padding: 12px 14px;
    }

    .section-label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--orbit-text-muted);
      margin-bottom: 6px;
    }

    .section-content {
      margin: 0;
      font-size: 13px;
      line-height: 1.45;
      color: var(--orbit-text-primary);
      word-break: break-word;
    }

    .profile-meta-card {
      margin: 0 24px 28px;
      background: #202024;
      border: 1px solid var(--orbit-border);
      border-radius: 8px;
      padding: 12px 14px;
      text-align: left;
    }

    .meta-label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--orbit-text-muted);
      margin-bottom: 4px;
    }

    .meta-val {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--orbit-text-primary);
    }

    @media (max-width: 640px) {
      .modal-backdrop {
        align-items: flex-end;
        padding: 0;
      }

      .modal-card {
        border-radius: 24px 24px 0 0;
        border-bottom: none;
        max-height: 90vh;
        overflow-y: auto;
      }

      .drag-handle-mobile {
        display: block;
        width: 40px;
        height: 4px;
        background: #3f3f46;
        border-radius: 2px;
        margin: 10px auto 4px;
      }
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
