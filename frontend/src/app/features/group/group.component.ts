import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-group',
  standalone: true,
  template: `
    <div class="group-page">
      <h2>Group: {{ groupId() }}</h2>
    </div>
  `,
  styles: [`
    .group-page {
      padding: 2rem;
    }
  `]
})
export class GroupComponent {
  private readonly route = inject(ActivatedRoute);

  groupId(): string | null {
    return this.route.snapshot.paramMap.get('id');
  }
}
