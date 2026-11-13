import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-composer-reply-banner',
  standalone: true,
  imports: [],
  templateUrl: './composer-reply-banner.component.html',
  styleUrl: './composer-reply-banner.component.scss'
})
export class ComposerReplyBannerComponent {
  readonly senderName = input<string>('');
  readonly previewContent = input<string>('');
  readonly dismiss = output<void>();
}
