import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asRole, createDb } from '../support/pglite.ts'

// Tests run in order and share state, mirroring a class session.
let db: PGlite
const ids: Record<string, string> = {}
let questions: { id: string }[] = []
let choices: { id: string; question_id: string }[] = []

const anon = (sql: string, p?: unknown[]) => asRole(db, 'anon', sql, p)
const auth = (sql: string, p?: unknown[]) => asRole(db, 'authenticated', sql, p)
const q = async (sql: string, p?: unknown[]) => (await db.query<Record<string, any>>(sql, p)).rows
const fails = async (promise: Promise<unknown>) => {
  try {
    await promise
  } catch (e) {
    return (e as Error).message
  }
  throw new Error('expected query to fail')
}

const payload = JSON.stringify([
  {
    id: null,
    question_text: 'What is required for recursion?',
    question_type: 'multiple_choice',
    choices: [
      { id: null, choice_text: 'A base case' },
      { id: null, choice_text: 'A loop' },
      { id: null, choice_text: 'A pointer' },
    ],
  },
  {
    id: null,
    question_text: 'Recursion needs a stopping condition.',
    question_type: 'true_false',
    choices: [
      { id: null, choice_text: 'True' },
      { id: null, choice_text: 'False' },
    ],
  },
])
const answers = (c0: string, c1: string) =>
  JSON.stringify([
    { question_id: questions[0].id, choice_id: c0 },
    { question_id: questions[1].id, choice_id: c1 },
  ])
const submit = (token: string, body: string, survey = ids.s1) =>
  anon(`select submit_survey_response($1, $2, $3::jsonb) r`, [survey, token, body])

beforeAll(async () => {
  db = await createDb()
})

describe('schema', () => {
  it('has the five required tables with RLS enabled', async () => {
    const rows = await q(
      `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname`,
    )
    expect(rows).toEqual(
      ['answers', 'choices', 'questions', 'responses', 'surveys'].map((relname) => ({
        relname,
        relrowsecurity: true,
      })),
    )
  })
  it('rejects invalid status and question type', async () => {
    expect(await fails(q(`insert into surveys(title, status) values ('x', 'live')`))).toMatch(
      /check/,
    )
    const [{ id }] = await q(`insert into surveys(title) values ('tmp') returning id`)
    expect(
      await fails(
        q(
          `insert into questions(survey_id, question_text, question_type, position) values ($1,'q','essay',1)`,
          [id],
        ),
      ),
    ).toMatch(/check/)
    await q(`delete from surveys where id = $1`, [id])
  })
})

describe('instructor: save_survey', () => {
  it('creates a draft with ordered questions and choices', async () => {
    const [{ save_survey }] = await auth(
      `select save_survey(null, '  Recursion  ', '', $1::jsonb)`,
      [payload],
    )
    ids.s1 = save_survey as string
    const [survey] = await q(`select * from surveys where id = $1`, [ids.s1])
    expect(survey).toMatchObject({
      status: 'draft',
      title: 'Recursion',
      description: null,
      public_slug: null,
    })
    questions = (await q(`select * from questions where survey_id = $1 order by position`, [
      ids.s1,
    ])) as never
    choices = (await q(
      `select c.* from choices c join questions q on q.id = c.question_id where q.survey_id = $1 order by q.position, c.position`,
      [ids.s1],
    )) as never
    expect(questions).toHaveLength(2)
    expect(choices).toHaveLength(5)
  })
  it('rejects empty title, no questions, and <2 choices', async () => {
    expect(await fails(auth(`select save_survey(null, ' ', '', $1::jsonb)`, [payload]))).toMatch(
      /INVALID_SURVEY/,
    )
    expect(await fails(auth(`select save_survey(null, 'x', '', '[]'::jsonb)`))).toMatch(
      /INVALID_SURVEY/,
    )
    const one = JSON.stringify([
      {
        id: null,
        question_text: 'q',
        question_type: 'multiple_choice',
        choices: [{ id: null, choice_text: 'a' }],
      },
    ])
    expect(await fails(auth(`select save_survey(null, 'x', '', $1::jsonb)`, [one]))).toMatch(
      /INVALID_SURVEY/,
    )
  })
  it('rolls back the whole save when a later question is invalid', async () => {
    const before = await q(`select count(*)::int n from surveys`)
    const bad = JSON.stringify([
      JSON.parse(payload)[0],
      { id: null, question_text: '', question_type: 'true_false', choices: [] },
    ])
    await fails(auth(`select save_survey(null, 'partial', '', $1::jsonb)`, [bad]))
    expect(await q(`select count(*)::int n from surveys`)).toEqual(before)
  })
})

describe('anonymous access before activation', () => {
  it('cannot see drafts', async () => {
    expect(await anon(`select * from surveys`)).toHaveLength(0)
    expect(await anon(`select * from questions`)).toHaveLength(0)
    expect(await anon(`select * from choices`)).toHaveLength(0)
  })
  it('cannot call instructor functions', async () => {
    for (const sql of [
      `select save_survey(null, 'x', '', '[]'::jsonb)`,
      `select * from activate_survey('${ids.s1}')`,
      `select close_survey('${ids.s1}')`,
      `select duplicate_survey('${ids.s1}')`,
      `select * from survey_choice_counts('${ids.s1}')`,
    ]) {
      expect(await fails(anon(sql))).toMatch(/permission denied/)
    }
  })
  it('cannot write surveys directly', async () => {
    expect(await fails(anon(`insert into surveys(title) values ('hack')`))).toMatch(
      /permission denied/,
    )
    expect(await fails(anon(`update surveys set title = 'hack'`))).toMatch(/permission denied/)
    expect(await fails(anon(`delete from surveys`))).toMatch(/permission denied/)
  })
})

describe('activation', () => {
  it('activates with a 6-char unambiguous slug', async () => {
    const [row] = await auth(`select * from activate_survey($1)`, [ids.s1])
    expect(row.status).toBe('active')
    expect(row.public_slug).toMatch(/^[a-hjkmnp-z2-9]{6}$/)
    ids.slug1 = row.public_slug as string
  })
  it('duplicate_survey copies questions/choices as a draft named "Copy of ..."', async () => {
    const [{ duplicate_survey }] = await auth(`select duplicate_survey($1)`, [ids.s1])
    ids.s2 = duplicate_survey as string
    const [dup] = await q(`select * from surveys where id = $1`, [ids.s2])
    expect(dup).toMatchObject({ title: 'Copy of Recursion', status: 'draft', public_slug: null })
    const [{ n }] = await q(
      `select count(*)::int n from choices c join questions q on q.id = c.question_id where q.survey_id = $1`,
      [ids.s2],
    )
    expect(n).toBe(5)
    const [{ r }] = await q(`select count(*)::int r from responses where survey_id = $1`, [ids.s2])
    expect(r).toBe(0)
  })
  it('activating another survey closes the previous one', async () => {
    await auth(`select * from activate_survey($1)`, [ids.s2])
    const rows = await q(`select id, status from surveys where id in ($1, $2)`, [ids.s1, ids.s2])
    expect(Object.fromEntries(rows.map((r) => [r.id, r.status]))).toEqual({
      [ids.s1]: 'closed',
      [ids.s2]: 'active',
    })
    const [{ n }] = await q(`select count(*)::int n from surveys where status = 'active'`)
    expect(n).toBe(1)
  })
  it('the database itself refuses two active surveys', async () => {
    expect(
      await fails(auth(`update surveys set status = 'active' where id = $1`, [ids.s1])),
    ).toMatch(/duplicate key/)
  })
  it('refuses to activate a survey without questions', async () => {
    const [{ id }] = await q(`insert into surveys(title) values ('empty') returning id`)
    expect(await fails(auth(`select * from activate_survey($1)`, [id]))).toMatch(
      /SURVEY_HAS_NO_QUESTIONS/,
    )
    await q(`delete from surveys where id = $1`, [id])
  })
  it('get_survey_status distinguishes closed from not found', async () => {
    expect((await anon(`select get_survey_status($1) s`, [ids.slug1]))[0].s).toBe('closed')
    expect((await anon(`select get_survey_status('zzzzzz') s`))[0].s).toBeNull()
  })
  it('re-activation keeps the existing slug (printed QR codes stay valid)', async () => {
    await auth(`select * from activate_survey($1)`, [ids.s1])
    const [{ public_slug }] = await q(`select public_slug from surveys where id = $1`, [ids.s1])
    expect(public_slug).toBe(ids.slug1)
  })
})

describe('anonymous student access to the active survey', () => {
  it('can read only the active survey, its questions and choices', async () => {
    const surveys = await anon(`select id from surveys`)
    expect(surveys.map((s) => s.id)).toEqual([ids.s1])
    expect(await anon(`select * from questions`)).toHaveLength(2)
    expect(await anon(`select * from choices`)).toHaveLength(5)
  })
  it('cannot read or write responses and answers directly', async () => {
    expect(await fails(anon(`select * from responses`))).toMatch(/permission denied/)
    expect(await fails(anon(`select * from answers`))).toMatch(/permission denied/)
    expect(await fails(anon(`insert into responses(survey_id) values ($1)`, [ids.s1]))).toMatch(
      /permission denied/,
    )
  })
})

describe('submit_survey_response', () => {
  it('accepts a valid submission and returns the response id', async () => {
    const [{ r }] = await submit('tok-1', answers(choices[0].id, choices[3].id))
    expect(r).toMatchObject({ success: true })
    expect((r as { response_id: string }).response_id).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('rejects a second submission with the same token', async () => {
    expect(await fails(submit('tok-1', answers(choices[0].id, choices[3].id)))).toMatch(
      /DUPLICATE_RESPONSE/,
    )
  })
  it('rejects missing answers', async () => {
    const partial = JSON.stringify([{ question_id: questions[0].id, choice_id: choices[0].id }])
    expect(await fails(submit('tok-2', partial))).toMatch(/MISSING_REQUIRED_ANSWER/)
    expect(await fails(submit('tok-2', '{}'))).toMatch(/MISSING_REQUIRED_ANSWER/)
  })
  it('rejects a choice that belongs to another question', async () => {
    expect(await fails(submit('tok-2', answers(choices[3].id, choices[3].id)))).toMatch(
      /INVALID_CHOICE/,
    )
  })
  it('rejects a question from another survey', async () => {
    const [foreign] = await q(
      `select q.id qid, c.id cid from questions q join choices c on c.question_id = q.id where q.survey_id = $1 limit 1`,
      [ids.s2],
    )
    const body = JSON.stringify([
      { question_id: questions[0].id, choice_id: choices[0].id },
      { question_id: questions[1].id, choice_id: choices[3].id },
      { question_id: foreign.qid, choice_id: foreign.cid },
    ])
    expect(await fails(submit('tok-2', body))).toMatch(/INVALID_QUESTION/)
  })
  it('rejects malformed input without leaking partial rows', async () => {
    await fails(submit('tok-2', JSON.stringify([{ question_id: 'not-a-uuid', choice_id: 'x' }])))
    const [{ n }] = await q(`select count(*)::int n from responses where anonymous_token = 'tok-2'`)
    expect(n).toBe(0)
  })
  it('rejects submissions to a non-active survey', async () => {
    expect(await fails(submit('tok-9', answers(choices[0].id, choices[3].id), ids.s2))).toMatch(
      /SURVEY_NOT_ACTIVE/,
    )
  })
})

describe('results', () => {
  it('survey_choice_counts returns per-choice totals', async () => {
    await submit('tok-3', answers(choices[1].id, choices[3].id))
    await submit('tok-4', answers(choices[0].id, choices[4].id))
    const rows = await auth(`select * from survey_choice_counts($1)`, [ids.s1])
    const counts = Object.fromEntries(rows.map((r) => [r.choice_id, Number(r.answer_count)]))
    expect(choices.map((c) => counts[c.id])).toEqual([2, 1, 0, 2, 1])
  })
  it('authenticated instructor can read responses and answers', async () => {
    expect(await auth(`select * from responses where survey_id = $1`, [ids.s1])).toHaveLength(3)
    expect(await auth(`select * from answers`)).toHaveLength(6)
  })
})

describe('closing and editing', () => {
  it('save_survey refuses to edit the active survey', async () => {
    expect(
      await fails(auth(`select save_survey($1, 'x', '', $2::jsonb)`, [ids.s1, payload])),
    ).toMatch(/SURVEY_IS_ACTIVE/)
  })
  it('close_survey stops submissions immediately', async () => {
    await auth(`select close_survey($1)`, [ids.s1])
    const [{ status }] = await q(`select status from surveys where id = $1`, [ids.s1])
    expect(status).toBe('closed')
    expect(await fails(submit('tok-5', answers(choices[0].id, choices[3].id)))).toMatch(
      /SURVEY_NOT_ACTIVE/,
    )
    expect(await anon(`select * from surveys where id = $1`, [ids.s1])).toHaveLength(0)
  })
  it('editing a closed survey preserves IDs and recorded answers', async () => {
    const edit = JSON.stringify([
      {
        id: questions[1].id,
        question_text: 'Stopping condition?',
        question_type: 'true_false',
        choices: [
          { id: choices[3].id, choice_text: 'True' },
          { id: choices[4].id, choice_text: 'False' },
        ],
      },
      {
        id: questions[0].id,
        question_text: 'What is required for recursion?',
        question_type: 'multiple_choice',
        choices: [
          { id: choices[1].id, choice_text: 'A loop (renamed)' },
          { id: choices[0].id, choice_text: 'A base case' },
          { id: null, choice_text: 'New' },
        ],
      },
    ])
    const [{ updated_at: before }] = await q(`select updated_at from surveys where id = $1`, [
      ids.s1,
    ])
    await auth(`select save_survey($1, 'Recursion v2', 'desc', $2::jsonb)`, [ids.s1, edit])
    const qs = await q(`select id from questions where survey_id = $1 order by position`, [ids.s1])
    expect(qs.map((r) => r.id)).toEqual([questions[1].id, questions[0].id])
    const cs = await q(
      `select id, choice_text from choices where question_id = $1 order by position`,
      [questions[0].id],
    )
    expect(cs.map((c) => c.choice_text)).toEqual(['A loop (renamed)', 'A base case', 'New'])
    expect(cs[0].id).toBe(choices[1].id)
    const [{ n }] = await q(`select count(*)::int n from answers where choice_id = $1`, [
      choices[0].id,
    ])
    expect(n).toBe(2)
    const [after] = await q(`select status, updated_at from surveys where id = $1`, [ids.s1])
    expect(after.status).toBe('closed')
    expect(after.updated_at.getTime()).toBeGreaterThan(before.getTime())
  })
  it('save_survey rejects IDs from another survey', async () => {
    const [foreign] = await q(`select id from questions where survey_id = $1 limit 1`, [ids.s2])
    const body = JSON.stringify([
      {
        id: foreign.id,
        question_text: 'q',
        question_type: 'true_false',
        choices: [
          { id: null, choice_text: 'True' },
          { id: null, choice_text: 'False' },
        ],
      },
    ])
    // s2 is active, so use a fresh draft
    const [{ id }] = await q(`insert into surveys(title) values ('d') returning id`)
    expect(await fails(auth(`select save_survey($1, 'd', '', $2::jsonb)`, [id, body]))).toMatch(
      /INVALID_QUESTION/,
    )
  })
  it('archive keeps data', async () => {
    await auth(`update surveys set status = 'archived' where id = $1`, [ids.s1])
    expect(await auth(`select * from responses where survey_id = $1`, [ids.s1])).toHaveLength(3)
  })
})

describe('deletion', () => {
  it('cascades to questions, choices, responses, and answers', async () => {
    await auth(`delete from surveys where id = $1`, [ids.s1])
    const [row] = await q(
      `select (select count(*)::int from questions where survey_id = $1) q,
              (select count(*)::int from responses where survey_id = $1) r,
              (select count(*)::int from answers a join questions q on q.id = a.question_id where q.survey_id = $1) a`,
      [ids.s1],
    )
    expect(row).toEqual({ q: 0, r: 0, a: 0 })
  })
})
