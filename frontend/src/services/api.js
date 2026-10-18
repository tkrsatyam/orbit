import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

let currentAccessToken = null
let refreshPromise = null
let onTokenUpdateCallback = null
let onAuthFailureCallback = null

export const setAccessToken = (token) => {
  currentAccessToken = token
}

export const getAccessToken = () => currentAccessToken

export const setOnTokenUpdate = (callback) => {
  onTokenUpdateCallback = callback
}

export const setOnAuthFailure = (callback) => {
  onAuthFailureCallback = callback
}

/**
 * Refreshes the access token using the httpOnly cookie.
 * Deduplicates concurrent calls so only one network request is made.
 *
 * @returns {Promise<{accessToken: string}>}
 */
export const refreshSession = async () => {
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = axios
    .post(
      `${API_BASE_URL}/api/v1/auth/refresh`,
      {},
      { withCredentials: true },
    )
    .then((response) => {
      const newAccessToken = response.data.accessToken
      setAccessToken(newAccessToken)

      if (onTokenUpdateCallback) {
        onTokenUpdateCallback(newAccessToken)
      }

      return response.data
    })
    .catch((error) => {
      setAccessToken(null)

      if (onAuthFailureCallback) {
        onAuthFailureCallback(error)
      }

      return Promise.reject(error)
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config) => {
    if (currentAccessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${currentAccessToken}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (!error.response || error.response.status !== 401 || !originalRequest) {
      return Promise.reject(error)
    }

    const requestUrl = originalRequest.url || ''
    const isAuthEndpoint =
      requestUrl.includes('/api/v1/auth/login') ||
      requestUrl.includes('/api/v1/auth/register') ||
      requestUrl.includes('/api/v1/auth/refresh')

    if (isAuthEndpoint || originalRequest._retry) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      const data = await refreshSession()
      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
      return api(originalRequest)
    } catch (refreshError) {
      return Promise.reject(refreshError)
    }
  },
)

export default api
