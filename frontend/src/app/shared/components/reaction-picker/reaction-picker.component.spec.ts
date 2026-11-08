import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactionPickerComponent } from './reaction-picker.component';

describe('ReactionPickerComponent', () => {
  let component: ReactionPickerComponent;
  let fixture: ComponentFixture<ReactionPickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactionPickerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ReactionPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render all 8 reaction emojis', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.btn-emoji');
    expect(buttons.length).toBe(8);
  });

  it('should emit selectEmoji when an emoji button is clicked', () => {
    let selectedEmoji: string | null = null;
    component.selectEmoji.subscribe(emoji => (selectedEmoji = emoji));

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.btn-emoji')) as HTMLButtonElement[];
    const heartBtn = buttons.find(b => b.textContent?.includes('❤️'));
    expect(heartBtn).toBeDefined();
    heartBtn?.click();

    expect(selectedEmoji).toBe('❤️');
  });

  it('should apply active class when emoji matches currentEmoji input', () => {
    fixture.componentRef.setInput('currentEmoji', '🔥');
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.btn-emoji')) as HTMLButtonElement[];
    const fireBtn = buttons.find(b => b.textContent?.includes('🔥'));
    expect(fireBtn).toBeDefined();
    expect(fireBtn?.classList.contains('active')).toBe(true);
  });
});
