import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './discover.component.html',
  styleUrl: './discover.component.scss'
})
export class DiscoverComponent {
  readonly authService = inject(AuthService);

  currentUserName(): string {
    const user = this.authService.currentUser();
    return user?.displayName || user?.email || user?.id || '';
  }
}
