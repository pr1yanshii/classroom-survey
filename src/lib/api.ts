// All Supabase data access lives here (API.md §6–12).
import { supabase } from './supabase.ts'
import type { QuestionType, Survey, SurveyWithQuestions } from './types.ts'

const SURVEY_WITH_QUESTIONS =
  '*, questions(id, survey_id, question_text, question_type, position, choices(id, question_id, choice_text, position))'

function sortNested(survey: SurveyWithQuestions): SurveyWithQuestions {
  const questions = [...survey.questions].sort((a, b) => a.position - b.position)
  for (const q of questions) q.choices = [...q.choices].sort((a, b) => a.position - b.position)
  return { ...survey, questions }
}

export async function listSurveys(): Promise<Survey[]> {
  const { data, error } = await supabase
    .from('surveys')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Survey[]
}

export async function getSurvey(id: string): Promise<SurveyWithQuestions | null> {
  const { data, error } = await supabase
    .from('surveys')
    .select(SURVEY_WITH_QUESTIONS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? sortNested(data as SurveyWithQuestions) : null
}

/** Public: resolves a slug to an Active survey. Returns null if not readable. */
export async function getActiveSurveyBySlug(slug: string): Promise<SurveyWithQuestions | null> {
  const { data, error } = await supabase
    .from('surveys')
    .select(SURVEY_WITH_QUESTIONS)
    .eq('public_slug', slug)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  return data ? sortNested(data as SurveyWithQuestions) : null
}

/** Public: status of a survey by slug, or null if no such survey. */
export async function getSurveyStatus(slug: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_survey_status', { p_slug: slug })
  if (error) throw error
  return data as string | null
}

export interface DraftQuestion {
  id: string | null
  question_text: string
  question_type: QuestionType
  choices: { id: string | null; choice_text: string }[]
}

export async function saveSurvey(
  id: string | null,
  title: string,
  description: string,
  questions: DraftQuestion[],
): Promise<string> {
  const { data, error } = await supabase.rpc('save_survey', {
    p_survey_id: id,
    p_title: title,
    p_description: description,
    p_questions: questions,
  })
  if (error) throw error
  return data as string
}

export async function activateSurvey(id: string): Promise<void> {
  const { error } = await supabase.rpc('activate_survey', { p_survey_id: id })
  if (error) throw error
}

export async function closeSurvey(id: string): Promise<void> {
  const { error } = await supabase.rpc('close_survey', { p_survey_id: id })
  if (error) throw error
}

export async function duplicateSurvey(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('duplicate_survey', { p_survey_id: id })
  if (error) throw error
  return data as string
}

export async function archiveSurvey(id: string): Promise<void> {
  const { error } = await supabase.from('surveys').update({ status: 'archived' }).eq('id', id)
  if (error) throw error
}

export async function deleteSurvey(id: string): Promise<void> {
  const { error } = await supabase.from('surveys').delete().eq('id', id)
  if (error) throw error
}

export async function getResponseCount(surveyId: string): Promise<number> {
  const { count, error } = await supabase
    .from('responses')
    .select('id', { count: 'exact', head: true })
    .eq('survey_id', surveyId)
  if (error) throw error
  return count ?? 0
}

export interface ChoiceCount {
  question_id: string
  choice_id: string
  answer_count: number
}

export async function getChoiceCounts(surveyId: string): Promise<ChoiceCount[]> {
  const { data, error } = await supabase.rpc('survey_choice_counts', { p_survey_id: surveyId })
  if (error) throw error
  return (data as ChoiceCount[]).map((r) => ({ ...r, answer_count: Number(r.answer_count) }))
}

const PAGE = 1000 // Supabase default max rows per request

/** Fetches every row of a query by paging, so exports are never truncated. */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

export interface ExportData {
  responses: { id: string; submitted_at: string }[]
  answers: { response_id: string; question_id: string; choice_id: string | null }[]
}

export async function getExportData(surveyId: string, questionIds: string[]): Promise<ExportData> {
  const responses = await fetchAll<{ id: string; submitted_at: string }>((from, to) =>
    supabase
      .from('responses')
      .select('id, submitted_at')
      .eq('survey_id', surveyId)
      .order('submitted_at')
      .order('id')
      .range(from, to),
  )
  const answers =
    questionIds.length === 0
      ? []
      : await fetchAll<ExportData['answers'][number]>((from, to) =>
          supabase
            .from('answers')
            .select('response_id, question_id, choice_id')
            .in('question_id', questionIds)
            .order('id')
            .range(from, to),
        )
  return { responses, answers }
}

/** Public: atomic, validated submission via RPC (API.md §10). */
export async function submitResponse(
  surveyId: string,
  anonymousToken: string,
  answers: { question_id: string; choice_id: string }[],
): Promise<void> {
  const { error } = await supabase.rpc('submit_survey_response', {
    p_survey_id: surveyId,
    p_anonymous_token: anonymousToken,
    p_answers: answers,
  })
  if (error) throw error
}
