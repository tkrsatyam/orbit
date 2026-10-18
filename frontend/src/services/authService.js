import api, { refreshSession } from './api'

/**
 * Registers a new user with email, password, and display name.
 *
 * @param {object} payload - Registration details
 * @param {string} payload.email
 * @param {string} payload.password
 * @param {string} payload.displayName
 * @returns {Promise<{accessToken: string, user: object}>}
 */
export async function register({ email, password, displayName }) {
  const response = await api.post('/api/v1/auth/register', {
    email,
    password,
    displayName,
  })
  return response.data
}

/**
 * Authenticates an existing user with email and password.
 *
 * @param {object} credentials
 * @param {string} credentials.email
 * @param {string} credentials.password
 * @returns {Promise<{accessToken: string, user: object}>}
 */
export async function login({ email, password }) {
  const response = await api.post('/api/v1/auth/login', {
    email,
    password,
  })
  return response.data
}

/**
 * Refreshes the session using the httpOnly refresh token cookie.
 * Delegates to the deduplicated refreshSession in api.js.
 *
 * @returns {Promise<{accessToken: string}>}
 */
export async function refresh() {
  return refreshSession()
}

/**
 * Invalidates the current session and clears the refresh token cookie.
 *
 * @returns {Promise<{message: string}>}
 */
export async function logout() {
  const response = await api.post('/api/v1/auth/logout')
  return response.data
}

const authService = {
  register,
  login,
  refresh,
  logout,
}

export default authService
