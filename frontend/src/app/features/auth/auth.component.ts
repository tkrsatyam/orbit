import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LoginPayload, RegisterPayload } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';
import { LoginFormComponent } from './login-form/login-form.component';
import { RegisterFormComponent } from './register-form/register-form.component';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [LoginFormComponent, RegisterFormComponent],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss'
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
