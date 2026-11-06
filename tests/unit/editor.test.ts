import { describe, expect, it } from 'vitest'
import {
  blankQuestion,
  move,
  trueFalseChoices,
  validate,
  type EditQuestion,
} from '../../src/lib/editor.ts'

const q = (text: string, choices: string[]): EditQuestion => ({
  ...blankQuestion(),
  question_text: text,
  choices: choices.map((c, i) => ({ key: `k${i}${text}`, id: null, choice_text: c })),
})

describe('validate', () => {
  it('accepts a valid survey', () => {
    expect(validate('Title', [q('Q?', ['a', 'b'])])).toEqual({})
  })
  it('requires a title', () => {
    expect(validate('   ', [q('Q?', ['a', 'b'])]).title).toBeDefined()
  })
  it('requires at least one question', () => {
    expect(validate('T', []).questions).toBeDefined()
  })
  it('requires question text, non-empty unique choices, and at least two choices', () => {
    const bad = q('', ['a', ' A ', ''])
    const one = q('One', ['only'])
    const errors = validate('T', [bad, one])
    expect(errors[`q-${bad.key}`]).toMatch(/needs text/)
    expect(errors[`c-${bad.choices[1].key}`]).toBe('Duplicate choice.')
    expect(errors[`c-${bad.choices[2].key}`]).toBe('Choice text is required.')
    expect(errors[`choices-${one.key}`]).toBeDefined()
  })
  it('True/False defaults are valid', () => {
    expect(
      validate('T', [{ ...q('TF', []), question_type: 'true_false', choices: trueFalseChoices() }]),
    ).toEqual({})
  })
})

describe('move', () => {
  it('swaps neighbours and ignores out-of-range moves', () => {
    expect(move([1, 2, 3], 0, 1)).toEqual([2, 1, 3])
    expect(move([1, 2, 3], 2, -1)).toEqual([1, 3, 2])
    expect(move([1, 2, 3], 0, -1)).toEqual([1, 2, 3])
    expect(move([1, 2, 3], 2, 1)).toEqual([1, 2, 3])
  })
})
