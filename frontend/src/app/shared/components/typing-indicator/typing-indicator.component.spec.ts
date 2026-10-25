import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TypingIndicatorComponent } from './typing-indicator.component';

describe('TypingIndicatorComponent', () => {
  let component: TypingIndicatorComponent;
  let fixture: ComponentFixture<TypingIndicatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TypingIndicatorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TypingIndicatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render bubble mode by default', () => {
    const bubble = fixture.nativeElement.querySelector('[data-testid="typing-bubble"]');
    expect(bubble).not.toBeNull();
  });

  it('should render bar mode when specified', () => {
    fixture.componentRef.setInput('mode', 'bar');
    fixture.componentRef.setInput('text', 'Alice and Bob are typing...');
    fixture.detectChanges();

    const bar = fixture.nativeElement.querySelector('[data-testid="group-typing-bar"]');
    expect(bar).not.toBeNull();
    const label = fixture.nativeElement.querySelector('[data-testid="group-typing-text"]');
    expect(label?.textContent).toBe('Alice and Bob are typing...');
  });
});
