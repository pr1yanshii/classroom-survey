import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.tsx'
import { AuthProvider } from './lib/auth.tsx'
import { isConfigured } from './lib/supabase.ts'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isConfigured ? (
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    ) : (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="mb-3 text-2xl font-semibold">Supabase is not configured</h1>
        <p>
          Copy <code>.env.example</code> to <code>.env.local</code>, set{' '}
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart the
          dev server.
        </p>
      </main>
    )}
  </StrictMode>,
)
