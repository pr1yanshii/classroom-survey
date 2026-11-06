// Anonymous browser token for duplicate-submission protection (TODO.md Phase 8).

const TOKEN_KEY = 'classroom-survey:token'
const submittedKey = (surveyId: string) => `classroom-survey:submitted:${surveyId}`

export function getAnonymousToken(): string {
  let token = localStorage.getItem(TOKEN_KEY)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(TOKEN_KEY, token)
  }
  return token
}

export function hasSubmitted(surveyId: string): boolean {
  return localStorage.getItem(submittedKey(surveyId)) !== null
}

export function markSubmitted(surveyId: string) {
  localStorage.setItem(submittedKey(surveyId), new Date().toISOString())
}
