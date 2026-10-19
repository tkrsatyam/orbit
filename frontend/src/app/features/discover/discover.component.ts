import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="discover-page">
      <h1>Discover Groups</h1>
      <p>Browse public communities and groups.</p>
      @if (!authService.isAuthenticated()) {
        <p><a routerLink="/register">Register to Join</a></p>
      }
    </div>
  `,
  styles: [`
    .discover-page {
      padding: 2rem;
      text-align: center;
    }
  `]
})
export class DiscoverComponent {
  readonly authService = inject(AuthService);
}
