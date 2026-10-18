import { Link } from 'react-router-dom'

/**
 * 404 Not Found fallback page.
 */
export default function NotFoundPage() {
  return (
    <div style={{ maxWidth: '480px', margin: '64px auto', padding: '24px' }}>
      <h1>404</h1>
      <h2>Page Not Found</h2>
      <p style={{ margin: '16px 0 24px', color: 'var(--text)' }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/"
        style={{
          display: 'inline-block',
          padding: '10px 20px',
          background: 'var(--accent)',
          color: '#fff',
          borderRadius: '6px',
          textDecoration: 'none',
          fontWeight: 500,
        }}
      >
        Return to Home
      </Link>
    </div>
  )
}
