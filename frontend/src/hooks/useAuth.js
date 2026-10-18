import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'

/**
 * Hook to access authentication state and actions.
 *
 * @returns {object} Authentication context value
 * @throws {Error} If called outside of an AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default useAuth
