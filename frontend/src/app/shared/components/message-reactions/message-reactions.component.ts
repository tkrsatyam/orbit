import { Component, computed, input, output } from '@angular/core';
import { ReactionResponse } from '../../../core/models/message.model';

export interface ReactionGroup {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  userNames: string[];
}

@Component({
  selector: 'app-message-reactions',
  standalone: true,
  imports: [],
  templateUrl: './message-reactions.component.html',
  styleUrl: './message-reactions.component.scss'
})
export class MessageReactionsComponent {
  readonly reactions = input<ReactionResponse[]>([]);
  readonly currentUserId = input<string>('');
  readonly messageId = input<string>('');

  readonly toggleReaction = output<string>();

  readonly groupedReactions = computed<ReactionGroup[]>(() => {
    const list = this.reactions() || [];
    if (list.length === 0) {
      return [];
    }

    const myId = this.currentUserId();
    const map = new Map<string, { count: number; reactedByMe: boolean; userNames: string[] }>();

    for (const r of list) {
      const existing = map.get(r.emoji) || { count: 0, reactedByMe: false, userNames: [] };
      existing.count += 1;
      if (r.userId === myId) {
        existing.reactedByMe = true;
      }
      if (r.displayName && !existing.userNames.includes(r.displayName)) {
        existing.userNames.push(r.displayName);
      }
      map.set(r.emoji, existing);
    }

    return Array.from(map.entries()).map(([emoji, data]) => ({
      emoji,
      count: data.count,
      reactedByMe: data.reactedByMe,
      userNames: data.userNames
    }));
  });

  onToggle(emoji: string): void {
    this.toggleReaction.emit(emoji);
  }

  tooltipFor(group: ReactionGroup): string {
    const names = group.userNames.length > 0 ? group.userNames.join(', ') : `${group.count} people`;
    return `${names} reacted with ${group.emoji}`;
  }
}
