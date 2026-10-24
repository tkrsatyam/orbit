import { Component, computed, ElementRef, HostListener, inject, input, model, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { User } from '../../../core/models/auth.model';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { AvatarComponent } from '../avatar/avatar.component';

export type NavRailTab = 'CHATS' | 'GROUPS' | 'CONTACTS' | 'DISCOVER';

@Component({
  selector: 'app-navigation-rail',
  standalone: true,
  imports: [RouterLink, AvatarComponent],
  templateUrl: './navigation-rail.component.html',
  styleUrl: './navigation-rail.component.scss'
})
export class NavigationRailComponent {
  private readonly elementRef = inject(ElementRef);
  private readonly themeService = inject(ThemeService);

  readonly activeTab = input<NavRailTab>('CHATS');
  readonly incomingCount = input<number>(0);
  readonly user = input<User | null>(null);

  readonly tabChange = output<NavRailTab>();
  readonly openProfile = output<void>();
  readonly signOut = output<void>();

  readonly isMenuOpen = model<boolean>(false);

  readonly isDark = this.themeService.isDark;
  readonly logoSrc = computed(() => this.isDark() ? 'brand/orbit-icon.svg' : 'brand/orbit-icon-light.svg');

  readonly displayName = computed(() => this.user()?.displayName ?? 'Anonymous User');
  readonly email = computed(() => this.user()?.email ?? '');
  readonly avatarUrl = computed(() => this.user()?.avatarUrl);

  selectTab(tab: NavRailTab): void {
    this.tabChange.emit(tab);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isMenuOpen.update(v => !v);
  }

  handleOpenProfile(): void {
    this.isMenuOpen.set(false);
    this.openProfile.emit();
  }

  handleSignOut(): void {
    this.isMenuOpen.set(false);
    this.signOut.emit();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isMenuOpen() && !this.elementRef.nativeElement.contains(event.target)) {
      this.isMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isMenuOpen()) {
      this.isMenuOpen.set(false);
    }
  }
}
