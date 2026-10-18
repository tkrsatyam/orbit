/**
 * Decodes the payload of a JSON Web Token.
 *
 * @param {string} token - The raw JWT string
 * @returns {object|null} The decoded payload claims or null if invalid
 */
export function parseJwt(token) {
  if (!token || typeof token !== 'string') {
    return null
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    return null
  }

  try {
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

/**
 * Returns the expiration timestamp of a JWT in milliseconds.
 *
 * @param {string} token - The raw JWT string
 * @returns {number|null} Expiration time in milliseconds or null if missing/invalid
 */
export function parseJwtExpiry(token) {
  const claims = parseJwt(token)
  if (!claims || typeof claims.exp !== 'number') {
    return null
  }
  return claims.exp * 1000
}

/**
 * Checks whether a JWT is expired or within a safety buffer of expiring.
 *
 * @param {string} token - The raw JWT string
 * @param {number} bufferSeconds - Safety window in seconds (default 10)
 * @returns {boolean} True if the token is null, invalid, or expired
 */
export function isTokenExpired(token, bufferSeconds = 10) {
  const expiryMs = parseJwtExpiry(token)
  if (!expiryMs) {
    return true
  }
  return Date.now() >= expiryMs - bufferSeconds * 1000
}
