import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageActionsBarComponent } from './message-actions-bar.component';

describe('MessageActionsBarComponent', () => {
  let component: MessageActionsBarComponent;
  let fixture: ComponentFixture<MessageActionsBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageActionsBarComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(MessageActionsBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle visible class based on isVisible input', () => {
    fixture.componentRef.setInput('isVisible', true);
    fixture.detectChanges();

    const bar = fixture.nativeElement.querySelector('.message-actions-bar');
    expect(bar.classList.contains('visible')).toBe(true);

    fixture.componentRef.setInput('isVisible', false);
    fixture.detectChanges();
    expect(bar.classList.contains('visible')).toBe(false);
  });

  it('should emit edit when edit button clicked', () => {
    let emitted = false;
    component.edit.subscribe(() => (emitted = true));

    fixture.componentRef.setInput('canEdit', true);
    fixture.componentRef.setInput('isVisible', true);
    fixture.detectChanges();

    const editBtn = fixture.nativeElement.querySelector('.btn-action-edit');
    expect(editBtn).not.toBeNull();
    editBtn.click();

    expect(emitted).toBe(true);
  });

  it('should emit delete when delete button clicked', () => {
    let emitted = false;
    component.delete.subscribe(() => (emitted = true));

    fixture.componentRef.setInput('canDelete', true);
    fixture.componentRef.setInput('isVisible', true);
    fixture.detectChanges();

    const delBtn = fixture.nativeElement.querySelector('.btn-action-delete');
    expect(delBtn).not.toBeNull();
    delBtn.click();

    expect(emitted).toBe(true);
  });
});
