import { Link } from 'react-router'

export default function Landing() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Classroom Survey</h1>
        <p className="mt-3 text-lg text-slate-600">Quick in-class understanding checks</p>
        <Link to="/login" className="btn-primary mt-8">
          Instructor Login
        </Link>
      </div>
    </main>
  )
}
