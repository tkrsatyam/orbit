import { Component, computed, ElementRef, HostListener, inject, signal } from '@angular/core';
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
        <div class="header-brand-title">
          <div class="orbit-badge" aria-hidden="true">
            <span>⬡</span>
          </div>
          <div>
            <h2>Conversations</h2>
            <p class="user-info">
              Signed in as <strong>{{ currentUserName() }}</strong>
            </p>
          </div>
        </div>

        <div class="user-menu-container">
          <button
            type="button"
            class="avatar-badge-btn"
            (click)="toggleMenu($event)"
            [attr.aria-expanded]="isMenuOpen()"
            aria-haspopup="true"
            data-testid="user-avatar-badge"
            [attr.title]="currentUserName()"
          >
            {{ userInitial() }}
          </button>

          @if (isMenuOpen()) {
            <div
              class="user-dropdown-menu"
              role="menu"
              data-testid="user-dropdown-menu"
              (click)="$event.stopPropagation()"
            >
              <div class="menu-user-header">
                <span class="menu-user-name">{{ currentUserName() }}</span>
                @if (currentUser()?.email) {
                  <span class="menu-user-email">{{ currentUser()?.email }}</span>
                }
              </div>
              <div class="dropdown-separator"></div>

              <button
                type="button"
                class="dropdown-menu-item profile-item"
                role="menuitem"
                (click)="openProfileModal()"
                data-testid="menu-my-profile-btn"
              >
                <svg
                  class="menu-icon profile-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>My profile</span>
              </button>

              <div class="dropdown-separator"></div>

              <button
                type="button"
                class="dropdown-menu-item signout-item"
                role="menuitem"
                (click)="handleLogout()"
                data-testid="signout-button"
              >
                <svg
                  class="menu-icon signout-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Sign out</span>
              </button>
            </div>
          }
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
      max-width: 820px;
      margin: 40px auto;
      padding: 24px;
      text-align: left;
      width: 100%;
      box-sizing: border-box;
    }
    .conversations-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 18px;
      border-bottom: 1px solid var(--orbit-border);
    }
    .header-brand-title {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .orbit-badge {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #2a2015;
      border: 1px solid var(--orbit-accent);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--orbit-accent);
      font-size: 1.25rem;
    }
    .user-info {
      color: var(--orbit-text-muted);
      margin-top: 4px;
      font-size: 0.9rem;

      strong {
        color: var(--orbit-text-primary);
      }
    }
    .user-menu-container {
      position: relative;
    }
    .avatar-badge-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--orbit-elevated);
      color: var(--orbit-accent);
      border: 1.5px solid var(--orbit-accent);
      font-size: 1rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      text-transform: uppercase;
      transition: all 0.15s ease-in-out;

      &:hover {
        transform: scale(1.05);
        border-color: var(--orbit-accent);
        box-shadow: 0 0 0 3px var(--orbit-accent-subtle);
      }
    }
    .user-dropdown-menu {
      position: absolute;
      right: 0;
      top: calc(100% + 8px);
      background: var(--orbit-surface);
      border: 1.5px solid var(--orbit-border);
      border-radius: 10px;
      box-shadow: var(--shadow);
      min-width: 210px;
      padding: 8px 6px;
      z-index: 100;
      animation: dropdownFade 0.12s ease-out;
    }
    @keyframes dropdownFade {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .menu-user-header {
      padding: 6px 10px 4px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .menu-user-name {
      font-size: 13px;
      font-weight: 700;
      color: var(--orbit-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .menu-user-email {
      font-size: 11px;
      color: var(--orbit-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .dropdown-separator {
      height: 1px;
      background: var(--orbit-border);
      margin: 6px 4px;
    }
    .dropdown-menu-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 8px 10px;
      background: none;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: var(--orbit-text-primary);
      text-align: left;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;

      &:hover {
        background: var(--orbit-elevated);
      }
    }
    .menu-icon {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }
    .profile-icon {
      color: var(--orbit-accent);
    }
    .signout-item {
      color: var(--orbit-danger);

      &:hover {
        background: var(--orbit-danger-subtle);
        color: var(--orbit-danger);
      }
    }
    .signout-icon {
      color: var(--orbit-danger);
    }
    .conversations-content {
      padding: 24px;
      border: 1px solid var(--orbit-border);
      border-radius: 12px;
      background: var(--orbit-surface);
    }
    .placeholder-text {
      margin-bottom: 20px;
      color: var(--orbit-text-muted);
      line-height: 1.5;
    }
    .action-links {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .btn-primary {
      padding: 9px 18px;
      background: var(--orbit-accent);
      color: #121214;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      transition: opacity 0.15s;

      &:hover {
        opacity: 0.9;
      }
    }
    .btn-secondary {
      padding: 9px 18px;
      border: 1px solid var(--orbit-border);
      color: var(--orbit-text-primary);
      border-radius: 8px;
      text-decoration: none;
      font-weight: 500;
      font-size: 14px;
      background: var(--orbit-elevated);
      transition: background 0.15s, border-color 0.15s;

      &:hover {
        background: var(--orbit-surface);
        border-color: var(--orbit-accent);
      }
    }
  `]
})
export class ConversationsComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);

  readonly isMenuOpen = signal<boolean>(false);
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

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isMenuOpen.update((open) => !open);
  }

  openProfileModal(): void {
    this.isMenuOpen.set(false);
    this.isProfileOpen.set(true);
  }

  handleLogout(): void {
    this.isMenuOpen.set(false);
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        this.router.navigate(['/login']);
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.isMenuOpen.set(false);
  }
}
