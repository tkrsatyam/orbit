import { isTokenExpired, parseJwt, parseJwtExpiry } from './token-utils';

function createMockJwt(payloadObj: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const payload = btoa(JSON.stringify(payloadObj))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const signature = 'mockSignature';
  return `${header}.${payload}.${signature}`;
}

describe('token-utils', () => {
  describe('parseJwt', () => {
    it('should correctly parse valid JWT payload', () => {
      const token = createMockJwt({ sub: 'user_123', exp: 1792343553, role: 'USER' });
      const claims = parseJwt(token);
      expect(claims).not.toBeNull();
      expect(claims?.sub).toBe('user_123');
      expect(claims?.['exp']).toBe(1792343553);
      expect(claims?.['role']).toBe('USER');
    });

    it('should return null for invalid, non-string, or malformed tokens', () => {
      expect(parseJwt(null)).toBeNull();
      expect(parseJwt(undefined)).toBeNull();
      expect(parseJwt('')).toBeNull();
      expect(parseJwt('invalid.token')).toBeNull();
      expect(parseJwt('not-a-jwt')).toBeNull();
    });
  });

  describe('parseJwtExpiry', () => {
    it('should return expiry timestamp in milliseconds', () => {
      const expSeconds = Math.floor(Date.now() / 1000) + 3600;
      const token = createMockJwt({ sub: 'user_123', exp: expSeconds });
      const expiryMs = parseJwtExpiry(token);
      expect(expiryMs).toBe(expSeconds * 1000);
    });

    it('should return null when exp claim is missing or invalid', () => {
      const tokenWithoutExp = createMockJwt({ sub: 'user_123' });
      expect(parseJwtExpiry(tokenWithoutExp)).toBeNull();
      expect(parseJwtExpiry(null)).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for active future token', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 120;
      const token = createMockJwt({ sub: 'user_123', exp: futureExp });
      expect(isTokenExpired(token, 10)).toBe(false);
    });

    it('should return true for expired token', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 60;
      const token = createMockJwt({ sub: 'user_123', exp: pastExp });
      expect(isTokenExpired(token, 10)).toBe(true);
    });

    it('should return true when token is within buffer window', () => {
      const nearExp = Math.floor(Date.now() / 1000) + 5;
      const token = createMockJwt({ sub: 'user_123', exp: nearExp });
      expect(isTokenExpired(token, 10)).toBe(true);
    });

    it('should return true when token is null or invalid', () => {
      expect(isTokenExpired(null)).toBe(true);
      expect(isTokenExpired('')).toBe(true);
    });
  });
});
