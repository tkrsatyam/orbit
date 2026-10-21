export type ContactStatus = 'PENDING' | 'CONNECTED' | 'BLOCKED';

export interface ContactUserSummary {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface ConnectionRequestResponse {
  id: string;
  status: ContactStatus;
  toUser: ContactUserSummary;
  createdAt: string;
}

export interface SendRequestDto {
  targetUserId: string;
}
