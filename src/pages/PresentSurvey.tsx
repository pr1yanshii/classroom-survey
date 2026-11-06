import QRCode from 'qrcode'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import ConfirmDialog from '../components/ConfirmDialog.tsx'
import ErrorMessage from '../components/ErrorMessage.tsx'
import Loading from '../components/Loading.tsx'
import { activateSurvey, closeSurvey, getResponseCount, getSurvey } from '../lib/api.ts'
import { slugify } from '../lib/csv.ts'
import { friendlyError } from '../lib/errors.ts'
import type { Survey } from '../lib/types.ts'
import { publicSurveyUrl } from '../lib/url.ts'

const POLL_MS = 3000

// Projector view (UI.md §6): large QR, readable URL, live count, no app chrome.
export default function PresentSurvey() {
  const { id } = useParams() as { id: string }
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [loading, setLoading] = useState(true)
  const [qr, setQr] = useState<string | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const s = await getSurvey(id)
      setSurvey(s)
      if (s) setCount(await getResponseCount(id))
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const url = survey?.public_slug ? publicSurveyUrl(survey.public_slug) : null

  useEffect(() => {
    if (!url) return
    QRCode.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setError('Could not generate the QR code.'))
  }, [url])

  // Live response count while active.
  useEffect(() => {
    if (survey?.status !== 'active') return
    const timer = setInterval(() => {
      getResponseCount(id)
        .then((n) => {
          setCount(n)
          setError(null)
        })
        .catch((e) => setError(friendlyError(e)))
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [id, survey?.status])

  async function mutate(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
      setConfirmClose(false)
      await load()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loading message="Loading survey..." />

  if (!survey)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <ErrorMessage message={error} />
        <p className="text-xl">Survey not found.</p>
        <Link to="/dashboard" className="btn-secondary">
          Back to Dashboard
        </Link>
      </main>
    )

  const active = survey.status === 'active'

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-4 py-6 text-center">
      <h1 className="max-w-5xl text-3xl font-bold break-words sm:text-4xl xl:text-5xl">
        {survey.title}
      </h1>

      {active && qr && url ? (
        <>
          <img
            src={qr}
            alt={`QR code linking to ${url}`}
            className="aspect-square w-[min(80vw,50vh)] max-w-[640px]"
          />
          <p className="font-mono text-2xl break-all sm:text-4xl">
            {url.replace(/^https?:\/\//, '')}
          </p>
        </>
      ) : (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-6 py-4 text-xl text-amber-900">
          This survey is not active. Students cannot submit responses.
        </p>
      )}

      <p className="text-2xl sm:text-3xl" aria-live="polite">
        Responses: <strong>{count ?? '…'}</strong>
      </p>

      <ErrorMessage message={error} />

      <div className="flex flex-wrap justify-center gap-3">
        <Link to={`/surveys/${id}/results`} className="btn-secondary">
          View Results
        </Link>
        {active && qr && (
          <a href={qr} download={`${slugify(survey.title)}-qr.png`} className="btn-secondary">
            Download QR Code
          </a>
        )}
        {active ? (
          <button type="button" className="btn-danger" onClick={() => setConfirmClose(true)}>
            Close Survey
          </button>
        ) : (
          survey.status !== 'archived' && (
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => mutate(() => activateSurvey(id))}
            >
              {busy ? 'Activating...' : 'Activate'}
            </button>
          )
        )}
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            document.fullscreenElement
              ? document.exitFullscreen()
              : document.documentElement.requestFullscreen()
          }
        >
          Full Screen
        </button>
        <Link to="/dashboard" className="btn-secondary">
          Dashboard
        </Link>
      </div>

      <ConfirmDialog
        open={confirmClose}
        busy={busy}
        title={`Close "${survey.title}"?`}
        confirmLabel="Close Survey"
        onConfirm={() => mutate(() => closeSurvey(id))}
        onCancel={() => setConfirmClose(false)}
      >
        <p>Students will no longer be able to submit responses.</p>
      </ConfirmDialog>
    </main>
  )
}
