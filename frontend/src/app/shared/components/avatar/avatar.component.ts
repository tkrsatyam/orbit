import { Component, computed, input, signal } from '@angular/core';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [],
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss'
})
export class AvatarComponent {
  readonly name = input<string | null | undefined>('');
  readonly imageUrl = input<string | null | undefined>(null);
  readonly size = input<AvatarSize>('md');
  readonly showPresence = input<boolean>(false);
  readonly isOnline = input<boolean>(false);
  readonly isGroup = input<boolean>(false);

  readonly imageFailed = signal<boolean>(false);

  readonly initial = computed(() => {
    const raw = this.name();
    if (!raw || !raw.trim()) {
      return this.isGroup() ? '#' : 'U';
    }
    return raw.trim().charAt(0).toUpperCase();
  });

  readonly hasValidImage = computed(() => {
    const url = this.imageUrl();
    return !!url && !this.imageFailed();
  });

  onImageError(): void {
    this.imageFailed.set(true);
  }
}
