import { Component, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RegisterPayload } from '../../../core/models/auth.model';

@Component({
  selector: 'app-register-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="registerForm" (ngSubmit)="handleSubmit()" class="auth-form">
      @if (error()) {
        <div class="form-error">
          {{ error() }}
        </div>
      }

      <div class="form-group">
        <label for="register-displayName">Display Name</label>
        <input
          id="register-displayName"
          type="text"
          formControlName="displayName"
          placeholder="Satyam Kumar"
          autocomplete="name"
        />
        @if (displayNameControl.touched && displayNameControl.hasError('required')) {
          <span class="field-error">Display name is required.</span>
        } @else if (displayNameControl.touched && (displayNameControl.hasError('minlength') || displayNameControl.hasError('maxlength'))) {
          <span class="field-error">Display name must be between 2 and 50 characters.</span>
        }
      </div>

      <div class="form-group">
        <label for="register-email">Email</label>
        <input
          id="register-email"
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
        <label for="register-password">Password</label>
        <input
          id="register-password"
          type="password"
          formControlName="password"
          placeholder="••••••••"
          autocomplete="new-password"
        />
        <span class="hint-text">
          At least 8 chars with uppercase, lowercase, number, and special symbol.
        </span>
        @if (passwordControl.touched && passwordControl.hasError('required')) {
          <span class="field-error">Password is required.</span>
        } @else if (passwordControl.touched && (passwordControl.hasError('minlength') || passwordControl.hasError('pattern'))) {
          <span class="field-error">Password must be at least 8 characters and include uppercase, lowercase, number, and special character.</span>
        }
      </div>

      <button
        type="submit"
        [disabled]="registerForm.invalid || isLoading()"
        class="submit-button"
      >
        {{ isLoading() ? 'Creating account...' : 'Create account' }}
      </button>
    </form>
  `,
  styles: [`
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: 100%;
      text-align: left;
    }
    .form-error {
      padding: 10px 14px;
      background: var(--orbit-danger-subtle);
      color: var(--orbit-danger);
      border: 1px solid rgba(244, 63, 94, 0.3);
      border-radius: 8px;
      font-size: 13px;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .form-group label {
      font-size: 13px;
      font-weight: 600;
      color: var(--orbit-text-primary);
    }
    .form-group input {
      padding: 11px 13px;
      border: 1px solid var(--orbit-border);
      border-radius: 8px;
      font-size: 14px;
      background: var(--orbit-bg);
      color: var(--orbit-text-primary);
      box-sizing: border-box;
      transition: border-color 0.15s, outline 0.15s;
    }
    .form-group input:focus {
      outline: 2px solid var(--orbit-accent-subtle);
      border-color: var(--orbit-accent);
    }
    .hint-text {
      font-size: 12px;
      color: var(--orbit-text-muted);
    }
    .field-error {
      font-size: 12px;
      color: var(--orbit-danger);
    }
    .submit-button {
      padding: 12px;
      background: var(--orbit-accent);
      color: #121214;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
      margin-top: 4px;
    }
    .submit-button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
  `]
})
export class RegisterFormComponent {
  readonly isLoading = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly formSubmit = output<RegisterPayload>();

  private static readonly PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])\S{8,}$/;

  readonly registerForm = new FormGroup({
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(50)]
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email]
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(RegisterFormComponent.PASSWORD_PATTERN)
      ]
    })
  });

  get displayNameControl(): FormControl<string> {
    return this.registerForm.controls.displayName;
  }

  get emailControl(): FormControl<string> {
    return this.registerForm.controls.email;
  }

  get passwordControl(): FormControl<string> {
    return this.registerForm.controls.password;
  }

  handleSubmit(): void {
    if (this.registerForm.invalid || this.isLoading()) {
      return;
    }
    this.formSubmit.emit(this.registerForm.getRawValue());
  }
}
