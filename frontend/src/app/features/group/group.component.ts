import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-group',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="group-container">
      <header class="group-header">
        <h2>Group: {{ groupId() }}</h2>
        <p class="group-subtitle">
          This is a protected group view. Only authenticated users can access this page.
        </p>
      </header>

      <div>
        <a routerLink="/" class="back-link">
          &larr; Back to conversations
        </a>
      </div>
    </div>
  `,
  styles: [`
    .group-container {
      max-width: 720px;
      margin: 48px auto;
      padding: 24px;
      text-align: left;
    }
    .group-header {
      margin-bottom: 24px;
    }
    .group-subtitle {
      color: var(--text);
      margin-top: 4px;
    }
    .back-link {
      color: var(--accent);
      text-decoration: none;
      font-size: 15px;
    }
  `]
})
export class GroupComponent {
  private readonly route = inject(ActivatedRoute);

  groupId(): string {
    return this.route.snapshot.paramMap.get('id') || '';
  }
}
