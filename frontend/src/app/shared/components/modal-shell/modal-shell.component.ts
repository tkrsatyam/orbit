import { Component, HostListener, input, output } from '@angular/core';

@Component({
  selector: 'app-modal-shell',
  standalone: true,
  imports: [],
  templateUrl: './modal-shell.component.html',
  styleUrl: './modal-shell.component.scss'
})
export class ModalShellComponent {
  readonly isOpen = input<boolean>(false);
  readonly title = input<string>('');
  readonly subtitle = input<string | undefined>(undefined);
  readonly showAccentBar = input<boolean>(true);
  readonly maxWidth = input<string>('520px');
  readonly ariaLabelledBy = input<string>('orbit-modal-title');

  readonly close = output<void>();

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) {
      this.close.emit();
    }
  }
}
