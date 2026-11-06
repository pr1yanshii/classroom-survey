import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import ConfirmDialog from '../components/ConfirmDialog.tsx'
import ErrorMessage from '../components/ErrorMessage.tsx'
import InstructorLayout from '../components/InstructorLayout.tsx'
import Loading from '../components/Loading.tsx'
import StatusBadge from '../components/StatusBadge.tsx'
import {
  activateSurvey,
  archiveSurvey,
  closeSurvey,
  deleteSurvey,
  duplicateSurvey,
  getResponseCount,
  listSurveys,
} from '../lib/api.ts'
import { friendlyError } from '../lib/errors.ts'
import { STATUS_LABELS, type Survey, type SurveyStatus } from '../lib/types.ts'

type PendingAction =
  | { kind: 'delete'; survey: Survey; responses: number }
  | { kind: 'archive'; survey: Survey }
  | { kind: 'close'; survey: Survey }
  | { kind: 'activate'; survey: Survey; current: Survey }

export default function Dashboard() {
  const navigate = useNavigate()
  const [surveys, setSurveys] = useState<Survey[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SurveyStatus | 'all'>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const load = useCallback(async () => {
    try {
      setSurveys(await listSurveys())
    } catch (e) {
      setError(friendlyError(e))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** Runs a mutation for one survey with busy state, error handling, and reload. */
  async function run(surveyId: string, action: () => Promise<void>) {
    setBusyId(surveyId)
    setError(null)
    try {
      await action()
      await load()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusyId(null)
      setPending(null)
    }
  }

  function requestActivate(survey: Survey) {
    const current = surveys?.find((s) => s.status === 'active' && s.id !== survey.id)
    if (current) setPending({ kind: 'activate', survey, current })
    else doActivate(survey)
  }

  function doActivate(survey: Survey) {
    run(survey.id, async () => {
      await activateSurvey(survey.id)
      navigate(`/surveys/${survey.id}/present`)
    })
  }

  async function requestDelete(survey: Survey) {
    setBusyId(survey.id)
    try {
      const responses = await getResponseCount(survey.id)
      setPending({ kind: 'delete', survey, responses })
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusyId(null)
    }
  }

  function doDuplicate(survey: Survey) {
    run(survey.id, async () => {
      const newId = await duplicateSurvey(survey.id)
      navigate(`/surveys/${newId}/edit`)
    })
  }

  function confirmPending() {
    if (!pending) return
    const { survey } = pending
    if (pending.kind === 'delete') run(survey.id, () => deleteSurvey(survey.id))
    if (pending.kind === 'archive') run(survey.id, () => archiveSurvey(survey.id))
    if (pending.kind === 'close') run(survey.id, () => closeSurvey(survey.id))
    if (pending.kind === 'activate') doActivate(survey)
  }

  const term = search.trim().toLowerCase()
  const visible = (surveys ?? []).filter((s) => {
    const created = new Date(s.created_at).toLocaleDateString('en-CA') // local YYYY-MM-DD
    return (
      (statusFilter === 'all' || s.status === statusFilter) &&
      s.title.toLowerCase().includes(term) &&
      (!fromDate || created >= fromDate) &&
      (!toDate || created <= toDate)
    )
  })

  return (
    <InstructorLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link to="/surveys/new" className="btn-primary">
          New Survey
        </Link>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="search" className="mb-1 block text-sm font-medium">
            Search
          </label>
          <input
            id="search"
            type="search"
            placeholder="Survey title"
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium">
            Status
          </label>
          <select
            id="status"
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SurveyStatus | 'all')}
          >
            <option value="all">All</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from" className="mb-1 block text-sm font-medium">
            Created from
          </label>
          <input
            id="from"
            type="date"
            className="input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="to" className="mb-1 block text-sm font-medium">
            Created to
          </label>
          <input
            id="to"
            type="date"
            className="input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      <div className="mb-4">
        <ErrorMessage message={error} />
      </div>

      {surveys === null && !error && <Loading message="Loading surveys..." />}

      {surveys?.length === 0 && (
        <div className="card text-center">
          <p className="mb-4">You have not created any surveys yet.</p>
          <Link to="/surveys/new" className="btn-primary">
            Create Your First Survey
          </Link>
        </div>
      )}

      {surveys && surveys.length > 0 && visible.length === 0 && (
        <p className="text-slate-600">No surveys match your search.</p>
      )}

      <ul className="space-y-4">
        {visible.map((s) => {
          const busy = busyId === s.id
          return (
            <li key={s.id} className="card">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold break-words">{s.title}</h2>
                <StatusBadge status={s.status} />
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Created:{' '}
                {new Date(s.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              <div className="mt-4 flex flex-wrap gap-2" aria-busy={busy}>
                {s.status === 'active' && (
                  <>
                    <Link to={`/surveys/${s.id}/present`} className="btn-primary">
                      Present
                    </Link>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() => setPending({ kind: 'close', survey: s })}
                    >
                      Close
                    </button>
                  </>
                )}
                {(s.status === 'draft' || s.status === 'closed') && (
                  <>
                    <Link to={`/surveys/${s.id}/edit`} className="btn-secondary">
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() => requestActivate(s)}
                    >
                      Activate
                    </button>
                  </>
                )}
                <Link to={`/surveys/${s.id}/results`} className="btn-secondary">
                  Results
                </Link>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => doDuplicate(s)}
                >
                  Duplicate
                </button>
                {(s.status === 'draft' || s.status === 'closed') && (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() => setPending({ kind: 'archive', survey: s })}
                  >
                    Archive
                  </button>
                )}
                {s.status !== 'active' && (
                  <button
                    type="button"
                    className="btn-secondary text-red-700"
                    disabled={busy}
                    onClick={() => requestDelete(s)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        open={pending !== null}
        busy={busyId !== null}
        danger={pending?.kind === 'delete'}
        title={
          pending?.kind === 'delete'
            ? `Delete "${pending.survey.title}"?`
            : pending?.kind === 'archive'
              ? `Archive "${pending.survey.title}"?`
              : pending?.kind === 'close'
                ? `Close "${pending.survey.title}"?`
                : `Activate "${pending?.survey.title ?? ''}"?`
        }
        confirmLabel={
          pending?.kind === 'delete'
            ? 'Delete'
            : pending?.kind === 'archive'
              ? 'Archive'
              : pending?.kind === 'close'
                ? 'Close Survey'
                : 'Activate'
        }
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      >
        {pending?.kind === 'delete' &&
          (pending.responses > 0 ? (
            <p>
              <strong className="text-red-700">
                This survey has {pending.responses} response{pending.responses === 1 ? '' : 's'}.
              </strong>{' '}
              Deleting it permanently erases the survey and all of its responses. Consider archiving
              instead.
            </p>
          ) : (
            <p>This will permanently delete the survey and all of its responses.</p>
          ))}
        {pending?.kind === 'archive' && (
          <p>Archived surveys are hidden from active use but their results are kept.</p>
        )}
        {pending?.kind === 'close' && <p>Students will no longer be able to submit responses.</p>}
        {pending?.kind === 'activate' && (
          <p>"{pending.current.title}" is currently active and will be closed.</p>
        )}
      </ConfirmDialog>
    </InstructorLayout>
  )
}
