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
        <div>
          <h2>Conversations</h2>
          <p class="user-info">
            Signed in as <strong>{{ currentUserName() }}</strong>
          </p>
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
              <button
                type="button"
                class="dropdown-menu-item"
                role="menuitem"
                (click)="openProfileModal()"
                data-testid="menu-my-profile-btn"
              >
                <span class="menu-icon">👤</span>
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
                <span class="menu-icon">🚪</span>
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
    .user-menu-container {
      position: relative;
    }
    .avatar-badge-btn {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: var(--accent-bg);
      color: var(--accent);
      border: 2px solid var(--accent-border);
      font-size: 1.15rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      text-transform: uppercase;
      transition: all 0.15s ease-in-out;

      &:hover {
        transform: scale(1.05);
        border-color: var(--accent);
        box-shadow: 0 0 0 3px var(--accent-bg);
      }
    }
    .user-dropdown-menu {
      position: absolute;
      right: 0;
      top: calc(100% + 8px);
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      box-shadow: var(--shadow);
      min-width: 170px;
      padding: 6px;
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
    .dropdown-menu-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 9px 12px;
      background: none;
      border: none;
      border-radius: 6px;
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--text-h);
      text-align: left;
      cursor: pointer;
      transition: background 0.15s;

      &:hover {
        background: var(--code-bg);
      }
    }
    .menu-icon {
      font-size: 1rem;
      line-height: 1;
    }
    .dropdown-separator {
      height: 1px;
      background: var(--border);
      margin: 4px 0;
    }
    .signout-item {
      color: #dc2626;

      &:hover {
        background: rgba(220, 38, 38, 0.08);
      }
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
