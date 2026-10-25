import { Injectable, signal, computed, effect } from '@angular/core';

export type AppTheme = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly storageKey = 'orbit_theme';
  readonly theme = signal<AppTheme>(this.getInitialTheme());
  readonly isDark = computed(() => this.theme() === 'dark');

  constructor() {
    this.applyTheme(this.theme());
  }

  toggleTheme(): void {
    const nextTheme: AppTheme = this.theme() === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  setTheme(newTheme: AppTheme): void {
    this.theme.set(newTheme);
    try {
      localStorage.setItem(this.storageKey, newTheme);
    } catch {
      // Ignore localStorage errors (e.g. private browsing restrictions)
    }
    this.applyTheme(newTheme);
  }

  private getInitialTheme(): AppTheme {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    } catch {
      // Default to light
    }
    return 'light';
  }

  private applyTheme(targetTheme: AppTheme): void {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', targetTheme);
    }
  }
}
