import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageReactionsComponent } from './message-reactions.component';
import { ReactionResponse } from '../../../core/models/message.model';

describe('MessageReactionsComponent', () => {
  let component: MessageReactionsComponent;
  let fixture: ComponentFixture<MessageReactionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageReactionsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(MessageReactionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not render anything when reactions list is empty', () => {
    fixture.componentRef.setInput('reactions', []);
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('.message-reactions');
    expect(container).toBeNull();
  });

  it('should group reactions by emoji and calculate count correctly', () => {
    const mockReactions: ReactionResponse[] = [
      { emoji: '👍', userId: 'user-1', displayName: 'Alice', createdAt: '2026-01-01T00:00:00Z' },
      { emoji: '👍', userId: 'user-2', displayName: 'Bob', createdAt: '2026-01-01T00:01:00Z' },
      { emoji: '❤️', userId: 'user-1', displayName: 'Alice', createdAt: '2026-01-01T00:02:00Z' }
    ];

    fixture.componentRef.setInput('reactions', mockReactions);
    fixture.componentRef.setInput('currentUserId', 'user-1');
    fixture.detectChanges();

    const chips = Array.from(fixture.nativeElement.querySelectorAll('.reaction-chip')) as HTMLButtonElement[];
    expect(chips.length).toBe(2);

    const thumbChip = chips.find(c => c.textContent?.includes('👍'));
    expect(thumbChip).toBeDefined();
    expect(thumbChip?.querySelector('.chip-count')?.textContent?.trim()).toBe('2');
    expect(thumbChip?.classList.contains('reacted-by-me')).toBe(true);
  });

  it('should emit toggleReaction when a chip is clicked', () => {
    let toggledEmoji: string | null = null;
    component.toggleReaction.subscribe(e => (toggledEmoji = e));

    const mockReactions: ReactionResponse[] = [
      { emoji: '🚀', userId: 'user-3', displayName: 'Carol', createdAt: '2026-01-01T00:00:00Z' }
    ];

    fixture.componentRef.setInput('reactions', mockReactions);
    fixture.detectChanges();

    const chips = Array.from(fixture.nativeElement.querySelectorAll('.reaction-chip')) as HTMLButtonElement[];
    const rocketChip = chips.find(c => c.textContent?.includes('🚀'));
    expect(rocketChip).toBeDefined();
    rocketChip?.click();

    expect(toggledEmoji).toBe('🚀');
  });
});
