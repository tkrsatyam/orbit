import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GroupJoinResponse, GroupService } from '../../core/services/group.service';

@Component({
  selector: 'app-invite-join',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './invite-join.component.html',
  styleUrl: './invite-join.component.scss'
})
export class InviteJoinComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly groupService = inject(GroupService);

  readonly status = signal<'LOADING' | 'SUCCESS' | 'ERROR'>('LOADING');
  readonly result = signal<GroupJoinResponse | null>(null);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.status.set('ERROR');
      this.errorMessage.set('No invite token was provided in the URL.');
      return;
    }

    this.groupService.joinViaInvite(token).subscribe({
      next: (res) => {
        this.result.set(res);
        this.status.set('SUCCESS');
      },
      error: (err) => {
        this.status.set('ERROR');
        const msg = err.error?.message || 'Invite link is invalid or has expired.';
        this.errorMessage.set(msg);
      }
    });
  }

  navigateToGroup(): void {
    const res = this.result();
    if (res?.groupId) {
      this.router.navigate(['/groups', res.groupId]);
    } else {
      this.router.navigate(['/']);
    }
  }
}
