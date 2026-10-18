import { useState } from 'react'

/**
 * Presentational component for user registration form.
 *
 * @param {object} props
 * @param {Function} props.onSubmit - Called with { email, password, displayName }
 * @param {boolean} props.isLoading - Whether submission is in progress
 * @param {string|null} props.error - Error message to display
 */
export default function RegisterForm({ onSubmit, isLoading, error }) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!displayName || !email || !password || isLoading) return
    onSubmit({ displayName, email, password })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '360px', margin: '0 auto', textAlign: 'left' }}>
      {error && (
        <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label htmlFor="register-displayName" style={{ fontSize: '14px', fontWeight: 500 }}>
          Display Name
        </label>
        <input
          id="register-displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Satyam Kumar"
          required
          minLength={2}
          maxLength={50}
          autoComplete="name"
          style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '15px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label htmlFor="register-email" style={{ fontSize: '14px', fontWeight: 500 }}>
          Email
        </label>
        <input
          id="register-email"
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
        <label htmlFor="register-password" style={{ fontSize: '14px', fontWeight: 500 }}>
          Password
        </label>
        <input
          id="register-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          minLength={8}
          autoComplete="new-password"
          style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '15px' }}
        />
        <span style={{ fontSize: '12px', color: 'var(--text)' }}>
          At least 8 chars with uppercase, lowercase, number, and special symbol.
        </span>
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
        {isLoading ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  )
}
