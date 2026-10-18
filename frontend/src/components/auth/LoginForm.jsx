import { useState } from 'react'

/**
 * Presentational component for user login form.
 *
 * @param {object} props
 * @param {Function} props.onSubmit - Called with { email, password }
 * @param {boolean} props.isLoading - Whether submission is in progress
 * @param {string|null} props.error - Error message to display
 */
export default function LoginForm({ onSubmit, isLoading, error }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!email || !password || isLoading) return
    onSubmit({ email, password })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '360px', margin: '0 auto', textAlign: 'left' }}>
      {error && (
        <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label htmlFor="login-email" style={{ fontSize: '14px', fontWeight: 500 }}>
          Email
        </label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          required
          autoComplete="email"
          style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '15px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label htmlFor="login-password" style={{ fontSize: '14px', fontWeight: 500 }}>
          Password
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="current-password"
          style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '15px' }}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        style={{
          padding: '12px',
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '15px',
          fontWeight: 600,
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.7 : 1,
        }}
      >
        {isLoading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  )
}
