import { createContext, useCallback, useEffect, useState } from 'react'
import {
  setAccessToken as setApiAccessToken,
  setOnAuthFailure,
  setOnTokenUpdate,
} from '../services/api'
import authService from '../services/authService'
import { parseJwt } from '../utils/tokenUtils'

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
  }, [applyAccessToken])

  const handleTokenRefreshed = useCallback(
    (newToken) => {
      applyAccessToken(newToken)
      if (newToken) {
        const claims = parseJwt(newToken)
        setCurrentUser((prev) => (prev ? prev : { id: claims?.sub }))
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
          setCurrentUser({ id: claims?.sub })
        }
      } catch {
        if (isMounted) {
          applyAccessToken(null)
          setCurrentUser(null)
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
      setOnTokenUpdate(null)
      setOnAuthFailure(null)
    }
  }, [applyAccessToken, handleAuthFailure, handleTokenRefreshed])

  const login = useCallback(
    async (credentials) => {
      const data = await authService.login(credentials)
      applyAccessToken(data.accessToken)
      setCurrentUser(data.user)
      return data
    },
    [applyAccessToken],
  )

  const register = useCallback(
    async (payload) => {
      const data = await authService.register(payload)
      applyAccessToken(data.accessToken)
      setCurrentUser(data.user)
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
