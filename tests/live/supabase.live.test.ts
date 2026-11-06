// Integration test against YOUR real Supabase project (opt-in).
// Run:  LIVE_EMAIL=you@example.com LIVE_PASSWORD='...' npm run test:live
// Uses the app's own data layer (src/lib/api.ts) as the instructor and a separate
// anonymous client as a student. Creates one "[live test]" survey and deletes it.
// If another survey is active it will be re-activated at the end.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as api from '../../src/lib/api.ts'
import { supabase } from '../../src/lib/supabase.ts'

const email = process.env.LIVE_EMAIL
const password = process.env.LIVE_PASSWORD
const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

describe.skipIf(!email || !password)('live Supabase project', () => {
  let anon: SupabaseClient
  let surveyId = ''
  let previouslyActive: string | null = null
  let survey: Awaited<ReturnType<typeof api.getSurvey>>

  const submit = (token: string, choiceIds: string[]) =>
    anon.rpc('submit_survey_response', {
      p_survey_id: surveyId,
      p_anonymous_token: token,
      p_answers: survey!.questions.map((q, i) => ({ question_id: q.id, choice_id: choiceIds[i] })),
    })

  beforeAll(async () => {
    anon = createClient(url, key, { auth: { persistSession: false } })
  })

  afterAll(async () => {
    if (surveyId) await api.deleteSurvey(surveyId).catch(() => {})
    if (previouslyActive) await api.activateSurvey(previouslyActive).catch(() => {})
    await supabase.auth.signOut()
  })

  it('migrations are applied (functions exist)', async () => {
    const { error } = await anon.rpc('get_survey_status', { p_slug: 'zzzzzz' })
    expect(error).toBeNull()
  })

  it('anonymous users cannot read results or call instructor functions', async () => {
    const r = await anon.from('responses').select('id').limit(1)
    expect(r.error !== null || r.data?.length === 0).toBe(true)
    const a = await anon.from('answers').select('id').limit(1)
    expect(a.error !== null || a.data?.length === 0).toBe(true)
    expect(
      (
        await anon.rpc('save_survey', {
          p_survey_id: null,
          p_title: 'x',
          p_description: '',
          p_questions: [],
        })
      ).error,
    ).not.toBeNull()
    expect((await anon.from('surveys').insert({ title: 'hack' })).error).not.toBeNull()
  })

  it('instructor can log in with Supabase Auth', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email!,
      password: password!,
    })
    expect(error).toBeNull()
    expect(data.session).not.toBeNull()
    previouslyActive = (await api.listSurveys()).find((s) => s.status === 'active')?.id ?? null
  })

  it('wrong password is rejected', async () => {
    const other = createClient(url, key, { auth: { persistSession: false } })
    const { error } = await other.auth.signInWithPassword({
      email: email!,
      password: `${password}-wrong`,
    })
    expect(error).not.toBeNull()
  })

  it('create, load, and activate a survey', async () => {
    surveyId = await api.saveSurvey(null, '[live test] Recursion', 'automated test', [
      {
        id: null,
        question_text: 'Base case?',
        question_type: 'multiple_choice',
        choices: [
          { id: null, choice_text: 'Yes' },
          { id: null, choice_text: 'No' },
          { id: null, choice_text: 'Maybe' },
        ],
      },
      {
        id: null,
        question_text: 'Stops?',
        question_type: 'true_false',
        choices: [
          { id: null, choice_text: 'True' },
          { id: null, choice_text: 'False' },
        ],
      },
    ])
    survey = await api.getSurvey(surveyId)
    expect(survey?.questions.map((q) => q.choices.length)).toEqual([3, 2])
    await api.activateSurvey(surveyId)
    survey = await api.getSurvey(surveyId)
    expect(survey?.status).toBe('active')
    expect(survey?.public_slug).toMatch(/^[a-z2-9]{6}$/)
    if (previouslyActive) {
      expect((await api.listSurveys()).find((s) => s.id === previouslyActive)?.status).toBe(
        'closed',
      )
    }
  })

  it('student (anon) can load the active survey by slug with nested questions', async () => {
    const { data, error } = await anon
      .from('surveys')
      .select('id, title, questions(id, choices(id))')
      .eq('public_slug', survey!.public_slug!)
      .eq('status', 'active')
      .maybeSingle()
    expect(error).toBeNull()
    expect(data?.questions).toHaveLength(2)
  })

  it('student submission, duplicate prevention, and validation', async () => {
    const [q1, q2] = survey!.questions
    const ok = await submit('live-1', [q1.choices[0].id, q2.choices[0].id])
    expect(ok.error).toBeNull()
    expect(ok.data).toMatchObject({ success: true })
    expect((await submit('live-1', [q1.choices[0].id, q2.choices[0].id])).error?.message).toMatch(
      /DUPLICATE_RESPONSE/,
    )
    expect((await submit('live-2', [q2.choices[0].id, q2.choices[0].id])).error?.message).toMatch(
      /INVALID_CHOICE/,
    )
    expect((await submit('live-3', [q1.choices[1].id, q2.choices[1].id])).error).toBeNull()
  })

  it('results and export data are correct', async () => {
    expect(await api.getResponseCount(surveyId)).toBe(2)
    const counts = Object.fromEntries(
      (await api.getChoiceCounts(surveyId)).map((c) => [c.choice_id, c.answer_count]),
    )
    const [q1, q2] = survey!.questions
    expect(q1.choices.map((c) => counts[c.id])).toEqual([1, 1, 0])
    expect(q2.choices.map((c) => counts[c.id])).toEqual([1, 1])
    const data = await api.getExportData(surveyId, [q1.id, q2.id])
    expect(data.responses).toHaveLength(2)
    expect(data.answers).toHaveLength(4)
  })

  it('closing stops submissions; status visible to students', async () => {
    await api.closeSurvey(surveyId)
    const [q1, q2] = survey!.questions
    expect((await submit('live-4', [q1.choices[0].id, q2.choices[0].id])).error?.message).toMatch(
      /SURVEY_NOT_ACTIVE/,
    )
    expect((await anon.rpc('get_survey_status', { p_slug: survey!.public_slug })).data).toBe(
      'closed',
    )
    expect((await anon.from('surveys').select('id').eq('id', surveyId)).data).toEqual([])
  })

  it('duplicate and delete', async () => {
    const copy = await api.duplicateSurvey(surveyId)
    const dup = await api.getSurvey(copy)
    expect(dup?.title).toBe('Copy of [live test] Recursion')
    expect(dup?.status).toBe('draft')
    await api.deleteSurvey(copy)
    expect(await api.getSurvey(copy)).toBeNull()
  })
})
