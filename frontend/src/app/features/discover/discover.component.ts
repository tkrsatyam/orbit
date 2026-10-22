import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { GroupResponse, GroupService } from '../../core/services/group.service';
import { CreateGroupModalComponent } from '../../shared/components/create-group-modal/create-group-modal.component';
import { parseTopicTags } from '../../shared/utils/tag-utils';

export interface TopicFilter {
  id: string;
  label: string;
  tag?: string;
}

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CreateGroupModalComponent],
  templateUrl: './discover.component.html',
  styleUrl: './discover.component.scss'
})
export class DiscoverComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly groupService = inject(GroupService);
  private readonly router = inject(Router);

  readonly searchQuery = signal<string>('');
  readonly selectedTag = signal<string>('all');
  readonly groups = signal<GroupResponse[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly joiningGroupId = signal<string | null>(null);
  readonly isCreateModalOpen = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly topicFilters: TopicFilter[] = [
    { id: 'all', label: 'All Topics' },
    { id: 'java-spring', label: '#java-spring', tag: 'java-spring' },
    { id: 'interview-prep', label: '#interview-prep', tag: 'interview-prep' },
    { id: 'system-design', label: '#system-design', tag: 'system-design' },
    { id: 'frontend-angular', label: '#frontend-angular', tag: 'frontend-angular' }
  ];

  ngOnInit(): void {
    this.loadGroups();
  }

  loadGroups(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const query = this.searchQuery().trim();
    const tag = this.selectedTag() === 'all' ? undefined : this.selectedTag();

    this.groupService.discoverGroups({ q: query, tag, page: 0, size: 50 }).subscribe({
      next: (response) => {
        this.groups.set(response.content);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load public spaces');
        this.isLoading.set(false);
      }
    });
  }

  onSearchChange(): void {
    this.loadGroups();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.loadGroups();
  }

  selectTag(tagId: string): void {
    this.selectedTag.set(tagId);
    this.loadGroups();
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
    this.loadGroups();
  }

  currentUserName(): string {
    const user = this.authService.currentUser();
    return user?.displayName || user?.email || user?.id || '';
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
