import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SelfProfileModalComponent } from '../../shared/components/self-profile-modal/self-profile-modal.component';

@Component({
  selector: 'app-conversations',
  standalone: true,
  imports: [RouterLink, SelfProfileModalComponent],
  template: `
    <div class="conversations-container">
      <header class="conversations-header">
        <div>
          <h2>Conversations</h2>
          <p class="user-info">
            Signed in as <strong>{{ currentUserName() }}</strong>
          </p>
        </div>
        <div class="header-actions">
          <button
            type="button"
            class="profile-button"
            (click)="isProfileOpen.set(true)"
            data-testid="view-profile-button"
            title="View My Profile"
          >
            <span class="avatar-badge">{{ userInitial() }}</span>
            <span class="profile-label">Profile</span>
          </button>
          <button
            type="button"
            (click)="handleLogout()"
            class="signout-button"
            data-testid="signout-button"
          >
            Sign out
          </button>
        </div>
      </header>

      <section class="conversations-content">
        <p class="placeholder-text">
          This is the authenticated home page. Messages and conversations will be loaded here.
        </p>
        <div class="action-links">
          <a routerLink="/discover" class="btn-primary">
            Discover Groups
          </a>
          <a routerLink="/groups/demo-group" class="btn-secondary">
            Sample Protected Group
          </a>
        </div>
      </section>

      <app-self-profile-modal
        [isOpen]="isProfileOpen()"
        [user]="currentUser()"
        (closeModal)="isProfileOpen.set(false)"
      />
    </div>
  `,
  styles: [`
    .conversations-container {
      max-width: 720px;
      margin: 48px auto;
      padding: 24px;
      text-align: left;
    }
    .conversations-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .user-info {
      color: var(--text);
      margin-top: 4px;
    }
    .header-actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .profile-button {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      cursor: pointer;
      color: var(--text-h);
      font-weight: 500;
      transition: all 0.15s;

      &:hover {
        background: var(--code-bg);
        border-color: var(--accent-border);
      }
    }
    .avatar-badge {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--accent-bg);
      color: var(--accent);
      font-size: 0.8rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      text-transform: uppercase;
    }
    .profile-label {
      font-size: 0.9rem;
    }
    .signout-button {
      padding: 8px 16px;
      background: none;
      border: 1px solid var(--border);
      border-radius: 6px;
      cursor: pointer;
      color: var(--text-h);
      font-weight: 500;
      transition: background 0.2s;
    }
    .signout-button:hover {
      background: var(--code-bg);
    }
    .conversations-content {
      padding: 24px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--code-bg);
    }
    .placeholder-text {
      margin-bottom: 16px;
      color: var(--text);
    }
    .action-links {
      display: flex;
      gap: 12px;
    }
    .btn-primary {
      padding: 8px 16px;
      background: var(--accent);
      color: #fff;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
    }
    .btn-secondary {
      padding: 8px 16px;
      border: 1px solid var(--border);
      color: var(--text-h);
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      background: var(--bg);
    }
  `]
})
export class ConversationsComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isProfileOpen = signal<boolean>(false);
  readonly currentUser = this.authService.currentUser;

  readonly userInitial = computed(() => {
    const name = this.currentUser()?.displayName;
    return name && name.trim().length > 0 ? name.trim().charAt(0).toUpperCase() : 'U';
  });

  currentUserName(): string {
    const user = this.currentUser();
    return user?.displayName || user?.email || user?.id || '';
  }

  handleLogout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        this.router.navigate(['/login']);
      }
    });
  }
}
