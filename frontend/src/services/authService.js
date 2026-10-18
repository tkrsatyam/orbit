import axios from 'axios'
import api from './api'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

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
 * Uses a raw axios instance to bypass request/response interceptors.
 *
 * @returns {Promise<{accessToken: string}>}
 */
export async function refresh() {
  const response = await axios.post(
    `${API_BASE_URL}/api/v1/auth/refresh`,
    {},
    { withCredentials: true },
  )
  return response.data
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
