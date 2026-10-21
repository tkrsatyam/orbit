import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-group',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './group.component.html',
  styleUrl: './group.component.scss'
})
export class GroupComponent {
  private readonly route = inject(ActivatedRoute);

  groupId(): string {
    return this.route.snapshot.paramMap.get('id') || '';
  }
}
