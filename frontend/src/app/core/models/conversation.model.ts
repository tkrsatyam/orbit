export type ConversationType = 'DIRECT' | 'GROUP';

export interface ParticipantSummary {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  online: boolean;
}

export interface GroupSummary {
  id: string;
  name: string;
  avatarUrl?: string | null;
  memberCount: number;
}

export interface LastMessageSummary {
  messageId?: string | null;
  content: string;
  senderId?: string | null;
  senderDisplayName?: string | null;
  sentAt: string;
}

export interface ConversationItem {
  id: string;
  type: ConversationType;
  participant?: ParticipantSummary | null;
  group?: GroupSummary | null;
  lastMessage?: LastMessageSummary | null;
  unreadCount: number;
  muted: boolean;
}

export interface ConversationListResponse {
  content: ConversationItem[];
}
