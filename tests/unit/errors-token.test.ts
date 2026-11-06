import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorCode, friendlyError } from '../../src/lib/errors.ts'

describe('friendlyError', () => {
  it('maps RPC error codes to the UI.md messages', () => {
    expect(friendlyError({ message: 'DUPLICATE_RESPONSE' })).toBe(
      'You have already submitted a response to this survey.',
    )
    expect(friendlyError({ message: 'SURVEY_NOT_ACTIVE' })).toBe(
      'This survey is no longer accepting responses.',
    )
    expect(errorCode({ message: 'INVALID_SURVEY: question 2 has no text' })).toBe('INVALID_SURVEY')
  })
  it('never leaks raw database messages', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const msg = friendlyError({ message: 'duplicate key value violates unique constraint "x"' })
    expect(msg).toBe('Something went wrong. Please try again.')
  })
  it('detects network failures', () => {
    expect(friendlyError(new TypeError('Failed to fetch'))).toMatch(/Network error/)
  })
})

describe('anonymous token', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    })
  })
  it('is generated once and reused', async () => {
    const { getAnonymousToken } = await import('../../src/lib/token.ts')
    const a = getAnonymousToken()
    expect(a).toMatch(/^[0-9a-f-]{36}$/)
    expect(getAnonymousToken()).toBe(a)
  })
  it('tracks submissions per survey', async () => {
    const { hasSubmitted, markSubmitted } = await import('../../src/lib/token.ts')
    expect(hasSubmitted('s1')).toBe(false)
    markSubmitted('s1')
    expect(hasSubmitted('s1')).toBe(true)
    expect(hasSubmitted('s2')).toBe(false)
  })
})
