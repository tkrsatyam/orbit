import { Component, computed, ElementRef, HostListener, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IncomingRequest } from '../../core/models/contact.model';
import { AuthService } from '../../core/services/auth.service';
import { ContactService } from '../../core/services/contact.service';
import { NewChatModalComponent } from '../../shared/components/new-chat-modal/new-chat-modal.component';
import { SelfProfileModalComponent } from '../../shared/components/self-profile-modal/self-profile-modal.component';

@Component({
  selector: 'app-conversations',
  standalone: true,
  imports: [RouterLink, SelfProfileModalComponent, NewChatModalComponent],
  templateUrl: './conversations.component.html',
  styleUrl: './conversations.component.scss'
})
export class ConversationsComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);
  readonly contactService = inject(ContactService);

  readonly isMenuOpen = signal<boolean>(false);
  readonly isProfileOpen = signal<boolean>(false);
  readonly isNewChatOpen = signal<boolean>(false);

  readonly activeProcessingId = signal<string | null>(null);
  readonly activeAction = signal<'ACCEPT' | 'DECLINE' | null>(null);

  readonly currentUser = computed(() => this.authService.currentUser());

  readonly currentUserName = computed(() => {
    return this.currentUser()?.displayName ?? 'Anonymous User';
  });

  readonly userInitial = computed(() => {
    const name = this.currentUserName();
    return name.trim().charAt(0).toUpperCase() || 'U';
  });

  ngOnInit(): void {
    this.contactService.loadIncomingRequests().subscribe({
      error: () => {
        // Silently handle initial load failure; retryable via reload
      }
    });
  }

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

  handleAcceptRequest(request: IncomingRequest): void {
    this.activeProcessingId.set(request.id);
    this.activeAction.set('ACCEPT');

    this.contactService.respondToRequest(request.id, 'ACCEPT').subscribe({
      next: () => {
        this.activeProcessingId.set(null);
        this.activeAction.set(null);
      },
      error: () => {
        this.activeProcessingId.set(null);
        this.activeAction.set(null);
      }
    });
  }

  handleDeclineRequest(request: IncomingRequest): void {
    this.activeProcessingId.set(request.id);
    this.activeAction.set('DECLINE');

    this.contactService.respondToRequest(request.id, 'DECLINE').subscribe({
      next: () => {
        this.activeProcessingId.set(null);
        this.activeAction.set(null);
      },
      error: () => {
        this.activeProcessingId.set(null);
        this.activeAction.set(null);
      }
    });
  }

  isProcessingRequest(requestId: string): boolean {
    return this.activeProcessingId() === requestId;
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
