import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalShellComponent } from './modal-shell.component';

describe('ModalShellComponent', () => {
  let component: ModalShellComponent;
  let fixture: ComponentFixture<ModalShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalShellComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ModalShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create modal-shell component', () => {
    expect(component).toBeTruthy();
  });

  it('should not render backdrop when isOpen is false', () => {
    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector('.orbit-modal-backdrop');
    expect(backdrop).toBeNull();
  });

  it('should render backdrop, title, and subtitle when isOpen is true', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('title', 'Test Modal');
    fixture.componentRef.setInput('subtitle', 'This is a test modal');
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector('.orbit-modal-backdrop');
    expect(backdrop).toBeTruthy();

    const title = fixture.nativeElement.querySelector('.modal-title');
    expect(title.textContent.trim()).toBe('Test Modal');

    const subtitle = fixture.nativeElement.querySelector('.modal-subtitle');
    expect(subtitle.textContent.trim()).toBe('This is a test modal');
  });

  it('should emit close output when close button is clicked', () => {
    let closed = false;
    component.close.subscribe(() => {
      closed = true;
    });

    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const closeBtn = fixture.nativeElement.querySelector('.btn-close');
    closeBtn.click();

    expect(closed).toBe(true);
  });

  it('should emit close output when backdrop is clicked directly', () => {
    let closed = false;
    component.close.subscribe(() => {
      closed = true;
    });

    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const backdrop: HTMLElement = fixture.nativeElement.querySelector('.orbit-modal-backdrop');
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(closed).toBe(true);
  });

  it('should emit close output on Escape key press when open', () => {
    let closed = false;
    component.close.subscribe(() => {
      closed = true;
    });

    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(closed).toBe(true);
  });
});
