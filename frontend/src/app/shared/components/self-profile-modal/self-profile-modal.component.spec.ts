import { ComponentFixture, TestBed } from '@angular/core/testing';
import { User } from '../../../core/models/auth.model';
import { SelfProfileModalComponent } from './self-profile-modal.component';

describe('SelfProfileModalComponent', () => {
  let component: SelfProfileModalComponent;
  let fixture: ComponentFixture<SelfProfileModalComponent>;

  const mockUser: User = {
    id: 'user-123',
    email: 'satyam@orbit.local',
    displayName: 'Satyam Kumar',
    bio: 'Software engineer building real-time apps',
    avatarUrl: null,
    createdAt: '2026-06-27T10:30:00Z'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelfProfileModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SelfProfileModalComponent);
    component = fixture.componentInstance;
  });

  it('should not render anything when isOpen is false', () => {
    fixture.componentRef.setInput('isOpen', false);
    fixture.componentRef.setInput('user', mockUser);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.modal-backdrop')).toBeNull();
  });

  it('should render user details when isOpen is true', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('user', mockUser);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="self-profile-name"]')?.textContent?.trim()).toBe('Satyam Kumar');
    expect(compiled.querySelector('[data-testid="self-profile-email"]')?.textContent?.trim()).toBe('satyam@orbit.local');
    expect(compiled.querySelector('[data-testid="self-profile-bio"]')?.textContent?.trim()).toBe(
      'Software engineer building real-time apps'
    );
    expect(compiled.querySelector('[data-testid="self-profile-initials"]')?.textContent?.trim()).toBe('S');
    expect(compiled.querySelector('[data-testid="self-profile-joined"]')?.textContent).toContain('2026');
  });

  it('should display default placeholder when bio is null or empty', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('user', { ...mockUser, bio: null });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="self-profile-bio"]')?.textContent?.trim()).toBe(
      'No bio yet. Tell the community about yourself.'
    );
  });

  it('should render image tag when avatarUrl is provided', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('user', { ...mockUser, avatarUrl: 'https://example.com/avatar.jpg' });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const img = compiled.querySelector('.profile-avatar-img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toBe('https://example.com/avatar.jpg');
    expect(compiled.querySelector('[data-testid="self-profile-initials"]')).toBeNull();
  });

  it('should emit closeModal when close button is clicked', () => {
    let closed = false;
    component.closeModal.subscribe(() => {
      closed = true;
    });

    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('user', mockUser);
    fixture.detectChanges();

    const closeBtn = fixture.nativeElement.querySelector('[data-testid="close-profile-btn"]') as HTMLButtonElement;
    closeBtn.click();

    expect(closed).toBe(true);
  });

  it('should emit closeModal when backdrop is clicked', () => {
    let closed = false;
    component.closeModal.subscribe(() => {
      closed = true;
    });

    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('user', mockUser);
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector('.modal-backdrop') as HTMLElement;
    backdrop.click();

    expect(closed).toBe(true);
  });
});
