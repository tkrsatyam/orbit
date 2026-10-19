import { JwtClaims } from '../../core/models/auth.model';

/**
 * Decodes the payload of a JSON Web Token.
 *
 * @param token - The raw JWT string
 * @returns The decoded payload claims or null if invalid
 */
export function parseJwt(token: string | null | undefined): JwtClaims | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const jsonPayload = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload) as JwtClaims;
  } catch {
    return null;
  }
}

/**
 * Returns the expiration timestamp of a JWT in milliseconds.
 *
 * @param token - The raw JWT string
 * @returns Expiration time in milliseconds or null if missing/invalid
 */
export function parseJwtExpiry(token: string | null | undefined): number | null {
  const claims = parseJwt(token);
  if (!claims || typeof claims['exp'] !== 'number') {
    return null;
  }
  return claims['exp'] * 1000;
}

/**
 * Checks whether a JWT is expired or within a safety buffer of expiring.
 *
 * @param token - The raw JWT string
 * @param bufferSeconds - Safety window in seconds (default 10)
 * @returns True if the token is null, invalid, or expired
 */
export function isTokenExpired(token: string | null | undefined, bufferSeconds = 10): boolean {
  const expiryMs = parseJwtExpiry(token);
  if (!expiryMs) {
    return true;
  }
  return Date.now() >= expiryMs - bufferSeconds * 1000;
}
