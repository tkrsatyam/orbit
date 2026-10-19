export type ConnectionStatus = 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'CONNECTED' | 'BLOCKED';

export interface UserProfile {
  id: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  connectionStatus?: ConnectionStatus;
  available?: boolean;
}
