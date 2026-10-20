import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="not-found-container">
      <h1>404</h1>
      <h2>Page Not Found</h2>
      <p class="not-found-text">
        The page you are looking for does not exist or has been moved.
      </p>
      <a routerLink="/" class="return-home-link">
        Return to Home
      </a>
    </div>
  `,
  styles: [`
    .not-found-container {
      max-width: 480px;
      margin: 64px auto;
      padding: 24px;
      text-align: center;
    }
    .not-found-text {
      margin: 16px 0 24px;
      color: var(--text);
    }
    .return-home-link {
      display: inline-block;
      padding: 10px 20px;
      background: var(--orbit-accent);
      color: #121214;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      transition: opacity 0.15s;

      &:hover {
        opacity: 0.9;
      }
    }
  `]
})
export class NotFoundComponent {}
