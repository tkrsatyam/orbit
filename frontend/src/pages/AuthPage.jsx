import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import LoginForm from '../components/auth/LoginForm'
import RegisterForm from '../components/auth/RegisterForm'
import { useAuth } from '../hooks/useAuth'

/**
 * Route-level page for user authentication (Login and Registration).
 */
export default function AuthPage({ initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode)
  const [formError, setFormError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { isAuthenticated, login, register } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const targetPath = location.state?.from?.pathname || '/'

  if (isAuthenticated) {
    return <Navigate to={targetPath} replace />
  }

  const handleLogin = async (credentials) => {
    setFormError(null)
    setIsSubmitting(true)
    try {
      await login(credentials)
      navigate(targetPath, { replace: true })
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        'Unable to log in. Please check your credentials.'
      setFormError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegister = async (payload) => {
    setFormError(null)
    setIsSubmitting(true)
    try {
      await register(payload)
      navigate(targetPath, { replace: true })
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        'Registration failed. Please check your details.'
      setFormError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: '440px', margin: '48px auto', padding: '32px 24px' }}>
      <h1>Orbit</h1>
      <p style={{ marginBottom: '24px', color: 'var(--text)' }}>
        {mode === 'login' ? 'Welcome back! Sign in to continue.' : 'Create an account to join Orbit.'}
      </p>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={() => {
            setMode('login')
            setFormError(null)
          }}
          style={{
            flex: 1,
            padding: '10px',
            background: 'none',
            border: 'none',
            borderBottom: mode === 'login' ? '2px solid var(--accent)' : '2px solid transparent',
            color: mode === 'login' ? 'var(--text-h)' : 'var(--text)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register')
            setFormError(null)
          }}
          style={{
            flex: 1,
            padding: '10px',
            background: 'none',
            border: 'none',
            borderBottom: mode === 'register' ? '2px solid var(--accent)' : '2px solid transparent',
            color: mode === 'register' ? 'var(--text-h)' : 'var(--text)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Register
        </button>
      </div>

      {mode === 'login' ? (
        <LoginForm onSubmit={handleLogin} isLoading={isSubmitting} error={formError} />
      ) : (
        <RegisterForm onSubmit={handleRegister} isLoading={isSubmitting} error={formError} />
      )}
    </div>
  )
}
