import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (authService.isLoading()) {
      <div class="loading-container">
        <p>Loading...</p>
      </div>
    } @else {
      <div class="discover-container">
        <header class="discover-header">
          <h2>Discover Groups</h2>
          <p class="discover-subtitle">
            Explore public spaces and connect with members on Orbit.
          </p>
        </header>

        <div class="groups-list">
          <div class="group-card">
            <h3>Orbit Community</h3>
            <p class="group-description">
              General discussions, announcements, and project showcase.
            </p>

            @if (authService.isAuthenticated()) {
              <button type="button" class="join-button">
                Join Group
              </button>
            } @else {
              <a routerLink="/register" class="register-link">
                Register to join
              </a>
            }
          </div>
        </div>

        <div class="discover-footer">
          <a routerLink="/" class="back-link">
            &larr; Back to conversations
          </a>
          @if (authService.isAuthenticated()) {
            <span class="member-tag">
              Logged in as {{ currentUserName() }}
            </span>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 50vh;
      color: var(--text);
    }
    .discover-container {
      max-width: 720px;
      margin: 48px auto;
      padding: 24px;
      text-align: left;
    }
    .discover-header {
      margin-bottom: 24px;
    }
    .discover-subtitle {
      color: var(--text);
      margin-top: 4px;
    }
    .groups-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .group-card {
      padding: 20px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg);
    }
    .group-card h3 {
      margin: 0;
      color: var(--text-h);
      font-size: 18px;
    }
    .group-description {
      margin: 8px 0 16px;
      color: var(--text);
      font-size: 15px;
    }
    .join-button {
      padding: 8px 16px;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      font-size: 14px;
    }
    .register-link {
      display: inline-block;
      padding: 8px 16px;
      background: var(--accent);
      color: #fff;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      font-size: 14px;
    }
    .discover-footer {
      margin-top: 32px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .back-link {
      color: var(--accent);
      text-decoration: none;
      font-size: 15px;
    }
    .member-tag {
      font-size: 14px;
      color: var(--text);
    }
  `]
})
export class DiscoverComponent {
  readonly authService = inject(AuthService);

  currentUserName(): string {
    const user = this.authService.currentUser();
    return user?.displayName || user?.email || user?.id || '';
  }
}
