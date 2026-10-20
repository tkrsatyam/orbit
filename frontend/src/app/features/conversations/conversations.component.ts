import { Component, computed, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NewChatModalComponent } from '../../shared/components/new-chat-modal/new-chat-modal.component';
import { SelfProfileModalComponent } from '../../shared/components/self-profile-modal/self-profile-modal.component';

@Component({
  selector: 'app-conversations',
  standalone: true,
  imports: [RouterLink, SelfProfileModalComponent, NewChatModalComponent],
  templateUrl: './conversations.component.html',
  styleUrl: './conversations.component.scss'
})
export class ConversationsComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);

  readonly isMenuOpen = signal<boolean>(false);
  readonly isProfileOpen = signal<boolean>(false);
  readonly isNewChatOpen = signal<boolean>(false);

  readonly currentUser = computed(() => this.authService.currentUser());

  readonly currentUserName = computed(() => {
    return this.currentUser()?.displayName ?? 'Anonymous User';
  });

  readonly userInitial = computed(() => {
    const name = this.currentUserName();
    return name.trim().charAt(0).toUpperCase() || 'U';
  });

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isMenuOpen.update(v => !v);
  }

  openProfileModal(): void {
    this.isMenuOpen.set(false);
    this.isProfileOpen.set(true);
  }

  openNewChatModal(): void {
    this.isMenuOpen.set(false);
    this.isNewChatOpen.set(true);
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
    if (this.isMenuOpen() && !this.elementRef.nativeElement.contains(event.target)) {
      this.isMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isMenuOpen()) {
      this.isMenuOpen.set(false);
    }
  }
}
