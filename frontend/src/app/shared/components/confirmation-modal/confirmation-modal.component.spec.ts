import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationModalComponent } from './confirmation-modal.component';

describe('ConfirmationModalComponent', () => {
  let component: ConfirmationModalComponent;
  let fixture: ComponentFixture<ConfirmationModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmationModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmationModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not render when isOpen is false', () => {
    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector('.modal-backdrop');
    expect(backdrop).toBeNull();
  });

  it('should render title and description when isOpen is true', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('title', 'Leave Space?');
    fixture.componentRef.setInput('description', 'You will lose access to discussions.');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Leave Space?');
    expect(fixture.nativeElement.textContent).toContain('You will lose access to discussions.');
  });

  it('should emit confirm on confirm button click', () => {
    let confirmed = false;
    component.confirm.subscribe(() => (confirmed = true));

    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('[data-testid="action-confirm-btn"]');
    btn.click();

    expect(confirmed).toBe(true);
  });

  it('should emit cancel on cancel button click', () => {
    let cancelled = false;
    component.cancel.subscribe(() => (cancelled = true));

    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('[data-testid="cancel-confirm-btn"]');
    btn.click();

    expect(cancelled).toBe(true);
  });
});
