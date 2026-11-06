import { describe, expect, it } from 'vitest'
import { slugify, toCsv } from '../../src/lib/csv.ts'

describe('toCsv', () => {
  it('joins plain cells with commas and rows with CRLF', () => {
    expect(
      toCsv([
        ['a', 'b'],
        ['c', 'd'],
      ]),
    ).toBe('a,b\r\nc,d')
  })
  it('quotes cells containing commas, quotes, and newlines', () => {
    expect(toCsv([['x,y', 'say "hi"', 'line1\nline2']])).toBe('"x,y","say ""hi""","line1\nline2"')
  })
  it('neutralises spreadsheet formulas', () => {
    expect(toCsv([['=SUM(A1)', '+1', '-2', '@cmd']])).toBe("'=SUM(A1),'+1,'-2,'@cmd")
  })
  it('keeps empty cells', () => {
    expect(toCsv([['a', '', 'c']])).toBe('a,,c')
  })
})

describe('slugify', () => {
  it('makes a filename-safe slug', () => {
    expect(slugify('Recursion: Concept Check #2!')).toBe('recursion-concept-check-2')
  })
  it('falls back when nothing is left', () => {
    expect(slugify('!!!')).toBe('survey')
  })
})
