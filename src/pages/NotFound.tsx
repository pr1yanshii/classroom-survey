import { Link } from 'react-router'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="btn-secondary">
        Go home
      </Link>
    </main>
  )
}
