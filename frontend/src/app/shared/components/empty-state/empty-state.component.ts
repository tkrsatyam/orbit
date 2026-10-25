import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss'
})
export class EmptyStateComponent {
  readonly title = input<string>('No items found');
  readonly description = input<string>('');
  readonly actionText = input<string | null>(null);

  readonly actionClick = output<void>();
}
