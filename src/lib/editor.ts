// Survey editor state helpers and validation (unit-tested in tests/unit).
import type { QuestionType, SurveyWithQuestions } from './types.ts'

export interface EditChoice {
  key: string
  id: string | null
  choice_text: string
}

export interface EditQuestion {
  key: string
  id: string | null
  question_text: string
  question_type: QuestionType
  choices: EditChoice[]
  /** Multiple-choice options kept aside while the type is True/False. */
  stashedChoices?: EditChoice[]
}

export const newKey = () => crypto.randomUUID()
export const blankChoice = (text = ''): EditChoice => ({
  key: newKey(),
  id: null,
  choice_text: text,
})
export const trueFalseChoices = () => [blankChoice('True'), blankChoice('False')]
export const blankQuestion = (): EditQuestion => ({
  key: newKey(),
  id: null,
  question_text: '',
  question_type: 'multiple_choice',
  choices: [blankChoice(), blankChoice()],
})

export function fromSurvey(survey: SurveyWithQuestions): EditQuestion[] {
  return survey.questions.map((q) => ({
    key: q.id,
    id: q.id,
    question_text: q.question_text,
    question_type: q.question_type,
    choices: q.choices.map((c) => ({ key: c.id, id: c.id, choice_text: c.choice_text })),
  }))
}

export function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta
  if (target < 0 || target >= list.length) return list
  const next = [...list]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export type Errors = Record<string, string>

export function validate(title: string, questions: EditQuestion[]): Errors {
  const errors: Errors = {}
  if (!title.trim()) errors.title = 'Title is required.'
  if (questions.length === 0) errors.questions = 'Add at least one question.'
  questions.forEach((q, i) => {
    if (!q.question_text.trim()) errors[`q-${q.key}`] = `Question ${i + 1} needs text.`
    if (q.choices.length < 2) errors[`choices-${q.key}`] = 'Add at least two choices.'
    const seen = new Set<string>()
    q.choices.forEach((c) => {
      const text = c.choice_text.trim().toLowerCase()
      if (!text) errors[`c-${c.key}`] = 'Choice text is required.'
      else if (seen.has(text)) errors[`c-${c.key}`] = 'Duplicate choice.'
      seen.add(text)
    })
  })
  return errors
}
