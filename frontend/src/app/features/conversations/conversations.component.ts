import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-conversations',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="conversations-container">
      <header class="conversations-header">
        <div>
          <h2>Conversations</h2>
          <p class="user-info">
            Signed in as <strong>{{ currentUserName() }}</strong>
          </p>
        </div>
        <button
          type="button"
          (click)="handleLogout()"
          class="signout-button"
        >
          Sign out
        </button>
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

  currentUserName(): string {
    const user = this.authService.currentUser();
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
