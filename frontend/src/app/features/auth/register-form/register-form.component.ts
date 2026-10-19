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
    .hint-text {
      font-size: 12px;
      color: var(--text);
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
