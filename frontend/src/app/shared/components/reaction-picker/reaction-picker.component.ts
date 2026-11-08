import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-reaction-picker',
  standalone: true,
  imports: [],
  templateUrl: './reaction-picker.component.html',
  styleUrl: './reaction-picker.component.scss'
})
export class ReactionPickerComponent {
  readonly currentEmoji = input<string | null>(null);
  readonly selectEmoji = output<string>();
  readonly close = output<void>();

  readonly emojis: string[] = ['👍', '❤️', '😂', '🎉', '😮', '😢', '🔥', '🚀'];

  onSelect(emoji: string): void {
    this.selectEmoji.emit(emoji);
  }
}
