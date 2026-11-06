// Data models per API.md §2–5

export type SurveyStatus = 'draft' | 'active' | 'closed' | 'archived'
export type QuestionType = 'multiple_choice' | 'true_false'

export interface Survey {
  id: string
  title: string
  description: string | null
  status: SurveyStatus
  public_slug: string | null
  created_at: string
  updated_at: string
}

export interface Choice {
  id: string
  question_id: string
  choice_text: string
  position: number
}

export interface Question {
  id: string
  survey_id: string
  question_text: string
  question_type: QuestionType
  position: number
  choices: Choice[]
}

export interface SurveyWithQuestions extends Survey {
  questions: Question[]
}

export const STATUS_LABELS: Record<SurveyStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  closed: 'Closed',
  archived: 'Archived',
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple Choice',
  true_false: 'True / False',
}
