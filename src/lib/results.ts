// Pure result/CSV calculations (unit-tested in tests/unit).
import type { ExportData } from './api.ts'
import type { SurveyWithQuestions } from './types.ts'

export interface ChoiceResult {
  choice_id: string
  choice_text: string
  count: number
  percentage: number
  label: string
}

export interface QuestionResult {
  question_id: string
  question_text: string
  answered: number
  choices: ChoiceResult[]
}

/** Percentages are per question: count / answers to that question, 1 decimal. */
export function buildResults(
  survey: SurveyWithQuestions,
  counts: Map<string, number>,
): QuestionResult[] {
  return survey.questions.map((q) => {
    const answered = q.choices.reduce((sum, c) => sum + (counts.get(c.id) ?? 0), 0)
    return {
      question_id: q.id,
      question_text: q.question_text,
      answered,
      choices: q.choices.map((c) => {
        const count = counts.get(c.id) ?? 0
        const percentage = answered === 0 ? 0 : Math.round((count / answered) * 1000) / 10
        return {
          choice_id: c.id,
          choice_text: c.choice_text,
          count,
          percentage,
          label: `${count} (${percentage.toFixed(1)}%)`,
        }
      }),
    }
  })
}

/**
 * One row per response: response_id, submitted_at, one column per question (API.md §12),
 * then survey metadata (title, creation date) so every row identifies its survey.
 */
export function buildCsvRows(survey: SurveyWithQuestions, data: ExportData): string[][] {
  const questionIds = survey.questions.map((q) => q.id)
  const choiceText = new Map(
    survey.questions.flatMap((q) => q.choices.map((c) => [c.id, c.choice_text] as const)),
  )
  const byResponse = new Map<string, Map<string, string>>()
  for (const a of data.answers) {
    if (!byResponse.has(a.response_id)) byResponse.set(a.response_id, new Map())
    byResponse
      .get(a.response_id)!
      .set(a.question_id, a.choice_id ? (choiceText.get(a.choice_id) ?? '') : '')
  }
  return [
    [
      'response_id',
      'submitted_at',
      ...survey.questions.map((q) => q.question_text),
      'survey_title',
      'survey_created_at',
    ],
    ...data.responses.map((r) => [
      r.id,
      r.submitted_at,
      ...questionIds.map((qid) => byResponse.get(r.id)?.get(qid) ?? ''),
      survey.title,
      survey.created_at,
    ]),
  ]
}
