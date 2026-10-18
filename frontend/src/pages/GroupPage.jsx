import { Link, useParams } from 'react-router-dom'

/**
 * Route-level page for group conversation and details.
 */
export default function GroupPage() {
  const { id } = useParams()

  return (
    <div style={{ maxWidth: '720px', margin: '48px auto', padding: '24px', textAlign: 'left' }}>
      <header style={{ marginBottom: '24px' }}>
        <h2>Group: {id}</h2>
        <p style={{ color: 'var(--text)' }}>
          This is a protected group view. Only authenticated users can access this page.
        </p>
      </header>

      <div>
        <Link to="/" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          &larr; Back to conversations
        </Link>
      </div>
    </div>
  )
}
