import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { getActiveSurveyBySlug, getSurveyStatus, submitResponse } from '../lib/api.ts'
import { errorCode, friendlyError } from '../lib/errors.ts'
import { getAnonymousToken, hasSubmitted, markSubmitted } from '../lib/token.ts'
import type { SurveyWithQuestions } from '../lib/types.ts'

type View = 'loading' | 'form' | 'success' | 'already' | 'closed' | 'notFound' | 'loadError'

// Public student page (UI.md §7–8): no login, no menu, large touch targets.
export default function StudentSurvey() {
  const { slug } = useParams() as { slug: string }
  const [view, setView] = useState<View>('loading')
  const [survey, setSurvey] = useState<SurveyWithQuestions | null>(null)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [missing, setMissing] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const s = await getActiveSurveyBySlug(slug)
        if (cancelled) return
        if (s) {
          setSurvey(s)
          setView(hasSubmitted(s.id) ? 'already' : 'form')
          return
        }
        const status = await getSurveyStatus(slug)
        if (!cancelled) setView(status ? 'closed' : 'notFound')
      } catch {
        if (!cancelled) setView('loadError')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!survey) return

    const unanswered = survey.questions.filter((q) => !selected[q.id]).map((q) => q.id)
    setMissing(new Set(unanswered))
    if (unanswered.length > 0) {
      setError('Please answer every question.')
      document.getElementById(`q-${unanswered[0]}`)?.focus()
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await submitResponse(
        survey.id,
        getAnonymousToken(),
        survey.questions.map((q) => ({ question_id: q.id, choice_id: selected[q.id] })),
      )
      markSubmitted(survey.id)
      setView('success')
    } catch (err) {
      const code = errorCode(err)
      if (code === 'DUPLICATE_RESPONSE') {
        markSubmitted(survey.id)
        setView('already')
      } else if (code === 'SURVEY_NOT_ACTIVE') {
        setView('closed')
      } else {
        setError(friendlyError(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (view === 'loading')
    return (
      <Message>
        <p role="status">Loading survey...</p>
      </Message>
    )
  if (view === 'notFound') return <Message title="Survey not found." />
  if (view === 'closed') return <Message title="This survey is no longer accepting responses." />
  if (view === 'already')
    return <Message title="You have already submitted a response to this survey." />
  if (view === 'success')
    return (
      <Message title="Thank you!">
        <p>Your response has been recorded.</p>
      </Message>
    )
  if (view === 'loadError' || !survey)
    return (
      <Message title="Could not load the survey.">
        <p className="mb-4">Check your connection and try again.</p>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
          Try Again
        </button>
      </Message>
    )

  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:py-10">
      <h1 className="text-2xl font-bold break-words sm:text-3xl">{survey.title}</h1>
      {survey.description && (
        <p className="mt-2 text-lg break-words text-slate-700">{survey.description}</p>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-8">
        {survey.questions.map((q, qi) => {
          const invalid = missing.has(q.id) && !selected[q.id]
          return (
            <fieldset
              key={q.id}
              id={`q-${q.id}`}
              tabIndex={-1}
              aria-invalid={invalid}
              aria-describedby={invalid ? `q-err-${q.id}` : undefined}
              className={`rounded-lg border bg-white p-4 ${invalid ? 'border-red-600' : 'border-slate-200'}`}
            >
              <legend className="float-left mb-4 w-full text-lg font-semibold break-words">
                {qi + 1}. {q.question_text}
              </legend>
              <div className="clear-left space-y-3">
                {q.choices.map((c) => {
                  const checked = selected[q.id] === c.id
                  return (
                    <label
                      key={c.id}
                      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-lg ${
                        checked ? 'border-blue-700 bg-blue-50' : 'border-slate-300 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={c.id}
                        checked={checked}
                        onChange={() => setSelected((s) => ({ ...s, [q.id]: c.id }))}
                        className="size-5 shrink-0 accent-blue-700"
                      />
                      <span className="break-words">{c.choice_text}</span>
                    </label>
                  )
                })}
              </div>
              {invalid && (
                <p id={`q-err-${q.id}`} className="mt-3 text-red-700">
                  Please choose an answer.
                </p>
              )}
            </fieldset>
          )
        })}

        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full py-3 text-lg" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </form>
    </main>
  )
}

function Message({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        {title && <h1 className="mb-3 text-2xl font-semibold">{title}</h1>}
        <div className="text-lg text-slate-700">{children}</div>
      </div>
    </main>
  )
}
