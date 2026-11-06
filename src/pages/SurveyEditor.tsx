import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import ConfirmDialog from '../components/ConfirmDialog.tsx'
import ErrorMessage from '../components/ErrorMessage.tsx'
import InstructorLayout from '../components/InstructorLayout.tsx'
import Loading from '../components/Loading.tsx'
import StatusBadge from '../components/StatusBadge.tsx'
import {
  activateSurvey,
  closeSurvey,
  getResponseCount,
  getSurvey,
  saveSurvey,
  type DraftQuestion,
} from '../lib/api.ts'
import { friendlyError } from '../lib/errors.ts'
import {
  blankChoice,
  blankQuestion,
  fromSurvey,
  move,
  trueFalseChoices,
  validate,
  type EditQuestion,
  type Errors,
} from '../lib/editor.ts'
import { QUESTION_TYPE_LABELS, type QuestionType, type SurveyStatus } from '../lib/types.ts'

export default function SurveyEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id

  const [loading, setLoading] = useState(!isNew)
  const [notFound, setNotFound] = useState(false)
  const [status, setStatus] = useState<SurveyStatus>('draft')
  const [responseCount, setResponseCount] = useState(0)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<EditQuestion[]>(() => (isNew ? [blankQuestion()] : []))

  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState<'save' | 'activate' | 'close' | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)

  const load = useCallback(async (surveyId: string) => {
    try {
      const [survey, count] = await Promise.all([getSurvey(surveyId), getResponseCount(surveyId)])
      if (!survey) {
        setNotFound(true)
        return
      }
      setStatus(survey.status)
      setTitle(survey.title)
      setDescription(survey.description ?? '')
      setQuestions(fromSurvey(survey))
      setResponseCount(count)
    } catch (e) {
      setFormError(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (id) load(id)
  }, [id, load])

  // --- question/choice mutations ------------------------------------------

  function updateQuestion(key: string, patch: Partial<EditQuestion>) {
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)))
    setSavedAt(null)
  }

  function changeType(q: EditQuestion, type: QuestionType) {
    if (type === q.question_type) return
    if (type === 'true_false') {
      updateQuestion(q.key, {
        question_type: type,
        stashedChoices: q.choices,
        choices: trueFalseChoices(),
      })
    } else {
      updateQuestion(q.key, {
        question_type: type,
        choices: q.stashedChoices ?? [blankChoice(), blankChoice()],
        stashedChoices: undefined,
      })
    }
  }

  function updateChoice(q: EditQuestion, choiceKey: string, text: string) {
    updateQuestion(q.key, {
      choices: q.choices.map((c) => (c.key === choiceKey ? { ...c, choice_text: text } : c)),
    })
  }

  function removeQuestion(key: string) {
    setQuestions((qs) => qs.filter((q) => q.key !== key))
    setConfirmDelete(null)
    setSavedAt(null)
  }

  // --- save / activate ------------------------------------------------------

  async function persist(): Promise<string | null> {
    const found = validate(title, questions)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setFormError('Please fix the highlighted fields.')
      const firstKey = Object.keys(found)[0]
      document.getElementById(`field-${firstKey}`)?.focus()
      return null
    }
    setFormError(null)
    const payload: DraftQuestion[] = questions.map((q) => ({
      id: q.id,
      question_text: q.question_text.trim(),
      question_type: q.question_type,
      choices: q.choices.map((c) => ({ id: c.id, choice_text: c.choice_text.trim() })),
    }))
    return saveSurvey(id ?? null, title.trim(), description.trim(), payload)
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving('save')
    try {
      const savedId = await persist()
      if (!savedId) return
      setSavedAt(new Date())
      if (isNew) navigate(`/surveys/${savedId}/edit`, { replace: true })
      else await load(savedId) // refresh IDs of newly inserted rows
    } catch (err) {
      setFormError(friendlyError(err))
    } finally {
      setSaving(null)
    }
  }

  async function handleActivate() {
    setSaving('activate')
    try {
      const savedId = await persist()
      if (!savedId) return
      await activateSurvey(savedId)
      navigate(`/surveys/${savedId}/present`)
    } catch (err) {
      setFormError(friendlyError(err))
    } finally {
      setSaving(null)
    }
  }

  async function handleClose() {
    if (!id) return
    setSaving('close')
    try {
      await closeSurvey(id)
      setConfirmClose(false)
      await load(id)
    } catch (err) {
      setFormError(friendlyError(err))
    } finally {
      setSaving(null)
    }
  }

  // --- render ---------------------------------------------------------------

  if (loading)
    return (
      <InstructorLayout>
        <Loading message="Loading survey..." />
      </InstructorLayout>
    )

  if (notFound)
    return (
      <InstructorLayout>
        <p className="mb-4">Survey not found.</p>
        <Link to="/dashboard" className="btn-secondary">
          Back to Dashboard
        </Link>
      </InstructorLayout>
    )

  if (status === 'active' || status === 'archived')
    return (
      <InstructorLayout>
        <h1 className="mb-2 text-2xl font-semibold break-words">{title}</h1>
        <StatusBadge status={status} />
        <p className="my-4">
          {status === 'active'
            ? 'This survey is active. Close it before editing so students are not answering a changing survey.'
            : 'Archived surveys cannot be edited. Duplicate it from the dashboard to reuse its questions.'}
        </p>
        <ErrorMessage message={formError} />
        <div className="mt-4 flex flex-wrap gap-2">
          {status === 'active' && (
            <>
              <button type="button" className="btn-primary" onClick={() => setConfirmClose(true)}>
                Close Survey
              </button>
              <Link to={`/surveys/${id}/present`} className="btn-secondary">
                Present
              </Link>
            </>
          )}
          <Link to="/dashboard" className="btn-secondary">
            Back to Dashboard
          </Link>
        </div>
        <ConfirmDialog
          open={confirmClose}
          busy={saving === 'close'}
          title={`Close "${title}"?`}
          confirmLabel="Close Survey"
          onConfirm={handleClose}
          onCancel={() => setConfirmClose(false)}
        >
          <p>Students will no longer be able to submit responses.</p>
        </ConfirmDialog>
      </InstructorLayout>
    )

  const busy = saving !== null
  const pendingDelete = questions.find((q) => q.key === confirmDelete)

  return (
    <InstructorLayout>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{isNew ? 'New Survey' : 'Edit Survey'}</h1>
        {!isNew && <StatusBadge status={status} />}
      </div>

      {responseCount > 0 && (
        <p className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
          This survey already has {responseCount} response{responseCount === 1 ? '' : 's'}. Removing
          a question or choice also removes the answers recorded for it.
        </p>
      )}

      <form onSubmit={handleSave} noValidate className="space-y-6">
        <div className="card space-y-4">
          <div>
            <label htmlFor="field-title" className="mb-1 block font-medium">
              Survey Title <span aria-hidden="true">*</span>
            </label>
            <input
              id="field-title"
              className="input"
              value={title}
              maxLength={200}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? 'err-title' : undefined}
              onChange={(e) => {
                setTitle(e.target.value)
                setSavedAt(null)
              }}
            />
            <FieldError id="err-title" message={errors.title} />
          </div>
          <div>
            <label htmlFor="field-description" className="mb-1 block font-medium">
              Description <span className="font-normal text-slate-600">(optional)</span>
            </label>
            <textarea
              id="field-description"
              className="input"
              rows={2}
              maxLength={1000}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                setSavedAt(null)
              }}
            />
          </div>
        </div>

        <FieldError id="err-questions" message={errors.questions} />

        <ol className="space-y-6">
          {questions.map((q, qi) => (
            <li key={q.key} className="card space-y-4">
              <fieldset className="space-y-4">
                <legend className="text-lg font-semibold">Question {qi + 1}</legend>

                <div>
                  <label htmlFor={`field-q-${q.key}`} className="sr-only">
                    Question {qi + 1} text
                  </label>
                  <input
                    id={`field-q-${q.key}`}
                    className="input"
                    placeholder="Question text"
                    maxLength={500}
                    value={q.question_text}
                    aria-invalid={!!errors[`q-${q.key}`]}
                    aria-describedby={errors[`q-${q.key}`] ? `err-q-${q.key}` : undefined}
                    onChange={(e) => updateQuestion(q.key, { question_text: e.target.value })}
                  />
                  <FieldError id={`err-q-${q.key}`} message={errors[`q-${q.key}`]} />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor={`type-${q.key}`} className="font-medium">
                    Type
                  </label>
                  <select
                    id={`type-${q.key}`}
                    className="input w-auto"
                    value={q.question_type}
                    onChange={(e) => changeType(q, e.target.value as QuestionType)}
                  >
                    {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="mb-2 font-medium">Choices</p>
                  {q.question_type === 'true_false' ? (
                    <ul className="space-y-2 text-slate-700">
                      {q.choices.map((c) => (
                        <li key={c.key} className="rounded-md border border-slate-200 px-3 py-2">
                          {c.choice_text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="space-y-2">
                      {q.choices.map((c, ci) => (
                        <li key={c.key}>
                          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                            <label htmlFor={`field-c-${c.key}`} className="sr-only">
                              Question {qi + 1} choice {ci + 1}
                            </label>
                            <input
                              id={`field-c-${c.key}`}
                              className="input min-w-0 flex-1"
                              placeholder={`Choice ${ci + 1}`}
                              maxLength={300}
                              value={c.choice_text}
                              aria-invalid={!!errors[`c-${c.key}`]}
                              aria-describedby={errors[`c-${c.key}`] ? `err-c-${c.key}` : undefined}
                              onChange={(e) => updateChoice(q, c.key, e.target.value)}
                            />
                            <div className="flex gap-1">
                              <IconButton
                                label={`Move choice ${ci + 1} up`}
                                disabled={ci === 0}
                                onClick={() =>
                                  updateQuestion(q.key, { choices: move(q.choices, ci, -1) })
                                }
                              >
                                ↑
                              </IconButton>
                              <IconButton
                                label={`Move choice ${ci + 1} down`}
                                disabled={ci === q.choices.length - 1}
                                onClick={() =>
                                  updateQuestion(q.key, { choices: move(q.choices, ci, 1) })
                                }
                              >
                                ↓
                              </IconButton>
                              <IconButton
                                label={`Delete choice ${ci + 1}`}
                                disabled={q.choices.length <= 2}
                                onClick={() =>
                                  updateQuestion(q.key, {
                                    choices: q.choices.filter((x) => x.key !== c.key),
                                  })
                                }
                              >
                                ✕
                              </IconButton>
                            </div>
                          </div>
                          <FieldError id={`err-c-${c.key}`} message={errors[`c-${c.key}`]} />
                        </li>
                      ))}
                    </ul>
                  )}
                  <FieldError id={`err-choices-${q.key}`} message={errors[`choices-${q.key}`]} />
                  {q.question_type === 'multiple_choice' && (
                    <button
                      type="button"
                      className="btn-secondary mt-3"
                      onClick={() =>
                        updateQuestion(q.key, { choices: [...q.choices, blankChoice()] })
                      }
                    >
                      + Add Choice
                    </button>
                  )}
                </div>
              </fieldset>

              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={qi === 0}
                  onClick={() => setQuestions((qs) => move(qs, qi, -1))}
                >
                  Move Up
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={qi === questions.length - 1}
                  onClick={() => setQuestions((qs) => move(qs, qi, 1))}
                >
                  Move Down
                </button>
                <button
                  type="button"
                  className="btn-secondary ml-auto text-red-700"
                  onClick={() =>
                    q.question_text.trim() || q.id ? setConfirmDelete(q.key) : removeQuestion(q.key)
                  }
                >
                  Delete Question
                </button>
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => {
            setQuestions((qs) => [...qs, blankQuestion()])
            setSavedAt(null)
          }}
        >
          + Add Question
        </button>

        <ErrorMessage message={formError} />

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-secondary" disabled={busy}>
            {saving === 'save' ? 'Saving...' : status === 'draft' ? 'Save Draft' : 'Save'}
          </button>
          <button type="button" className="btn-primary" disabled={busy} onClick={handleActivate}>
            {saving === 'activate' ? 'Activating...' : 'Save & Activate'}
          </button>
          <Link to="/dashboard" className="btn-secondary">
            Back to Dashboard
          </Link>
          {savedAt && (
            <span role="status" className="text-green-800">
              Saved
            </span>
          )}
        </div>
        <p className="text-sm text-slate-600">
          Activating closes any other active survey. Only one survey can be active at a time.
        </p>
      </form>

      <ConfirmDialog
        open={pendingDelete !== undefined}
        danger
        title="Delete this question?"
        confirmLabel="Delete Question"
        onConfirm={() => pendingDelete && removeQuestion(pendingDelete.key)}
        onCancel={() => setConfirmDelete(null)}
      >
        <p>
          "{pendingDelete?.question_text || 'Untitled question'}" will be removed when you save.
          {responseCount > 0 && ' Answers recorded for it will also be deleted.'}
        </p>
      </ConfirmDialog>
    </InstructorLayout>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1 text-sm text-red-700">
      {message}
    </p>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="btn-secondary w-11 px-0"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  )
}
