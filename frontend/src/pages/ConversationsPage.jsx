import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/**
 * Route-level page for Conversations (main authenticated view).
 */
export default function ConversationsPage() {
  const { currentUser, logout } = useAuth()

  return (
    <div style={{ maxWidth: '720px', margin: '48px auto', padding: '24px', textAlign: 'left' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2>Conversations</h2>
          <p style={{ color: 'var(--text)' }}>
            Signed in as <strong>{currentUser?.displayName || currentUser?.email || currentUser?.id}</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          style={{
            padding: '8px 16px',
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            cursor: 'pointer',
            color: 'var(--text-h)',
            fontWeight: 500,
          }}
        >
          Sign out
        </button>
      </header>

      <section style={{ padding: '24px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--code-bg)' }}>
        <p style={{ marginBottom: '16px' }}>
          This is the authenticated home page. Messages and conversations will be loaded here.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link
            to="/discover"
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Discover Groups
          </Link>
          <Link
            to="/groups/demo-group"
            style={{
              padding: '8px 16px',
              border: '1px solid var(--border)',
              color: 'var(--text-h)',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Sample Protected Group
          </Link>
        </div>
      </section>
    </div>
  )
}
