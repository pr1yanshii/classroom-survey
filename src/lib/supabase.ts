import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** False when .env.local is missing; main.tsx shows a setup message instead of the app. */
export const isConfigured = Boolean(url && anonKey)

export const supabase = createClient(url || 'http://localhost', anonKey || 'not-configured')
