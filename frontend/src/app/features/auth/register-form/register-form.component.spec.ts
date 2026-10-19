import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegisterFormComponent } from './register-form.component';

describe('RegisterFormComponent', () => {
  let component: RegisterFormComponent;
  let fixture: ComponentFixture<RegisterFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterFormComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize with an invalid form', () => {
    expect(component.registerForm.valid).toBe(false);
  });

  it('should validate display name constraints', () => {
    const displayName = component.displayNameControl;

    expect(displayName.valid).toBe(false);
    expect(displayName.errors?.['required']).toBe(true);

    displayName.setValue('A');
    expect(displayName.errors?.['minlength']).toBeTruthy();

    displayName.setValue('Valid User');
    expect(displayName.valid).toBe(true);
  });

  it('should validate password complexity requirements', () => {
    const password = component.passwordControl;

    password.setValue('weak');
    expect(password.errors?.['minlength']).toBeTruthy();

    password.setValue('lowercaseonly123!');
    expect(password.errors?.['pattern']).toBeTruthy();

    password.setValue('ValidPassword123!');
    expect(password.valid).toBe(true);
  });

  it('should emit formSubmit on valid submission', () => {
    let emittedPayload: unknown = null;
    component.formSubmit.subscribe((val) => (emittedPayload = val));

    component.registerForm.setValue({
      displayName: 'Satyam Kumar',
      email: 'satyam@orbit.local',
      password: 'StrongPassword1!'
    });

    component.handleSubmit();

    expect(emittedPayload).toEqual({
      displayName: 'Satyam Kumar',
      email: 'satyam@orbit.local',
      password: 'StrongPassword1!'
    });
  });

  it('should display error message when error input is provided', () => {
    fixture.componentRef.setInput('error', 'Email already registered');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.form-error')?.textContent).toContain('Email already registered');
  });
});
