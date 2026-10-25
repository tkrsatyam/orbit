import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-message-actions-bar',
  standalone: true,
  imports: [],
  templateUrl: './message-actions-bar.component.html',
  styleUrl: './message-actions-bar.component.scss'
})
export class MessageActionsBarComponent {
  readonly isVisible = input<boolean>(false);
  readonly canEdit = input<boolean>(false);
  readonly canDelete = input<boolean>(true);
  readonly messageId = input<string>('');

  readonly edit = output<void>();
  readonly delete = output<void>();
}
