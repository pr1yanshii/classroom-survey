import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Link, useParams } from 'react-router'
import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import ErrorMessage from '../components/ErrorMessage.tsx'
import InstructorLayout from '../components/InstructorLayout.tsx'
import Loading from '../components/Loading.tsx'
import StatusBadge from '../components/StatusBadge.tsx'
import { getChoiceCounts, getExportData, getResponseCount, getSurvey } from '../lib/api.ts'
import { downloadCsv, slugify, toCsv } from '../lib/csv.ts'
import { friendlyError } from '../lib/errors.ts'
import { buildCsvRows, buildResults, type QuestionResult } from '../lib/results.ts'
import type { SurveyWithQuestions } from '../lib/types.ts'

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

// Phones get narrower axis labels so the bars keep usable width (full text is in the table).
const narrowQuery = '(max-width: 639px)'
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(narrowQuery)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const useNarrow = () =>
  useSyncExternalStore(subscribe, () => window.matchMedia(narrowQuery).matches)

export default function Results() {
  const { id } = useParams() as { id: string }
  const narrow = useNarrow()
  const [survey, setSurvey] = useState<SurveyWithQuestions | null>(null)
  const [total, setTotal] = useState(0)
  const [results, setResults] = useState<QuestionResult[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [s, rows, n] = await Promise.all([
        getSurvey(id),
        getChoiceCounts(id),
        getResponseCount(id),
      ])
      setSurvey(s)
      setTotal(n)
      if (s) setResults(buildResults(s, new Map(rows.map((r) => [r.choice_id, r.answer_count]))))
      setUpdatedAt(new Date())
    } catch (e) {
      setError(friendlyError(e))
    }
  }, [id])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  async function refresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  async function exportCsv() {
    if (!survey) return
    setExporting(true)
    setError(null)
    try {
      const data = await getExportData(
        survey.id,
        survey.questions.map((q) => q.id),
      )
      const rows = buildCsvRows(survey, data)
      const date = new Date().toISOString().slice(0, 10)
      downloadCsv(`${slugify(survey.title)}-results-${date}.csv`, toCsv(rows))
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setExporting(false)
    }
  }

  if (loading)
    return (
      <InstructorLayout>
        <Loading message="Loading results..." />
      </InstructorLayout>
    )

  if (!survey)
    return (
      <InstructorLayout>
        <ErrorMessage message={error} />
        <p className="my-4">Survey not found.</p>
        <Link to="/dashboard" className="btn-secondary">
          Back to Dashboard
        </Link>
      </InstructorLayout>
    )

  return (
    <InstructorLayout>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold break-words">{survey.title}</h1>
          <StatusBadge status={survey.status} />
        </div>
        <p className="mt-1 text-lg">
          {total} response{total === 1 ? '' : 's'}
        </p>
        {updatedAt && (
          <p className="text-sm text-slate-600">Updated {updatedAt.toLocaleTimeString()}</p>
        )}
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={refresh} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={exportCsv}
          disabled={exporting || total === 0}
        >
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
        {survey.status !== 'archived' && (
          <Link to={`/surveys/${id}/present`} className="btn-secondary">
            Present QR
          </Link>
        )}
        <Link to="/dashboard" className="btn-secondary">
          Back to Dashboard
        </Link>
      </div>

      <div className="mb-6">
        <ErrorMessage message={error} />
      </div>

      {total === 0 && (
        <div className="card mb-6 text-center">
          <p className="font-medium">No responses yet.</p>
          <p className="text-slate-600">Display the QR code so students can join.</p>
        </div>
      )}

      <ol className="space-y-6">
        {results.map((q, qi) => {
          const unanswered = total - q.answered
          return (
            <li key={q.question_id} className="card">
              <h2 className="text-lg font-semibold break-words">
                {qi + 1}. {q.question_text}
              </h2>
              <p className="text-sm text-slate-600">
                {q.answered} answer{q.answered === 1 ? '' : 's'}
                {unanswered > 0 && ` · ${unanswered} unanswered`}
              </p>

              {q.answered === 0 ? (
                <p className="mt-4 rounded-md bg-slate-100 px-4 py-3 text-slate-700">
                  No answers to this question yet.
                </p>
              ) : (
                <div
                  className="mt-4"
                  role="img"
                  aria-label={`Bar chart for question ${qi + 1}. Exact values are in the table below.`}
                >
                  <ResponsiveContainer width="100%" height={q.choices.length * 52 + 20}>
                    <BarChart
                      data={q.choices}
                      layout="vertical"
                      margin={{ top: 4, right: narrow ? 80 : 96, bottom: 4, left: 0 }}
                    >
                      <XAxis type="number" hide allowDecimals={false} domain={[0, 'dataMax']} />
                      <YAxis
                        type="category"
                        dataKey="choice_text"
                        width={narrow ? 96 : 170}
                        tickFormatter={(v: string) => truncate(v, narrow ? 14 : 28)}
                        tick={{ fill: '#0f172a', fontSize: narrow ? 12 : 14 }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#1d4ed8"
                        barSize={28}
                        minPointSize={2}
                        isAnimationActive={false}
                      >
                        <LabelList
                          dataKey="label"
                          position="right"
                          fill="#0f172a"
                          fontSize={narrow ? 12 : 14}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <table className="mt-4 w-full text-left text-sm">
                <caption className="sr-only">Results for question {qi + 1}</caption>
                <thead>
                  <tr className="border-b border-slate-200">
                    <th scope="col" className="py-2 font-medium">
                      Choice
                    </th>
                    <th scope="col" className="w-24 py-2 text-right font-medium">
                      Count
                    </th>
                    <th scope="col" className="w-24 py-2 text-right font-medium">
                      Percent
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {q.choices.map((c) => (
                    <tr key={c.choice_id} className="border-b border-slate-100">
                      <td className="py-2 pr-4 break-words">{c.choice_text}</td>
                      <td className="py-2 text-right tabular-nums">{c.count}</td>
                      <td className="py-2 text-right tabular-nums">{c.percentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </li>
          )
        })}
      </ol>
    </InstructorLayout>
  )
}
