import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { WelcomeCanvasComponent } from './welcome-canvas.component';

describe('WelcomeCanvasComponent', () => {
  let component: WelcomeCanvasComponent;
  let fixture: ComponentFixture<WelcomeCanvasComponent>;

  const authServiceMock = {
    currentUser: () => ({ id: 'u1', email: 'satyam@orbit.internal', displayName: 'Satyam' })
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WelcomeCanvasComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WelcomeCanvasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and render current user name', () => {
    expect(component).toBeTruthy();
    expect(component.currentUserName()).toBe('Satyam');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.welcome-heading')?.textContent).toContain('Satyam');
  });

  it('should render action buttons for new chat and create space', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="action-new-chat-btn"]')).toBeTruthy();
    expect(compiled.querySelector('[data-testid="action-create-group-btn"]')).toBeTruthy();
  });
});
