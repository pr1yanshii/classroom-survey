// Local stand-in for Supabase used by the Playwright tests.
//
// Implements only the subset of GoTrue (auth) and PostgREST (REST + RPC) that this app
// calls. Every query runs on PGlite (real Postgres) with the project's migrations, as
// the `anon` or `authenticated` role, so grants, RLS policies and RPC logic are real.
// It is NOT a full PostgREST/GoTrue; tests/live covers the real Supabase services.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { PGlite } from '@electric-sql/pglite'
import { createDb } from '../support/pglite.ts'

export const INSTRUCTOR = { email: 'instructor@example.com', password: 'correct-horse-battery' }
const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54329)
const USER = {
  id: '11111111-1111-4111-8111-111111111111',
  email: INSTRUCTOR.email,
  role: 'authenticated',
  aud: 'authenticated',
}

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const ACCESS_TOKEN = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, email: USER.email, role: 'authenticated', aud: 'authenticated', exp: 4102444800 })}.sig`

const CHILDREN: Record<string, Record<string, string>> = {
  surveys: { questions: 'survey_id' },
  questions: { choices: 'question_id' },
}
const IDENT = /^[a-z_]+$/

let db: PGlite

function ident(name: string): string {
  if (!IDENT.test(name)) throw Object.assign(new Error(`bad identifier ${name}`), { status: 400 })
  return name
}

function splitTop(s: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

/** PostgREST select string -> jsonb expression for alias `a`. */
function selectExpr(table: string, select: string, a: string, depth = 0): string {
  const parts = [`'{}'::jsonb`]
  for (const item of splitTop(select)) {
    const m = item.match(/^([a-z_]+)\((.*)\)$/s)
    if (item === '*') parts.push(`to_jsonb(${a}.*)`)
    else if (m) {
      const child = ident(m[1])
      const fk = CHILDREN[table]?.[child]
      if (!fk) throw Object.assign(new Error(`no relation ${table}->${child}`), { status: 400 })
      const ca = `t${depth + 1}`
      parts.push(
        `jsonb_build_object('${child}', (select coalesce(jsonb_agg(${selectExpr(child, m[2], ca, depth + 1)}), '[]'::jsonb) from ${child} ${ca} where ${ca}.${fk} = ${a}.id))`,
      )
    } else parts.push(`jsonb_build_object('${ident(item)}', ${a}.${ident(item)})`)
  }
  return parts.join(' || ')
}

function whereClause(params: URLSearchParams, values: unknown[]): string {
  const conds: string[] = []
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'columns'].includes(key)) continue
    const col = ident(key)
    const eq = raw.match(/^eq\.(.*)$/s)
    const inn = raw.match(/^in\.\((.*)\)$/s)
    if (eq) {
      values.push(eq[1])
      conds.push(`t0.${col}::text = $${values.length}`)
    } else if (inn) {
      values.push(inn[1] ? inn[1].split(',').map((v) => v.replace(/^"|"$/g, '')) : [])
      conds.push(`t0.${col}::text = any($${values.length}::text[])`)
    } else throw Object.assign(new Error(`unsupported filter ${key}=${raw}`), { status: 400 })
  }
  return conds.length ? `where ${conds.join(' and ')}` : ''
}

function orderClause(order: string | null): string {
  if (!order) return ''
  return (
    'order by ' +
    order
      .split(',')
      .map((o) => {
        const [col, dir] = o.split('.')
        return `t0.${ident(col)} ${dir === 'desc' ? 'desc' : 'asc'}`
      })
      .join(', ')
  )
}

async function asRole<T>(role: string, fn: (q: PGlite['query']) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`)
    return fn(tx.query.bind(tx) as PGlite['query'])
  })
}

function send(
  res: ServerResponse,
  status: number,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  res.writeHead(status, { 'content-type': 'application/json', ...headers })
  res.end(body === undefined ? undefined : JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const text = Buffer.concat(chunks).toString()
  return text ? JSON.parse(text) : null
}

function pgError(e: any) {
  const status =
    e.status ??
    (e.code === '42501' ? 403 : e.code === '23505' ? 409 : e.code === 'P0001' ? 400 : 400)
  return [
    status,
    { code: e.code ?? 'TEST', message: e.message, details: null, hint: null },
  ] as const
}

async function handleAuth(req: IncomingMessage, res: ServerResponse, url: URL) {
  const session = {
    access_token: ACCESS_TOKEN,
    token_type: 'bearer',
    expires_in: 3600 * 24,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
    refresh_token: 'refresh-token',
    user: USER,
  }
  if (url.pathname === '/auth/v1/token') {
    const body = await readBody(req)
    if (url.searchParams.get('grant_type') === 'refresh_token') return send(res, 200, session)
    if (body?.email === INSTRUCTOR.email && body?.password === INSTRUCTOR.password)
      return send(res, 200, session)
    return send(res, 400, {
      code: 'invalid_credentials',
      error_code: 'invalid_credentials',
      msg: 'Invalid login credentials',
      message: 'Invalid login credentials',
    })
  }
  if (url.pathname === '/auth/v1/user') return send(res, 200, USER)
  if (url.pathname === '/auth/v1/logout') return send(res, 204)
  return send(res, 404, { message: 'not found' })
}

async function handleRest(req: IncomingMessage, res: ServerResponse, url: URL, role: string) {
  const path = url.pathname.replace('/rest/v1/', '')

  if (path.startsWith('rpc/')) {
    const fn = ident(path.slice(4))
    const args = (await readBody(req)) ?? {}
    const [meta] = (
      await db.query<{ proretset: boolean }>(`select proretset from pg_proc where proname = $1`, [
        fn,
      ])
    ).rows
    if (!meta) return send(res, 404, { code: 'PGRST202', message: `function ${fn} not found` })
    const names = Object.keys(args).map(ident)
    const values = names.map((n) =>
      args[n] !== null && typeof args[n] === 'object' ? JSON.stringify(args[n]) : args[n],
    )
    const call = `${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')})`
    const rows = await asRole(
      role,
      async (q) =>
        (await q<any>(meta.proretset ? `select * from ${call}` : `select ${call} as v`, values))
          .rows,
    )
    return send(res, 200, meta.proretset ? rows : (rows[0]?.v ?? null))
  }

  const table = ident(path)
  const values: unknown[] = []
  const where = whereClause(url.searchParams, values)

  if (
    req.method === 'HEAD' ||
    (req.method === 'GET' && /count=exact/.test(String(req.headers.prefer)))
  ) {
    const [{ n }] = await asRole(
      role,
      async (q) =>
        (await q<{ n: number }>(`select count(*)::int n from ${table} t0 ${where}`, values)).rows,
    )
    return send(res, 200, req.method === 'HEAD' ? undefined : [], {
      'content-range': n === 0 ? '*/0' : `0-${n - 1}/${n}`,
    })
  }

  if (req.method === 'GET') {
    const select = url.searchParams.get('select') ?? '*'
    const limit = url.searchParams.get('limit')
    const offset = url.searchParams.get('offset')
    const sql = `select ${selectExpr(table, select, 't0')} as row from ${table} t0 ${where} ${orderClause(url.searchParams.get('order'))} ${limit ? `limit ${Number(limit)}` : ''} ${offset ? `offset ${Number(offset)}` : ''}`
    const rows = await asRole(role, async (q) => (await q<{ row: unknown }>(sql, values)).rows)
    return send(
      res,
      200,
      rows.map((r) => r.row),
    )
  }

  if (req.method === 'PATCH') {
    const body = await readBody(req)
    const sets = Object.keys(body).map((k) => {
      values.push(body[k])
      return `${ident(k)} = $${values.length}`
    })
    await asRole(role, (q) => q(`update ${table} t0 set ${sets.join(', ')} ${where}`, values))
    return send(res, 204)
  }

  if (req.method === 'DELETE') {
    await asRole(role, (q) => q(`delete from ${table} t0 ${where}`, values))
    return send(res, 204)
  }

  return send(res, 501, { message: `${req.method} not supported by test server` })
}

export async function start(port = PORT) {
  db = await createDb()
  const server = createServer(async (req, res) => {
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('access-control-allow-headers', '*')
    res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,DELETE,HEAD,OPTIONS')
    res.setHeader('access-control-expose-headers', 'content-range')
    if (req.method === 'OPTIONS') return send(res, 204)
    const url = new URL(req.url ?? '/', `http://localhost:${port}`)
    try {
      if (url.pathname === '/__reset' && req.method === 'POST') {
        db = await createDb()
        return send(res, 204)
      }
      if (url.pathname.startsWith('/auth/v1/')) return await handleAuth(req, res, url)
      if (url.pathname.startsWith('/rest/v1/')) {
        const role =
          req.headers.authorization === `Bearer ${ACCESS_TOKEN}` ? 'authenticated' : 'anon'
        return await handleRest(req, res, url, role)
      }
      send(res, 404, { message: 'not found' })
    } catch (e) {
      const [status, body] = pgError(e)
      send(res, status, body)
    }
  })
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
  console.log(`fake supabase listening on http://127.0.0.1:${port}`)
  return server
}

if (import.meta.url === `file://${process.argv[1]}`) start()
