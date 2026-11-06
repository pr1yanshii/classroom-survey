import { STATUS_LABELS, type SurveyStatus } from '../lib/types.ts'

// Text label + color so status never relies on color alone (UI.md §13)
const STYLES: Record<SurveyStatus, string> = {
  draft: 'bg-slate-100 text-slate-800 border-slate-300',
  active: 'bg-green-100 text-green-900 border-green-300',
  closed: 'bg-amber-100 text-amber-900 border-amber-300',
  archived: 'bg-zinc-200 text-zinc-800 border-zinc-400',
}

export default function StatusBadge({ status }: { status: SurveyStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-sm font-medium ${STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
