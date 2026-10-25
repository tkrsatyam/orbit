import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-composer-editing-banner',
  standalone: true,
  imports: [],
  templateUrl: './composer-editing-banner.component.html',
  styleUrl: './composer-editing-banner.component.scss'
})
export class ComposerEditingBannerComponent {
  readonly previewContent = input<string>('');
  readonly cancel = output<void>();
}
