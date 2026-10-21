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

export interface IncomingRequest {
  id: string;
  fromUser: ContactUserSummary;
  createdAt: string;
}

export interface IncomingRequestsResponse {
  content: IncomingRequest[];
}

export type RequestAction = 'ACCEPT' | 'DECLINE';

export interface RespondRequestPayload {
  action: RequestAction;
}

export interface AcceptRequestResponse {
  status: string;
  conversationId: string;
}
