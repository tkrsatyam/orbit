import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AvatarComponent } from './avatar.component';

describe('AvatarComponent', () => {
  let component: AvatarComponent;
  let fixture: ComponentFixture<AvatarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the avatar component', () => {
    expect(component).toBeTruthy();
  });

  it('should compute initial from displayName', () => {
    fixture.componentRef.setInput('name', 'Ananya Roy');
    fixture.detectChanges();

    expect(component.initial()).toBe('A');
    const el = fixture.nativeElement.querySelector('.avatar-initials');
    expect(el.textContent.trim()).toBe('A');
  });

  it('should fallback to U if name is empty', () => {
    fixture.componentRef.setInput('name', '');
    fixture.detectChanges();

    expect(component.initial()).toBe('U');
  });

  it('should fallback to # if isGroup is true and name is empty', () => {
    fixture.componentRef.setInput('name', '');
    fixture.componentRef.setInput('isGroup', true);
    fixture.detectChanges();

    expect(component.initial()).toBe('#');
  });

  it('should render image when imageUrl is provided', () => {
    fixture.componentRef.setInput('name', 'Satyam Kumar');
    fixture.componentRef.setInput('imageUrl', 'https://example.com/avatar.jpg');
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('.avatar-img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('https://example.com/avatar.jpg');
  });

  it('should fallback to initials if image errors', () => {
    fixture.componentRef.setInput('name', 'Satyam Kumar');
    fixture.componentRef.setInput('imageUrl', 'https://example.com/bad.jpg');
    fixture.detectChanges();

    component.onImageError();
    fixture.detectChanges();

    expect(component.hasValidImage()).toBe(false);
    const initials = fixture.nativeElement.querySelector('.avatar-initials');
    expect(initials.textContent.trim()).toBe('S');
  });

  it('should render presence indicator when showPresence is true', () => {
    fixture.componentRef.setInput('showPresence', true);
    fixture.componentRef.setInput('isOnline', true);
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector('.presence-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator.classList.contains('online')).toBe(true);
  });
});
