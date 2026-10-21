import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { GroupMemberResponse, GroupResponse, GroupService } from '../../core/services/group.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-group',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './group.component.html',
  styleUrl: './group.component.scss'
})
export class GroupComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly groupService = inject(GroupService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly group = signal<GroupResponse | null>(null);
  readonly loading = signal<boolean>(true);
  readonly errorMessage = signal<string | null>(null);

  readonly isEditModalOpen = signal<boolean>(false);
  readonly isSubmittingEdit = signal<boolean>(false);
  readonly editError = signal<string | null>(null);

  readonly inviteLink = signal<string | null>(null);
  readonly inviteCopied = signal<boolean>(false);

  // Member roster state
  readonly isMembersDrawerOpen = signal<boolean>(false);
  readonly members = signal<GroupMemberResponse[]>([]);
  readonly loadingMembers = signal<boolean>(false);
  readonly memberActionError = signal<string | null>(null);
  readonly updatingMemberId = signal<string | null>(null);
  readonly currentUserId = computed(() => this.authService.currentUser()?.id);

  // Leave space state
  readonly isLeaveModalOpen = signal<boolean>(false);
  readonly isLeaving = signal<boolean>(false);
  readonly leaveError = signal<string | null>(null);

  readonly editForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    topicTag: ['', [Validators.maxLength(50)]],
    description: ['', [Validators.maxLength(500)]]
  });

  readonly groupId = computed(() => this.route.snapshot.paramMap.get('id') || '');
  readonly isAdmin = computed(() => this.group()?.role === 'ADMIN');
  readonly myGroups = computed(() => this.groupService.myGroups());

  ngOnInit(): void {
    const id = this.groupId();
    if (!id) {
      this.errorMessage.set('Group ID is missing');
      this.loading.set(false);
      return;
    }
    this.loadGroupDetails(id);
    this.groupService.loadMyGroups().subscribe({
      error: () => {}
    });
  }

  loadGroupDetails(id: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.groupService.getGroupDetails(id).subscribe({
      next: (details) => {
        this.group.set(details);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err.error?.message || 'Failed to load group details';
        this.errorMessage.set(msg);
      }
    });
  }

  openEditModal(): void {
    const g = this.group();
    if (!g) return;

    this.editForm.patchValue({
      name: g.name,
      topicTag: g.topicTag ? g.topicTag.replace(/^#/, '') : '',
      description: g.description || ''
    });
    this.editError.set(null);
    this.isEditModalOpen.set(true);
  }

  closeEditModal(): void {
    this.isEditModalOpen.set(false);
    this.editError.set(null);
  }

  submitEdit(): void {
    if (this.editForm.invalid || this.isSubmittingEdit()) {
      this.editForm.markAllAsTouched();
      return;
    }

    const g = this.group();
    if (!g) return;

    this.isSubmittingEdit.set(true);
    this.editError.set(null);

    const val = this.editForm.value;
    let topic = val.topicTag ? val.topicTag.trim() : null;
    if (topic && !topic.startsWith('#')) {
      topic = '#' + topic;
    }

    this.groupService.updateGroup(g.id, {
      name: val.name.trim(),
      topicTag: topic,
      description: val.description ? val.description.trim() : null
    }).subscribe({
      next: (updated) => {
        this.group.set(updated);
        this.isSubmittingEdit.set(false);
        this.closeEditModal();
      },
      error: (err) => {
        this.isSubmittingEdit.set(false);
        const msg = err.error?.message || 'Failed to update group';
        this.editError.set(msg);
      }
    });
  }

  generateInviteLink(): void {
    const g = this.group();
    if (!g) return;

    this.groupService.generateInvite(g.id).subscribe({
      next: (res) => {
        this.inviteLink.set(res.inviteLink);
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(res.inviteLink);
          this.inviteCopied.set(true);
          setTimeout(() => this.inviteCopied.set(false), 3000);
        }
      },
      error: (err) => {
        const msg = err.error?.message || 'Failed to generate invite';
        this.errorMessage.set(msg);
      }
    });
  }

  toggleMembersDrawer(): void {
    const nextState = !this.isMembersDrawerOpen();
    this.isMembersDrawerOpen.set(nextState);
    if (nextState) {
      this.loadMembers();
    }
  }

  loadMembers(): void {
    const gid = this.groupId();
    if (!gid) return;

    this.loadingMembers.set(true);
    this.memberActionError.set(null);
    this.groupService.getGroupMembers(gid).subscribe({
      next: (res) => {
        this.members.set(res.content);
        this.loadingMembers.set(false);
      },
      error: (err) => {
        this.loadingMembers.set(false);
        const msg = err.error?.message || 'Failed to load group members';
        this.memberActionError.set(msg);
      }
    });
  }

  toggleMemberRole(targetMember: GroupMemberResponse): void {
    const gid = this.groupId();
    if (!gid || this.updatingMemberId()) return;

    const newRole = targetMember.role === 'ADMIN' ? 'MEMBER' : 'ADMIN';
    this.updatingMemberId.set(targetMember.userId);
    this.memberActionError.set(null);

    this.groupService.updateMemberRole(gid, targetMember.userId, { role: newRole }).subscribe({
      next: (updatedMember) => {
        this.members.update((list) =>
          list.map((m) => (m.userId === updatedMember.userId ? updatedMember : m))
        );
        this.updatingMemberId.set(null);
      },
      error: (err) => {
        this.updatingMemberId.set(null);
        const msg = err.error?.message || 'Failed to update member role';
        this.memberActionError.set(msg);
      }
    });
  }

  openLeaveModal(): void {
    this.leaveError.set(null);
    this.isLeaveModalOpen.set(true);
  }

  closeLeaveModal(): void {
    this.isLeaveModalOpen.set(false);
    this.leaveError.set(null);
  }

  confirmLeaveGroup(): void {
    const gid = this.groupId();
    if (!gid || this.isLeaving()) return;

    this.isLeaving.set(true);
    this.leaveError.set(null);

    this.groupService.leaveGroup(gid).subscribe({
      next: () => {
        this.isLeaving.set(false);
        this.closeLeaveModal();
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isLeaving.set(false);
        const msg = err.error?.message || 'Failed to leave space';
        this.leaveError.set(msg);
      }
    });
  }
}
