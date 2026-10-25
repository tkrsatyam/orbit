import { Component, HostListener, input, output } from '@angular/core';

@Component({
  selector: 'app-delete-message-modal',
  standalone: true,
  imports: [],
  templateUrl: './delete-message-modal.component.html',
  styleUrl: './delete-message-modal.component.scss'
})
export class DeleteMessageModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly messageContent = input<string>('');
  readonly isAuthor = input<boolean>(true);
  readonly isAdmin = input<boolean>(false);
  readonly isGroup = input<boolean>(false);
  readonly isDeleting = input<boolean>(false);

  readonly confirm = output<'FOR_EVERYONE' | 'FOR_ME'>();
  readonly close = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen() && !this.isDeleting()) {
      this.close.emit();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.isDeleting()) {
      this.close.emit();
    }
  }
}
