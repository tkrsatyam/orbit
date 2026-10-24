import { Component, computed, ElementRef, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { ContactResponse, IncomingRequest } from '../../core/models/contact.model';
import { AuthService } from '../../core/services/auth.service';
import { ContactService } from '../../core/services/contact.service';
import { GroupResponse, GroupService } from '../../core/services/group.service';
import { UserService } from '../../core/services/user.service';
import { WebSocketService } from '../../core/services/websocket/websocket.service';
import { CreateGroupModalComponent } from '../../shared/components/create-group-modal/create-group-modal.component';
import { NavigationRailComponent } from '../../shared/components/navigation-rail/navigation-rail.component';
import { NewChatModalComponent } from '../../shared/components/new-chat-modal/new-chat-modal.component';
import { SelfProfileModalComponent } from '../../shared/components/self-profile-modal/self-profile-modal.component';
import { parseTopicTags } from '../../shared/utils/tag-utils';

@Component({
  selector: 'app-conversations',
  standalone: true,
  imports: [RouterOutlet, NavigationRailComponent, SelfProfileModalComponent, NewChatModalComponent, CreateGroupModalComponent],
  templateUrl: './conversations.component.html',
  styleUrl: './conversations.component.scss'
})
export class ConversationsComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);
  private readonly userService = inject(UserService);
  readonly contactService = inject(ContactService);
  readonly groupService = inject(GroupService);
  readonly webSocketService = inject(WebSocketService);

  private routerSub?: Subscription;

  readonly isMenuOpen = signal<boolean>(false);
  readonly isProfileOpen = signal<boolean>(false);
  readonly isNewChatOpen = signal<boolean>(false);
  readonly isCreateGroupOpen = signal<boolean>(false);

  // Active navigation rail tab: 'CHATS' | 'GROUPS' | 'CONTACTS' | 'DISCOVER'
  readonly activeNavTab = signal<'CHATS' | 'GROUPS' | 'CONTACTS' | 'DISCOVER'>('CHATS');
  readonly groupFilter = signal<'ALL' | 'PUBLIC' | 'PRIVATE'>('ALL');
  readonly activeGroupId = signal<string | null>(null);
  readonly activeConversationId = signal<string | null>(null);

  readonly activeProcessingId = signal<string | null>(null);
  readonly activeAction = signal<'ACCEPT' | 'DECLINE' | 'BLOCK' | null>(null);

  readonly currentUser = computed(() => this.authService.currentUser());

  readonly currentUserName = computed(() => {
    return this.currentUser()?.displayName ?? 'Anonymous User';
  });

  readonly userInitial = computed(() => {
    const name = this.currentUserName();
    return name.trim().charAt(0).toUpperCase() || 'U';
  });

  readonly filteredGroups = computed(() => {
    const filter = this.groupFilter();
    const groups = this.groupService.myGroups();
    if (filter === 'PUBLIC') {
      return groups.filter(g => g.visibility === 'PUBLIC');
    }
    if (filter === 'PRIVATE') {
      return groups.filter(g => g.visibility === 'PRIVATE');
    }
    return groups;
  });

  ngOnInit(): void {
    this.syncRouteState();
    this.webSocketService.connect();

    this.routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.syncRouteState();
      });

    this.contactService.loadIncomingRequests().subscribe({
      error: () => {
        // Silently handle initial load failure; retryable via reload
      }
    });

    this.contactService.loadContacts().subscribe({
      error: () => {
        // Silently handle initial load failure
      }
    });

    this.groupService.loadMyGroups().subscribe({
      error: () => {
        // Silently handle initial load failure
      }
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  syncRouteState(): void {
    const url = this.router.url;
    if (url.includes('/groups/')) {
      this.activeNavTab.set('GROUPS');
      this.activeConversationId.set(null);
      const parts = url.split('/groups/');
      if (parts[1]) {
        const id = parts[1].split('?')[0].split('/')[0];
        this.activeGroupId.set(id);
      }
    } else if (url.includes('/conversations/')) {
      this.activeNavTab.set('CHATS');
      this.activeGroupId.set(null);
      const parts = url.split('/conversations/');
      if (parts[1]) {
        const id = parts[1].split('?')[0].split('/')[0];
        this.activeConversationId.set(id);
      }
    } else if (url.includes('/invite/')) {
      this.activeNavTab.set('GROUPS');
      this.activeGroupId.set(null);
      this.activeConversationId.set(null);
    } else {
      this.activeGroupId.set(null);
      this.activeConversationId.set(null);
      const urlTree = this.router.parseUrl(url);
      const tabParam = urlTree.queryParams['tab'];
      if (tabParam === 'GROUPS' || tabParam === 'CHATS' || tabParam === 'CONTACTS') {
        this.activeNavTab.set(tabParam);
        if (tabParam === 'CONTACTS') {
          this.openNewChatModal();
        }
      }
    }
  }

  parseTags(raw: string | null | undefined): string[] {
    return parseTopicTags(raw);
  }

  setNavTab(tab: 'CHATS' | 'GROUPS' | 'CONTACTS' | 'DISCOVER'): void {
    if (tab === 'DISCOVER') {
      this.router.navigate(['/discover']);
      return;
    }
    if (tab === 'CONTACTS') {
      this.openNewChatModal();
      return;
    }
    this.activeNavTab.set(tab);
  }

  setGroupFilter(filter: 'ALL' | 'PUBLIC' | 'PRIVATE'): void {
    this.groupFilter.set(filter);
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

  openCreateGroupModal(): void {
    this.isCreateGroupOpen.set(true);
  }

  closeCreateGroupModal(): void {
    this.isCreateGroupOpen.set(false);
  }

  onGroupCreated(group: GroupResponse): void {
    this.activeNavTab.set('GROUPS');
  }

  navigateToGroup(groupId: string): void {
    this.router.navigate(['/groups', groupId]);
  }

  navigateToConversation(contact: ContactResponse): void {
    this.router.navigate(['/conversations', contact.conversationId], {
      queryParams: {
        peerId: contact.userId,
        peerName: contact.displayName
      }
    });
  }

  onSelectConversation(convId: string): void {
    const contact = this.contactService.contacts().find(c => c.conversationId === convId);
    if (contact) {
      this.navigateToConversation(contact);
    } else {
      this.router.navigate(['/conversations', convId]);
    }
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

  handleBlockRequest(request: IncomingRequest): void {
    this.activeProcessingId.set(request.id);
    this.activeAction.set('BLOCK');

    this.userService.blockUser(request.fromUser.id).subscribe({
      next: () => {
        this.activeProcessingId.set(null);
        this.activeAction.set(null);
        this.contactService.loadIncomingRequests().subscribe();
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
    this.webSocketService.disconnect();
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        this.router.navigate(['/login']);
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isMenuOpen()) {
      this.isMenuOpen.set(false);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isMenuOpen() && !this.elementRef.nativeElement.contains(event.target)) {
      this.isMenuOpen.set(false);
    }
  }
}
