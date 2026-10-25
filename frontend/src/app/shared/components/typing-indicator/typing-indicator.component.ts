import { Component, input } from '@angular/core';

@Component({
  selector: 'app-typing-indicator',
  standalone: true,
  imports: [],
  templateUrl: './typing-indicator.component.html',
  styleUrl: './typing-indicator.component.scss'
})
export class TypingIndicatorComponent {
  readonly mode = input<'bubble' | 'bar'>('bubble');
  readonly text = input<string | null>('');
}
