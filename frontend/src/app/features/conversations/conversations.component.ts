import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-conversations',
  standalone: true,
  template: `
    <div class="conversations-page">
      <h2>Conversations</h2>
      <p>Signed in as: {{ authService.currentUser()?.displayName }}</p>
    </div>
  `,
  styles: [`
    .conversations-page {
      padding: 2rem;
    }
  `]
})
export class ConversationsComponent {
  readonly authService = inject(AuthService);
}
