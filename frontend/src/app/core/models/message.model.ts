export type MessageType = 'TEXT' | 'IMAGE' | 'FILE';

export type MessageDeliveryStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export type MessageDeleteMode = 'FOR_EVERYONE' | 'FOR_ME';

export interface MessageResponse {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  type: MessageType;
  content: string;
  deleted: boolean;
  deletedFor?: string[];
  edited: boolean;
  editedAt?: string | null;
  createdAt: string;
  readBy?: string[];
  deliveryStatus?: MessageDeliveryStatus;
}

export interface MessageHistoryResponse {
  content: MessageResponse[];
  hasMore: boolean;
  nextCursor?: string | null;
}

export interface SendMessagePayload {
  content: string;
  type?: MessageType;
  idempotencyKey?: string;
}

export interface EditMessagePayload {
  content: string;
}

export interface MessageEditedEventPayload {
  messageId: string;
  content: string;
  editedAt: string;
}

export interface MessageDeletedEventPayload {
  messageId: string;
}

export interface ReadReceiptRequestPayload {
  messageId: string;
}

export interface ReadReceiptEventPayload {
  messageId: string;
  userId: string;
  readAt: string;
}

export interface TypingRequestPayload {
  typing: boolean;
}

export interface TypingEventPayload {
  userId: string;
  displayName: string;
  typing: boolean;
}

export interface PresenceEventPayload {
  userId: string;
  online: boolean;
  lastSeen?: string | null;
}

export interface ChatMessageItem extends MessageResponse {
  deliveryStatus?: MessageDeliveryStatus;
  idempotencyKey?: string;
}
