import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { LoginPayload, RegisterPayload } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';
import { LoginFormComponent } from './login-form/login-form.component';
import { RegisterFormComponent } from './register-form/register-form.component';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [LoginFormComponent, RegisterFormComponent],
  template: `
    <div class="auth-page-wrapper">
      <div class="auth-card">
        <div class="auth-brand-header">
          <div class="orbit-badge" aria-hidden="true">
            <span>⬡</span>
          </div>
          <h1 class="auth-title">Orbit</h1>
        </div>
        <p class="auth-subtitle">
          {{ mode() === 'login' ? 'Welcome back! Sign in to continue.' : 'Create an account to join Orbit.' }}
        </p>

        <div class="tab-header" role="tablist">
          <button
            type="button"
            role="tab"
            (click)="setMode('login')"
            [class.active]="mode() === 'login'"
            [attr.aria-selected]="mode() === 'login'"
            class="tab-button"
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            (click)="setMode('register')"
            [class.active]="mode() === 'register'"
            [attr.aria-selected]="mode() === 'register'"
            class="tab-button"
          >
            Register
          </button>
        </div>

        @if (mode() === 'login') {
          <app-login-form
            [isLoading]="isSubmitting()"
            [error]="formError()"
            (formSubmit)="handleLogin($event)"
          />
        } @else {
          <app-register-form
            [isLoading]="isSubmitting()"
            [error]="formError()"
            (formSubmit)="handleRegister($event)"
          />
        }
      </div>
    </div>
  `,
  styles: [`
    .auth-page-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 40px);
      padding: 24px 16px;
      box-sizing: border-box;
    }
    .auth-card {
      width: 100%;
      max-width: 440px;
      background: var(--orbit-surface);
      border: 1.5px solid var(--orbit-border);
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: var(--shadow);
      box-sizing: border-box;
      text-align: left;
    }
    .auth-brand-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .orbit-badge {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #2a2015;
      border: 1px solid var(--orbit-accent);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--orbit-accent);
      font-size: 1.25rem;
    }
    .auth-title {
      font-size: 26px;
      letter-spacing: -0.02em;
      margin: 0;
      color: var(--orbit-text-primary);
    }
    .auth-subtitle {
      margin-bottom: 24px;
      color: var(--orbit-text-muted);
      font-size: 14px;
      line-height: 1.45;
    }
    .tab-header {
      display: flex;
      background: var(--orbit-bg);
      border: 1px solid var(--orbit-border);
      border-radius: 8px;
      padding: 4px;
      gap: 4px;
      margin-bottom: 24px;
    }
    .tab-button {
      flex: 1;
      padding: 9px 12px;
      background: transparent;
      border: none;
      border-radius: 6px;
      color: var(--orbit-text-muted);
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.15s ease-in-out;

      &:hover {
        color: var(--orbit-text-primary);
      }
    }
    .tab-button.active {
      background: var(--orbit-elevated);
      color: var(--orbit-accent);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
  `]
})
export class AuthComponent {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly mode = signal<'login' | 'register'>('login');
  readonly isSubmitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);

  constructor() {
    const routeMode = this.route.snapshot.data['mode'] as 'login' | 'register' | undefined;
    if (routeMode === 'register') {
      this.mode.set('register');
    }

    effect(() => {
      if (this.authService.isAuthenticated()) {
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
        this.router.navigateByUrl(returnUrl, { replaceUrl: true });
      }
    });
  }

  setMode(newMode: 'login' | 'register'): void {
    this.mode.set(newMode);
    this.formError.set(null);
  }

  handleLogin(credentials: LoginPayload): void {
    this.formError.set(null);
    this.isSubmitting.set(true);

    this.authService.login(credentials).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
        this.router.navigateByUrl(returnUrl, { replaceUrl: true });
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        this.formError.set(this.extractErrorMessage(err, 'Unable to log in. Please check your credentials.'));
      }
    });
  }

  handleRegister(payload: RegisterPayload): void {
    this.formError.set(null);
    this.isSubmitting.set(true);

    this.authService.register(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
        this.router.navigateByUrl(returnUrl, { replaceUrl: true });
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        this.formError.set(this.extractErrorMessage(err, 'Registration failed. Please check your details.'));
      }
    });
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (err && typeof err === 'object') {
      const e = err as Record<string, unknown>;
      const inner =
        e['error'] && typeof e['error'] === 'object'
          ? (e['error'] as Record<string, unknown>)
          : e;
      if (typeof inner['message'] === 'string') return inner['message'];
      if (typeof inner['detail'] === 'string') return inner['detail'];
      if (typeof e['error'] === 'string') return e['error'];
      if (typeof e['message'] === 'string') return e['message'];
    }
    return fallback;
  }
}
