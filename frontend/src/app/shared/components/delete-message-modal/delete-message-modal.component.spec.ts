import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeleteMessageModalComponent } from './delete-message-modal.component';

describe('DeleteMessageModalComponent', () => {
  let component: DeleteMessageModalComponent;
  let fixture: ComponentFixture<DeleteMessageModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteMessageModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteMessageModalComponent);
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

  it('should render when isOpen is true', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('messageContent', 'Delete me please');
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector('.modal-backdrop');
    expect(backdrop).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Delete me please');
  });

  it('should emit FOR_EVERYONE when delete for everyone button clicked', () => {
    let mode: string | undefined;
    component.confirm.subscribe((m) => (mode = m));

    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('isAuthor', true);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('[data-testid="delete-for-everyone-btn"]');
    expect(btn).not.toBeNull();
    btn.click();

    expect(mode).toBe('FOR_EVERYONE');
  });

  it('should emit FOR_ME when delete for me button clicked', () => {
    let mode: string | undefined;
    component.confirm.subscribe((m) => (mode = m));

    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('[data-testid="delete-for-me-btn"]');
    expect(btn).not.toBeNull();
    btn.click();

    expect(mode).toBe('FOR_ME');
  });

  it('should emit close on backdrop or cancel click', () => {
    let closed = false;
    component.close.subscribe(() => (closed = true));

    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const cancelBtn = fixture.nativeElement.querySelector('[data-testid="cancel-delete-modal-btn"]');
    cancelBtn.click();

    expect(closed).toBe(true);
  });
});
