import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { GroupResponse, GroupService } from '../../core/services/group.service';
import { CreateGroupModalComponent } from '../../shared/components/create-group-modal/create-group-modal.component';
import { SelfProfileModalComponent } from '../../shared/components/self-profile-modal/self-profile-modal.component';
import { parseTopicTags } from '../../shared/utils/tag-utils';

export interface TopicFilter {
  id: string;
  label: string;
  tag?: string;
}

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CreateGroupModalComponent,
    SelfProfileModalComponent
  ],
  templateUrl: './discover.component.html',
  styleUrl: './discover.component.scss'
})
export class DiscoverComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly groupService = inject(GroupService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);

  readonly searchInputValue = signal<string>('');
  readonly activeSearchQuery = signal<string>('');
  readonly selectedTag = signal<string>('all');
  readonly groups = signal<GroupResponse[]>([]);
  readonly allDiscoveredGroups = signal<GroupResponse[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly joiningGroupId = signal<string | null>(null);
  readonly isCreateModalOpen = signal<boolean>(false);
  readonly isProfileOpen = signal<boolean>(false);
  readonly isMenuOpen = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly isFiltered = computed(() => this.activeSearchQuery().trim().length > 0);

  readonly currentUser = computed(() => this.authService.currentUser());

  readonly currentUserName = computed(() => {
    return this.currentUser()?.displayName ?? this.currentUser()?.email ?? 'Anonymous User';
  });

  readonly userInitial = computed(() => {
    const name = this.currentUserName();
    return name.trim().charAt(0).toUpperCase() || 'U';
  });

  // Dynamically computed topic filter chips extracted from all available public spaces
  readonly topicFilters = computed<TopicFilter[]>(() => {
    const list = this.allDiscoveredGroups();
    const tagCountMap = new Map<string, number>();

    for (const group of list) {
      const tags = parseTopicTags(group.topicTag);
      for (const t of tags) {
        const clean = t.trim().replace(/^#/, '').toLowerCase();
        if (clean) {
          tagCountMap.set(clean, (tagCountMap.get(clean) || 0) + 1);
        }
      }
    }

    const dynamicTags: TopicFilter[] = Array.from(tagCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cleanTag]) => ({
        id: cleanTag,
        label: `#${cleanTag}`,
        tag: cleanTag
      }));

    return [{ id: 'all', label: 'All Topics' }, ...dynamicTags];
  });

  ngOnInit(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.groupService.discoverGroups({ page: 0, size: 100 }).subscribe({
      next: (response) => {
        this.allDiscoveredGroups.set(response.content);
        this.groups.set(response.content);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load public spaces');
        this.isLoading.set(false);
      }
    });
  }

  loadGroups(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const query = this.activeSearchQuery().trim();
    const tag = this.selectedTag() === 'all' ? undefined : this.selectedTag();

    this.groupService.discoverGroups({ q: query, tag, page: 0, size: 50 }).subscribe({
      next: (response) => {
        this.groups.set(response.content);
        if (!query && (!tag || tag === 'all')) {
          this.allDiscoveredGroups.set(response.content);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load public spaces');
        this.isLoading.set(false);
      }
    });
  }

  executeSearch(): void {
    const query = this.searchInputValue().trim();
    this.activeSearchQuery.set(query);
    this.loadGroups();
  }

  clearSearch(): void {
    this.searchInputValue.set('');
    this.activeSearchQuery.set('');
    this.loadGroups();
  }

  selectTag(tagId: string): void {
    this.selectedTag.set(tagId);
    this.loadGroups();
  }

  navigateTab(tab: 'CHATS' | 'GROUPS' | 'CONTACTS' | 'DISCOVER'): void {
    if (tab === 'DISCOVER') {
      return;
    }
    this.router.navigate(['/'], { queryParams: { tab } });
  }

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isMenuOpen.update((v) => !v);
  }

  openProfileModal(): void {
    this.isMenuOpen.set(false);
    this.isProfileOpen.set(true);
  }

  handleLogout(): void {
    this.isMenuOpen.set(false);
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login'])
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

  joinGroup(group: GroupResponse, event?: Event): void {
    event?.stopPropagation();

    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    if (group.role) {
      this.openSpace(group);
      return;
    }

    this.joiningGroupId.set(group.id);
    this.errorMessage.set(null);

    this.groupService.joinPublicGroup(group.id).subscribe({
      next: (joinRes) => {
        this.joiningGroupId.set(null);
        this.groups.update((list) =>
          list.map((g) =>
            g.id === group.id
              ? { ...g, role: joinRes.role, memberCount: g.memberCount + 1 }
              : g
          )
        );
        this.groupService.loadMyGroups().subscribe({ error: () => {} });
      },
      error: (err) => {
        this.joiningGroupId.set(null);
        this.errorMessage.set(err?.error?.message || 'Failed to join group');
      }
    });
  }

  openSpace(group: GroupResponse): void {
    this.router.navigate(['/groups', group.id]);
  }

  openCreateModal(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    this.isCreateModalOpen.set(true);
  }

  onGroupCreated(created: GroupResponse): void {
    this.isCreateModalOpen.set(false);
    this.loadInitialData();
  }

  parseTags(raw: string | null | undefined): string[] {
    return parseTopicTags(raw);
  }

  getDomainIconType(group: GroupResponse): 'coffee' | 'code' | 'layers' | 'shield' | 'compass' {
    const tag = (group.topicTag || '').toLowerCase();
    const name = (group.name || '').toLowerCase();
    if (tag.includes('java') || tag.includes('spring') || name.includes('java') || name.includes('spring')) {
      return 'coffee';
    }
    if (tag.includes('interview') || tag.includes('dsa') || tag.includes('algo') || name.includes('interview') || name.includes('algo')) {
      return 'code';
    }
    if (tag.includes('design') || tag.includes('system') || tag.includes('backend') || tag.includes('distributed')) {
      return 'layers';
    }
    if (tag.includes('angular') || tag.includes('frontend') || tag.includes('ui') || tag.includes('web')) {
      return 'shield';
    }
    return 'compass';
  }
}
