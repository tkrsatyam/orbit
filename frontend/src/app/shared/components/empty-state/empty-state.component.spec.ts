import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  let component: EmptyStateComponent;
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyStateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render title and description', () => {
    fixture.componentRef.setInput('title', 'No messages yet');
    fixture.componentRef.setInput('description', 'Send a message to start.');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No messages yet');
    expect(fixture.nativeElement.textContent).toContain('Send a message to start.');
  });

  it('should emit actionClick when action button clicked', () => {
    let clicked = false;
    component.actionClick.subscribe(() => (clicked = true));

    fixture.componentRef.setInput('actionText', 'Create Group');
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('[data-testid="empty-action-btn"]');
    expect(btn).not.toBeNull();
    btn.click();

    expect(clicked).toBe(true);
  });
});
