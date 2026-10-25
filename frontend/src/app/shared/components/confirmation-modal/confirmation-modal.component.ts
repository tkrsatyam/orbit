import { Component, HostListener, input, output } from '@angular/core';

@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [],
  templateUrl: './confirmation-modal.component.html',
  styleUrl: './confirmation-modal.component.scss'
})
export class ConfirmationModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly title = input<string>('Confirm Action');
  readonly description = input<string>('');
  readonly confirmText = input<string>('Confirm');
  readonly cancelText = input<string>('Cancel');
  readonly danger = input<boolean>(true);
  readonly isLoading = input<boolean>(false);

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen() && !this.isLoading()) {
      this.cancel.emit();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.isLoading()) {
      this.cancel.emit();
    }
  }
}
