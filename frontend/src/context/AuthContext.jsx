import { createContext, useCallback, useEffect, useState } from 'react'
import {
  setAccessToken as setApiAccessToken,
  setOnAuthFailure,
  setOnTokenUpdate,
} from '../services/api'
import authService from '../services/authService'
import { parseJwt } from '../utils/tokenUtils'

const USER_STORAGE_KEY = 'orbit_user'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [accessToken, setAccessTokenState] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const applyAccessToken = useCallback((token) => {
    setAccessTokenState(token)
    setApiAccessToken(token)
  }, [])

  const handleAuthFailure = useCallback(() => {
    applyAccessToken(null)
    setCurrentUser(null)
    localStorage.removeItem(USER_STORAGE_KEY)
  }, [applyAccessToken])

  const handleTokenRefreshed = useCallback(
    (newToken) => {
      applyAccessToken(newToken)
      if (newToken) {
        const claims = parseJwt(newToken)
        setCurrentUser((prev) => {
          if (prev) return prev
          try {
            const raw = localStorage.getItem(USER_STORAGE_KEY)
            return raw ? JSON.parse(raw) : { id: claims?.sub }
          } catch {
            return { id: claims?.sub }
          }
        })
      }
    },
    [applyAccessToken],
  )

  useEffect(() => {
    setOnTokenUpdate(handleTokenRefreshed)
    setOnAuthFailure(handleAuthFailure)

    let isMounted = true

    const bootstrapAuth = async () => {
      try {
        const data = await authService.refresh()
        if (isMounted && data?.accessToken) {
          applyAccessToken(data.accessToken)
          const claims = parseJwt(data.accessToken)
          let storedUser = null
          try {
            const raw = localStorage.getItem(USER_STORAGE_KEY)
            if (raw) storedUser = JSON.parse(raw)
          } catch {
            storedUser = null
          }
          setCurrentUser(storedUser || { id: claims?.sub })
        }
      } catch {
        if (isMounted) {
          handleAuthFailure()
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    bootstrapAuth()

    return () => {
      isMounted = false
    }
  }, [applyAccessToken, handleAuthFailure, handleTokenRefreshed])

  const login = useCallback(
    async (credentials) => {
      const data = await authService.login(credentials)
      applyAccessToken(data.accessToken)
      setCurrentUser(data.user)
      if (data.user) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user))
      }
      return data
    },
    [applyAccessToken],
  )

  const register = useCallback(
    async (payload) => {
      const data = await authService.register(payload)
      applyAccessToken(data.accessToken)
      setCurrentUser(data.user)
      if (data.user) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user))
      }
      return data
    },
    [applyAccessToken],
  )

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } finally {
      handleAuthFailure()
    }
  }, [handleAuthFailure])

  const value = {
    currentUser,
    accessToken,
    isLoading,
    isAuthenticated: Boolean(accessToken && currentUser),
    login,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext
