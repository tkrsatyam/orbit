export type MessageType = 'TEXT' | 'IMAGE' | 'FILE';

export type MessageDeliveryStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface MessageResponse {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  type: MessageType;
  content: string;
  deleted: boolean;
  edited: boolean;
  createdAt: string;
}

export interface SendMessagePayload {
  content: string;
  type?: MessageType;
  idempotencyKey?: string;
}

export interface ChatMessageItem extends MessageResponse {
  deliveryStatus?: MessageDeliveryStatus;
  idempotencyKey?: string;
}
