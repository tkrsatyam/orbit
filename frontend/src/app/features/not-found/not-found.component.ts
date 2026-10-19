import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="not-found-page">
      <h1>404</h1>
      <p>Page Not Found</p>
      <a routerLink="/">Go to Home</a>
    </div>
  `,
  styles: [`
    .not-found-page {
      padding: 3rem;
      text-align: center;
    }
  `]
})
export class NotFoundComponent {}
