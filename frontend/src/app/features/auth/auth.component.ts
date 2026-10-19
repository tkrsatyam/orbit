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
    <div class="auth-container">
      <h1>Orbit</h1>
      <p class="auth-subtitle">
        {{ mode() === 'login' ? 'Welcome back! Sign in to continue.' : 'Create an account to join Orbit.' }}
      </p>

      <div class="tab-header">
        <button
          type="button"
          (click)="setMode('login')"
          [class.active]="mode() === 'login'"
          class="tab-button"
        >
          Sign in
        </button>
        <button
          type="button"
          (click)="setMode('register')"
          [class.active]="mode() === 'register'"
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
  `,
  styles: [`
    .auth-container {
      max-width: 440px;
      margin: 48px auto;
      padding: 32px 24px;
    }
    .auth-subtitle {
      margin-bottom: 24px;
      color: var(--text);
    }
    .tab-header {
      display: flex;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
    }
    .tab-button {
      flex: 1;
      padding: 10px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text);
      font-weight: 600;
      font-size: 15px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .tab-button.active {
      border-bottom: 2px solid var(--accent);
      color: var(--text-h);
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
