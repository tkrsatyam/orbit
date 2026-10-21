import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginFormComponent } from './login-form.component';

describe('LoginFormComponent', () => {
  let component: LoginFormComponent;
  let fixture: ComponentFixture<LoginFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginFormComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize with an invalid form', () => {
    expect(component.loginForm.valid).toBe(false);
  });

  it('should validate email and password fields', () => {
    const email = component.emailControl;
    const password = component.passwordControl;

    expect(email.valid).toBe(false);
    expect(email.errors?.['required']).toBe(true);

    email.setValue('invalid-email');
    expect(email.errors?.['email']).toBe(true);

    email.setValue('valid@example.com');
    expect(email.valid).toBe(true);

    password.setValue('MySecretPassword');
    expect(password.valid).toBe(true);
    expect(component.loginForm.valid).toBe(true);
  });

  it('should show required error when email is touched and empty', () => {
    component.emailControl.markAsTouched();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.field-error')?.textContent).toContain('Email is required.');
  });

  it('should show invalid format error when email is touched and malformed', () => {
    component.emailControl.setValue('invalid-email-format');
    component.emailControl.markAsTouched();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.field-error')?.textContent).toContain('Please enter a valid email address.');
  });

  it('should show required error when password is touched and empty', () => {
    component.passwordControl.markAsTouched();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.field-error')?.textContent).toContain('Password is required.');
  });

  it('should emit formSubmit when valid form is submitted', () => {
    let emittedPayload: unknown = null;
    component.formSubmit.subscribe((val) => (emittedPayload = val));

    component.loginForm.setValue({
      email: 'user@example.com',
      password: 'Password123!'
    });

    component.handleSubmit();

    expect(emittedPayload).toEqual({
      email: 'user@example.com',
      password: 'Password123!'
    });
  });

  it('should not emit formSubmit when form is invalid', () => {
    let emitted = false;
    component.formSubmit.subscribe(() => (emitted = true));

    component.handleSubmit();
    expect(emitted).toBe(false);
  });

  it('should display error message when error input is set', () => {
    fixture.componentRef.setInput('error', 'Invalid credentials');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.form-error')?.textContent).toContain('Invalid credentials');
  });

  it('should disable submit button and change text when isLoading is true', () => {
    component.loginForm.setValue({
      email: 'user@example.com',
      password: 'Password123!'
    });
    fixture.componentRef.setInput('isLoading', true);
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('.submit-button') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.textContent?.trim()).toBe('Signing in...');
  });
});
