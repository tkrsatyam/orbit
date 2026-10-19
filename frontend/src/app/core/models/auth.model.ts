export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  user?: User | null;
  message?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
}

export interface JwtClaims {
  sub: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}
