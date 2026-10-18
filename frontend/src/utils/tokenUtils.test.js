import assert from 'node:assert/strict'
import test from 'node:test'
import { isTokenExpired, parseJwt, parseJwtExpiry } from './tokenUtils.js'

// Helper to create un-signed JWT structure: header.payload.signature
function createMockJwt(payloadObj) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url')
  const signature = 'mockSignature'
  return `${header}.${payload}.${signature}`
}

test('parseJwt: correctly parses valid JWT payload', () => {
  const token = createMockJwt({ sub: 'user_123', exp: 1792343553, role: 'USER' })
  const claims = parseJwt(token)
  assert.equal(claims.sub, 'user_123')
  assert.equal(claims.exp, 1792343553)
  assert.equal(claims.role, 'USER')
})

test('parseJwt: returns null for invalid or malformed tokens', () => {
  assert.equal(parseJwt(null), null)
  assert.equal(parseJwt(''), null)
  assert.equal(parseJwt('invalid.token'), null)
  assert.equal(parseJwt('not-a-jwt'), null)
  assert.equal(parseJwt(12345), null)
})

test('parseJwtExpiry: returns expiry timestamp in milliseconds', () => {
  const expSeconds = Math.floor(Date.now() / 1000) + 3600
  const token = createMockJwt({ sub: 'user_123', exp: expSeconds })
  const expiryMs = parseJwtExpiry(token)
  assert.equal(expiryMs, expSeconds * 1000)
})

test('parseJwtExpiry: returns null when exp claim is missing', () => {
  const token = createMockJwt({ sub: 'user_123' })
  assert.equal(parseJwtExpiry(token), null)
})

test('isTokenExpired: returns false for active future token', () => {
  const futureExp = Math.floor(Date.now() / 1000) + 120
  const token = createMockJwt({ sub: 'user_123', exp: futureExp })
  assert.equal(isTokenExpired(token, 10), false)
})

test('isTokenExpired: returns true for expired token', () => {
  const pastExp = Math.floor(Date.now() / 1000) - 60
  const token = createMockJwt({ sub: 'user_123', exp: pastExp })
  assert.equal(isTokenExpired(token, 10), true)
})

test('isTokenExpired: returns true when token is within buffer window', () => {
  const nearExp = Math.floor(Date.now() / 1000) + 5 // expires in 5s
  const token = createMockJwt({ sub: 'user_123', exp: nearExp })
  assert.equal(isTokenExpired(token, 10), true) // buffer is 10s
})
