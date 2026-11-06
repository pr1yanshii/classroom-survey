import { describe, expect, it } from 'vitest'
import { buildCsvRows, buildResults } from '../../src/lib/results.ts'
import type { SurveyWithQuestions } from '../../src/lib/types.ts'

const survey: SurveyWithQuestions = {
  id: 's1',
  title: 'Recursion',
  description: null,
  status: 'closed',
  public_slug: 'abc234',
  created_at: '2026-11-01T09:00:00Z',
  updated_at: '',
  questions: [
    {
      id: 'q1',
      survey_id: 's1',
      question_text: 'What is required for recursion?',
      question_type: 'multiple_choice',
      position: 1,
      choices: [
        { id: 'c1', question_id: 'q1', choice_text: 'A base case', position: 1 },
        { id: 'c2', question_id: 'q1', choice_text: 'A pointer', position: 2 },
        { id: 'c3', question_id: 'q1', choice_text: 'A loop', position: 3 },
        { id: 'c4', question_id: 'q1', choice_text: 'A compiler', position: 4 },
      ],
    },
    {
      id: 'q2',
      survey_id: 's1',
      question_text: 'Needs a stopping condition',
      question_type: 'true_false',
      position: 2,
      choices: [
        { id: 't', question_id: 'q2', choice_text: 'True', position: 1 },
        { id: 'f', question_id: 'q2', choice_text: 'False', position: 2 },
      ],
    },
  ],
}

describe('buildResults', () => {
  it('matches the UI.md example (45/3/2/2 of 52)', () => {
    const counts = new Map([
      ['c1', 45],
      ['c2', 3],
      ['c3', 2],
      ['c4', 2],
    ])
    const [q1, q2] = buildResults(survey, counts)
    expect(q1.answered).toBe(52)
    expect(q1.choices.map((c) => c.percentage)).toEqual([86.5, 5.8, 3.8, 3.8])
    expect(q1.choices[0].label).toBe('45 (86.5%)')
    expect(q2.answered).toBe(0)
    expect(q2.choices.every((c) => c.count === 0 && c.percentage === 0)).toBe(true)
  })
  it('keeps question and choice order', () => {
    const [q1] = buildResults(survey, new Map())
    expect(q1.choices.map((c) => c.choice_text)).toEqual([
      'A base case',
      'A pointer',
      'A loop',
      'A compiler',
    ])
  })
})

describe('buildCsvRows', () => {
  it('produces header of question text, one row per response, and survey metadata', () => {
    const rows = buildCsvRows(survey, {
      responses: [
        { id: 'r1', submitted_at: '2026-11-05T10:00:00Z' },
        { id: 'r2', submitted_at: '2026-11-05T10:01:00Z' },
      ],
      answers: [
        { response_id: 'r1', question_id: 'q1', choice_id: 'c1' },
        { response_id: 'r1', question_id: 'q2', choice_id: 't' },
        { response_id: 'r2', question_id: 'q1', choice_id: null }, // choice deleted later
      ],
    })
    expect(rows).toEqual([
      [
        'response_id',
        'submitted_at',
        'What is required for recursion?',
        'Needs a stopping condition',
        'survey_title',
        'survey_created_at',
      ],
      ['r1', '2026-11-05T10:00:00Z', 'A base case', 'True', 'Recursion', '2026-11-01T09:00:00Z'],
      ['r2', '2026-11-05T10:01:00Z', '', '', 'Recursion', '2026-11-01T09:00:00Z'],
    ])
  })
})
