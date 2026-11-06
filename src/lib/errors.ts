// Maps database/RPC errors to friendly messages (API.md §10, §13).
// Never show raw database exceptions to students.

const MESSAGES: Record<string, string> = {
  SURVEY_NOT_ACTIVE: 'This survey is no longer accepting responses.',
  DUPLICATE_RESPONSE: 'You have already submitted a response to this survey.',
  INVALID_QUESTION: 'This survey has changed. Please reload the page and try again.',
  INVALID_CHOICE: 'This survey has changed. Please reload the page and try again.',
  MISSING_REQUIRED_ANSWER: 'Please answer every question before submitting.',
  SURVEY_NOT_FOUND: 'Survey not found.',
  SURVEY_HAS_NO_QUESTIONS: 'Add at least one question before activating this survey.',
  SURVEY_IS_ACTIVE: 'Close this survey before editing it.',
  INVALID_SURVEY: 'Please fix the highlighted fields and try again.',
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return (error as { message?: string } | null)?.message ?? ''
}

export function errorCode(error: unknown): string | null {
  const message = messageOf(error)
  return Object.keys(MESSAGES).find((code) => message.includes(code)) ?? null
}

export function friendlyError(error: unknown): string {
  const code = errorCode(error)
  if (code) return MESSAGES[code]
  const message = messageOf(error)
  if (/fetch|network/i.test(message)) return 'Network error. Check your connection and try again.'
  if (/JWT|auth/i.test(message)) return 'Your session has expired. Please log in again.'
  console.error(error)
  return 'Something went wrong. Please try again.'
}
