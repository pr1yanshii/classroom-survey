// Real Postgres (PGlite/WASM) with Supabase-like roles and default privileges,
// running the project's actual migration files.
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS = join(import.meta.dirname, '../../supabase/migrations')

export async function createDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public to anon, authenticated;
    -- Supabase's defaults: API roles get everything; RLS + migrations restrict.
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
  `)
  for (const file of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    // pgcrypto is preinstalled on Supabase; gen_random_uuid() is core in PG13+.
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8').replace(/create extension[^;]*;/i, '')
    await db.exec(sql)
  }
  return db
}

/** Runs a query as a Supabase API role so GRANTs and RLS apply. */
export async function asRole<T = Record<string, unknown>>(
  db: PGlite,
  role: 'anon' | 'authenticated',
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`)
    return (await tx.query<T>(sql, params)).rows
  })
}
