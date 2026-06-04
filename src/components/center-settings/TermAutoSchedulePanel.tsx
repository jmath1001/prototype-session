'use client'

import { useState, useMemo } from 'react'
import {
  Loader2, X, Play, AlertTriangle, ChevronDown, Check,
  CalendarDays, CalendarClock, RotateCcw,
} from 'lucide-react'
import type { TermRow } from './types'

// ── Types from slot-scheduler ─────────────────────────────────────────────────

interface SlotAssignment {
  studentId: string
  studentName: string
  subject: string
  choiceUsed: 1 | 2 | 3
  blocks: string[]
  tutorId: string
  tutorName: string
}

interface UnmatchedStudent {
  studentId: string
  studentName: string
  subject: string
  reason: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DOW_LABELS: Record<string, string> = {
  '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat', '7': 'Sun',
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

function parseBlock(b: string): { dow: string; time: string } | null {
  const m = b.match(/^(\d)-([\d:]+)$/)
  return m ? { dow: m[1], time: m[2] } : null
}

function blockLabel(blocks: string[]): string {
  if (!blocks.length) return '--'
  const first = parseBlock(blocks[0])
  if (!first) return blocks[0]
  const dayStr = DOW_LABELS[first.dow] ?? `Day ${first.dow}`
  if (blocks.length === 1) return `${dayStr} ${formatTime(first.time)}`
  const last = parseBlock(blocks[blocks.length - 1])
  return `${dayStr} ${formatTime(first.time)}–${last ? formatTime(last.time) : ''} (2h)`
}

function choiceCls(c: 1 | 2 | 3): string {
  return c === 1 ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
       : c === 2 ? 'bg-amber-100 text-amber-700 border-amber-200'
       :           'bg-slate-100 text-slate-500 border-slate-200'
}

function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function fmtDate(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProposalView({
  assignments,
  unmatched,
}: {
  assignments: SlotAssignment[]
  unmatched: UnmatchedStudent[]
}) {
  const byBlock: Record<string, SlotAssignment[]> = {}
  for (const a of assignments) {
    const key = a.blocks[0] ?? 'unknown'
    ;(byBlock[key] = byBlock[key] ?? []).push(a)
  }
  const sortedKeys = Object.keys(byBlock).sort()

  return (
    <div className="space-y-3">
      {sortedKeys.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Placed ({assignments.length})
          </p>
          <div className="space-y-1.5">
            {sortedKeys.map(bk => {
              const parsed = parseBlock(bk)
              const label = parsed
                ? `${DOW_LABELS[parsed.dow] ?? `Day ${parsed.dow}`} ${formatTime(parsed.time)}`
                : bk
              return (
                <div key={bk} className="overflow-hidden rounded border border-slate-200">
                  <div className="bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-700 border-b border-slate-200">
                    {label}
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {byBlock[bk].map((a, i) => (
                      <li key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${choiceCls(a.choiceUsed)}`}>
                          C{a.choiceUsed}
                        </span>
                        <span className="font-semibold text-slate-800">{a.studentName}</span>
                        {a.subject && <span className="text-slate-400">· {a.subject}</span>}
                        <span className="ml-auto text-slate-500 text-[11px]">{a.tutorName}</span>
                        {a.blocks.length === 2 && (
                          <span className="text-indigo-600 font-semibold text-[10px]">2h</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {unmatched.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Unmatched ({unmatched.length})
          </p>
          <ul className="space-y-1">
            {unmatched.map((u, i) => (
              <li key={i} className="flex items-start gap-2 rounded border border-red-100 bg-red-50 px-3 py-2 text-xs">
                <AlertTriangle size={12} className="mt-0.5 shrink-0 text-red-400" />
                <div>
                  <span className="font-semibold text-red-800">{u.studentName}</span>
                  {u.subject && <span className="text-red-500 ml-1">· {u.subject}</span>}
                  <p className="text-red-500 mt-0.5">{u.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  term: TermRow
  onClose: () => void
}

type Step = 'options' | 'proposal' | 'applied'

export function TermAutoSchedulePanel({ term, onClose }: Props) {
  const todayMonday = getMondayOf(new Date().toISOString().slice(0, 10))
  const termMonday  = getMondayOf(term.start_date)
  const defaultWeek = todayMonday >= term.start_date && todayMonday <= term.end_date
    ? todayMonday : termMonday

  // Options state
  const [applyMode, setApplyMode] = useState<'recurring' | 'week'>('recurring')
  const [weekStart, setWeekStart] = useState(defaultWeek)
  const [skipExisting, setSkipExisting] = useState(true)

  // Fetch / proposal state
  const [step, setStep] = useState<Step>('options')
  const [running, setRunning]   = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const [assignments, setAssignments] = useState<SlotAssignment[]>([])
  const [unmatched, setUnmatched]     = useState<UnmatchedStudent[]>([])
  const [applyResult, setApplyResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)

  const weekEnd = addDays(weekStart, 6)

  // ── Run the slot-scheduler ────────────────────────────────────────────────
  const handleRunScheduler = async () => {
    setRunning(true)
    setError(null)
    setAssignments([])
    setUnmatched([])
    try {
      const res = await fetch('/api/slot-scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termId: term.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Scheduler failed')
      setAssignments(data.assignments ?? [])
      setUnmatched(data.unmatched ?? [])
      setStep('proposal')
    } catch (err: any) {
      setError(err?.message ?? 'Unexpected error')
    } finally {
      setRunning(false)
    }
  }

  // ── Apply the proposal ────────────────────────────────────────────────────
  const handleApply = async () => {
    setApplying(true)
    setError(null)
    try {
      const res = await fetch('/api/auto-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          termId: term.id,
          assignments,
          mode: applyMode,
          weekStart: applyMode === 'week' ? weekStart : undefined,
          skipExisting,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Apply failed')
      setApplyResult(data)
      setStep('applied')
    } catch (err: any) {
      setError(err?.message ?? 'Unexpected error')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Play size={13} className="text-indigo-600" />
          <p className="text-xs font-bold text-slate-800">
            Schedule Builder — <span className="text-indigo-700">{term.name}</span>
          </p>
          {step !== 'options' && (
            <button
              onClick={() => { setStep('options'); setError(null) }}
              className="ml-1 flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
            >
              <RotateCcw size={10} /> Reset
            </button>
          )}
        </div>
        <button onClick={onClose} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X size={14} />
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* ── Step 1: options ── */}
      {step === 'options' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Runs the slot-scheduler against students' submitted preferences for{' '}
            <span className="font-semibold text-slate-700">{term.name}</span>, then lets you
            apply the proposal as recurring sessions or for a single week.
          </p>

          {/* Apply scope */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Apply scope</p>
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
                <input type="radio" name="apply-mode" value="recurring" checked={applyMode === 'recurring'}
                  onChange={() => setApplyMode('recurring')} className="accent-indigo-600" />
                <CalendarClock size={13} className="text-indigo-500" />
                Recurring — create sessions for every week of the term
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  {term.start_date} → {term.end_date}
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
                <input type="radio" name="apply-mode" value="week" checked={applyMode === 'week'}
                  onChange={() => setApplyMode('week')} className="accent-indigo-600" />
                <CalendarDays size={13} className="text-indigo-500" />
                One week only
              </label>

              {applyMode === 'week' && (
                <div className="ml-5 space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-500">Week starting (Monday)</label>
                  <input
                    type="date"
                    value={weekStart}
                    min={getMondayOf(term.start_date)}
                    max={term.end_date}
                    onChange={e => setWeekStart(getMondayOf(e.target.value))}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400">{fmtDate(weekStart)} — {fmtDate(weekEnd)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Options */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Options</p>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
              <input type="checkbox" checked={skipExisting} onChange={e => setSkipExisting(e.target.checked)}
                className="accent-indigo-600" />
              Skip students already scheduled in the target date range
              <span className="text-[11px] text-slate-400">(won't touch existing sessions)</span>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleRunScheduler}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {running ? <><Loader2 size={12} className="animate-spin" /> Running…</> : <><Play size={12} /> Run Scheduler</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: review proposal ── */}
      {step === 'proposal' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
              {assignments.length} placed
            </span>
            {unmatched.length > 0 && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                {unmatched.length} unmatched
              </span>
            )}
            <span className="text-[11px] text-slate-400 ml-1">
              {applyMode === 'recurring'
                ? `Apply as recurring \u00b7 ${term.start_date} \u2192 ${term.end_date}`
                : `Apply for week of ${fmtDate(weekStart)}`}
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto rounded border border-slate-200 bg-white p-3">
            <ProposalView assignments={assignments} unmatched={unmatched} />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setStep('options')}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Back
            </button>
            <button
              onClick={handleApply}
              disabled={applying || assignments.length === 0}
              className="inline-flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {applying
                ? <><Loader2 size={12} className="animate-spin" /> Applying…</>
                : applyMode === 'recurring'
                  ? <><CalendarClock size={12} /> Apply Recurring ({assignments.length})</>
                  : <><CalendarDays size={12} /> Apply This Week ({assignments.length})</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: results ── */}
      {step === 'applied' && applyResult && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sessions created</p>
              <p className="text-xl font-bold text-emerald-600">{applyResult.created}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Students skipped</p>
              <p className="text-xl font-bold text-slate-400">{applyResult.skipped}</p>
            </div>
            {applyResult.errors.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Errors</p>
                <p className="text-xl font-bold text-red-500">{applyResult.errors.length}</p>
              </div>
            )}
          </div>
          {applyResult.errors.length > 0 && (
            <ul className="space-y-1">
              {applyResult.errors.map((e, i) => (
                <li key={i} className="text-[11px] text-red-600">{e}</li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setStep('options'); setApplyResult(null); setAssignments([]); setUnmatched([]) }}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Run Again
            </button>
            <button onClick={onClose}
              className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">
              Done
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
