import { Component, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LoginPayload } from '../../../core/models/auth.model';

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="loginForm" (ngSubmit)="handleSubmit()" class="auth-form">
      @if (error()) {
        <div class="form-error">
          {{ error() }}
        </div>
      }

      <div class="form-group">
        <label for="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          formControlName="email"
          placeholder="name@example.com"
          autocomplete="email"
        />
        @if (emailControl.touched && emailControl.hasError('required')) {
          <span class="field-error">Email is required.</span>
        } @else if (emailControl.touched && emailControl.hasError('email')) {
          <span class="field-error">Please enter a valid email address.</span>
        }
      </div>

      <div class="form-group">
        <label for="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          formControlName="password"
          placeholder="••••••••"
          autocomplete="current-password"
        />
        @if (passwordControl.touched && passwordControl.hasError('required')) {
          <span class="field-error">Password is required.</span>
        }
      </div>

      <button
        type="submit"
        [disabled]="loginForm.invalid || isLoading()"
        class="submit-button"
      >
        {{ isLoading() ? 'Signing in...' : 'Sign in' }}
      </button>
    </form>
  `,
  styles: [`
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-width: 360px;
      margin: 0 auto;
      text-align: left;
    }
    .form-error {
      padding: 10px 14px;
      background: #fee2e2;
      color: #b91c1c;
      border-radius: 6px;
      font-size: 14px;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .form-group label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-h);
    }
    .form-group input {
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 15px;
      background: var(--bg);
      color: var(--text-h);
      box-sizing: border-box;
    }
    .form-group input:focus {
      outline: 2px solid var(--accent);
      border-color: transparent;
    }
    .field-error {
      font-size: 12px;
      color: #b91c1c;
    }
    .submit-button {
      padding: 12px;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .submit-button:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }
  `]
})
export class LoginFormComponent {
  readonly isLoading = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly formSubmit = output<LoginPayload>();

  readonly loginForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  get emailControl(): FormControl<string> {
    return this.loginForm.controls.email;
  }

  get passwordControl(): FormControl<string> {
    return this.loginForm.controls.password;
  }

  handleSubmit(): void {
    if (this.loginForm.invalid || this.isLoading()) {
      return;
    }
    this.formSubmit.emit(this.loginForm.getRawValue());
  }
}
