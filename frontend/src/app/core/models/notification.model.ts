export interface NotificationPayload {
  type: 'UNREAD_COUNT' | string;
  conversationId: string;
  count: number;
}
