import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../lib/auth.tsx'

export default function InstructorLayout({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth()
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/dashboard" className="text-lg font-semibold">
            Classroom Survey
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{session?.user.email}</span>
            <button type="button" className="btn-secondary" onClick={signOut}>
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}
