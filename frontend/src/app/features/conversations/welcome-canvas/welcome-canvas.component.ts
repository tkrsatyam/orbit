import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ConversationsComponent } from '../conversations.component';

@Component({
  selector: 'app-welcome-canvas',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './welcome-canvas.component.html',
  styleUrl: './welcome-canvas.component.scss'
})
export class WelcomeCanvasComponent {
  private readonly authService = inject(AuthService);
  private readonly workstation = inject(ConversationsComponent, { optional: true });

  readonly currentUser = computed(() => this.authService.currentUser());

  readonly currentUserName = computed(() => {
    return this.currentUser()?.displayName ?? 'Anonymous User';
  });

  openNewChat(): void {
    this.workstation?.openNewChatModal();
  }

  openCreateSpace(): void {
    this.workstation?.openCreateGroupModal();
  }
}
