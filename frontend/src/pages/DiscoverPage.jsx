import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/**
 * Route-level page for public group discovery.
 * Accessible to both unauthenticated guests and signed-in members.
 */
export default function DiscoverPage() {
  const { isAuthenticated, currentUser, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '720px', margin: '48px auto', padding: '24px', textAlign: 'left' }}>
      <header style={{ marginBottom: '24px' }}>
        <h2>Discover Groups</h2>
        <p style={{ color: 'var(--text)' }}>
          Explore public spaces and connect with members on Orbit.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ padding: '20px', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <h3>Orbit Community</h3>
          <p style={{ margin: '8px 0 16px', color: 'var(--text)' }}>
            General discussions, announcements, and project showcase.
          </p>

          {isAuthenticated ? (
            <button
              type="button"
              style={{
                padding: '8px 16px',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Join Group
            </button>
          ) : (
            <Link
              to="/register"
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Register to join
            </Link>
          )}
        </div>
      </div>

      <div style={{ marginTop: '32px' }}>
        <Link to="/" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          &larr; Back to conversations
        </Link>
        {isAuthenticated && (
          <span style={{ marginLeft: '16px', fontSize: '14px', color: 'var(--text)' }}>
            Logged in as {currentUser?.displayName || currentUser?.email || currentUser?.id}
          </span>
        )}
      </div>
    </div>
  )
}
