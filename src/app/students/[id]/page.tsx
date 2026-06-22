"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, AlertTriangle, Repeat2, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { DB, withCenter } from '@/lib/db'
import { dayOfWeek, getCentralTimeNow, toISODate } from '@/lib/useScheduleData'
import { getSessionsForDay, SESSION_BLOCKS } from '@/components/constants'

const STUDENTS = DB.students
const SESSIONS  = DB.sessions
const SS        = DB.sessionStudents
const TUTORS    = DB.tutors

type HistoryRow = {
  rowId: string
  date: string
  time: string
  blockLabel: string
  tutorId: string
  tutorName: string
  topic: string
  status: string
  notes: string | null
  seriesId: string | null
}

type TimelineItem =
  | { kind: 'single'; key: string; row: HistoryRow; sortDate: string }
  | {
      kind: 'series'
      key: string
      seriesId: string
      topic: string
      tutorName: string
      blockLabel: string
      firstDate: string
      lastDate: string
      focusDate: string
      time: string
      count: number
      present: number
      noShow: number
      unmarked: number
      sortDate: string
    }

function statusBadge(status: string, date: string, today: string) {
  if (status === 'present' || status === 'confirmed')
    return { text: 'Present',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  if (status === 'no-show')
    return { text: 'No-show',   cls: 'bg-red-50 text-red-600 border-red-200' }
  if (status === 'cancelled')
    return { text: 'Cancelled', cls: 'bg-slate-100 text-slate-400 border-slate-200' }
  if (status === 'off')
    return { text: 'Off',       cls: 'bg-slate-100 text-slate-400 border-slate-200' }
  if (date < today)
    return { text: 'Unmarked',  cls: 'bg-amber-50 text-amber-600 border-amber-200' }
  return       { text: 'Upcoming',  cls: 'bg-blue-50 text-blue-600 border-blue-200' }
}

function isUnmarked(row: HistoryRow, today: string) {
  return (
    row.date < today &&
    row.status !== 'present' &&
    row.status !== 'confirmed' &&
    row.status !== 'no-show' &&
    row.status !== 'cancelled' &&
    row.status !== 'off'
  )
}

function DateBlock({
  date,
  dim = false,
  purple = false,
}: {
  date: string
  dim?: boolean
  purple?: boolean
}) {
  const d = new Date(date + 'T00:00:00')
  return (
    <div className="w-9 shrink-0 text-center">
      <p className={`text-[9px] font-bold uppercase leading-none ${purple ? 'text-violet-400' : 'text-slate-300'}`}>
        {d.toLocaleDateString('en-US', { month: 'short' })}
      </p>
      <p className={`text-[17px] font-black leading-tight ${purple ? 'text-violet-700' : dim ? 'text-slate-300' : 'text-slate-900'}`}>
        {d.getDate()}
      </p>
      <p className={`text-[9px] font-semibold uppercase leading-none ${purple ? 'text-violet-500' : 'text-slate-400'}`}>
        {d.toLocaleDateString('en-US', { weekday: 'short' })}
      </p>
    </div>
  )
}

export default function StudentHistoryPage() {
  const params    = useParams<{ id: string }>()
  const studentId = String(params?.id ?? '')

  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [student, setStudent]   = useState<any | null>(null)
  const [history, setHistory]   = useState<HistoryRow[]>([])
  const [tab, setTab]           = useState<'all' | 'upcoming' | 'past'>('all')
  const [editingRowId, setEditingRowId]   = useState<string | null>(null)
  const [editDraft, setEditDraft]         = useState({ status: '', topic: '', notes: '' })
  const [editSaving, setEditSaving]       = useState(false)
  const [revertingRowId, setRevertingRowId] = useState<string | null>(null)
  const [weeklyScheduleOpen, setWeeklyScheduleOpen] = useState(false)
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!studentId) return
      setLoading(true)
      setError(null)
      try {
        const [
          { data: studentRow, error: studentErr },
          { data: rows,       error: rowsErr },
          { data: tutorRows,  error: tutorErr },
          { data: exRows },
        ] = await Promise.all([
          withCenter(supabase.from(STUDENTS).select('*').eq('id', studentId)).single(),
          (withCenter(supabase
            .from(SS)
            .select(`id, topic, status, notes, series_id, session_id, ${SESSIONS}(id, session_date, time, tutor_id)`)
            .eq('student_id', studentId)) as any),
          withCenter(supabase.from(TUTORS).select('id, name')),
          (withCenter(supabase.from(DB.studentDateExceptions).select('id, series_id, exception_date, reason').eq('student_id', studentId)) as any),
        ])

        if (studentErr) throw studentErr
        if (rowsErr)    throw rowsErr
        if (tutorErr)   throw tutorErr

        const tutorMap = new Map<string, string>(
          (tutorRows ?? []).map((t: any) => [String(t.id), t.name])
        )

        const mapped = (rows ?? [])
          .map((r: any) => {
            const session = Array.isArray(r[SESSIONS]) ? r[SESSIONS][0] : r[SESSIONS]
            if (!session?.session_date) return null
            const blockLabel =
              getSessionsForDay(dayOfWeek(session.session_date))
                .find((b: any) => b.time === session.time)?.label ?? session.time
            return {
              rowId:     r.id,
              date:      session.session_date,
              time:      session.time,
              blockLabel,
              tutorId:   session.tutor_id,
              tutorName: tutorMap.get(String(session.tutor_id)) ?? 'Unknown',
              topic:     r.topic ?? 'Session',
              status:    r.status ?? 'scheduled',
              notes:     r.notes ?? null,
              seriesId:  r.series_id ?? null,
            }
          })
          .filter(Boolean)

        const exceptionRows: HistoryRow[] = (exRows ?? []).map((e: any) => ({
          rowId:      `exc:${e.id}`,
          date:       e.exception_date,
          time:       '',
          blockLabel: '',
          tutorId:    '',
          tutorName:  '',
          topic:      'Planned Absence',
          status:     'off',
          notes:      e.reason ?? null,
          seriesId:   e.series_id ?? null,
        }))

        if (!cancelled) {
          setStudent(studentRow)
          setHistory(
            [...(mapped as HistoryRow[]), ...exceptionRows]
              .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
          )
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [studentId])

  const today    = toISODate(getCentralTimeNow())
  const past     = useMemo(() => history.filter(s => s.date < today), [history, today])
  const upcoming = useMemo(() => history.filter(s => s.date >= today && s.status !== 'cancelled'), [history, today])

  // Stats for header pills
  const pastActive     = useMemo(() => past.filter(s => s.status !== 'cancelled' && s.status !== 'off'), [past])
  const presentCount   = useMemo(() => pastActive.filter(s => s.status === 'present' || s.status === 'confirmed').length, [pastActive])
  const noShowCount    = useMemo(() => pastActive.filter(s => s.status === 'no-show').length, [pastActive])
  const cancelledCount = useMemo(() => history.filter(s => s.status === 'cancelled').length, [history])
  const unmarkedCount  = useMemo(() => pastActive.filter(s => isUnmarked(s, today)).length, [pastActive, today])
  const attendancePct  = pastActive.length > 0 ? Math.round((presentCount / pastActive.length) * 100) : null

  // Weekly schedule — unique recurring slots
  const weeklySchedule = useMemo(() => {
    const DAYS = [
      { abbr: 'Mon', dow: 1 },
      { abbr: 'Tue', dow: 2 },
      { abbr: 'Wed', dow: 3 },
      { abbr: 'Thu', dow: 4 },
      { abbr: 'Fri', dow: 5 },
      { abbr: 'Sat', dow: 6 },
    ]
    const seen = new Map<string, { dow: number; tutorName: string; blockLabel: string; topic: string }>()
    for (const row of history) {
      if (row.seriesId && !seen.has(row.seriesId)) {
        seen.set(row.seriesId, {
          dow:        new Date(row.date + 'T00:00:00').getDay(),
          tutorName:  row.tutorName,
          blockLabel: row.blockLabel,
          topic:      row.topic,
        })
      }
    }
    const byDow: Record<number, Array<{ tutorName: string; blockLabel: string; topic: string }>> = {}
    for (const slot of seen.values()) {
      if (!byDow[slot.dow]) byDow[slot.dow] = []
      byDow[slot.dow].push({ tutorName: slot.tutorName, blockLabel: slot.blockLabel, topic: slot.topic })
    }
    return DAYS.map(day => ({ ...day, slots: byDow[day.dow] ?? [] }))
  }, [history])

  const weeklySlotCount = useMemo(
    () => weeklySchedule.reduce((sum, day) => sum + day.slots.length, 0),
    [weeklySchedule]
  )

  // Grouped timeline
  const groupedTimeline = useMemo((): TimelineItem[] => {
    const source =
      tab === 'upcoming' ? upcoming :
      tab === 'past'     ? past :
      history

    const singles: TimelineItem[] = []
    const buckets  = new Map<string, HistoryRow[]>()

    for (const row of source) {
      if (row.seriesId) {
        const key = row.seriesId
        buckets.set(key, [...(buckets.get(key) ?? []), row])
      } else {
        singles.push({ kind: 'single', key: `single-${row.rowId}`, row, sortDate: `${row.date}T${row.time}` })
      }
    }

    const seriesItems: TimelineItem[] = Array.from(buckets.entries()).map(([seriesId, rows]) => {
      const asc  = [...rows].sort((a, b) => a.date.localeCompare(b.date))
      const desc = [...rows].sort((a, b) => b.date.localeCompare(a.date))
      const focus = tab === 'upcoming' ? asc[0] : desc[0]
      return {
        kind:       'series',
        key:        `series-${seriesId}`,
        seriesId,
        topic:      focus.topic,
        tutorName:  focus.tutorName,
        blockLabel: focus.blockLabel,
        time:       focus.time,
        firstDate:  asc[0].date,
        lastDate:   desc[0].date,
        focusDate:  focus.date,
        count:      rows.length,
        present:    rows.filter(r => r.status === 'present' || r.status === 'confirmed').length,
        noShow:     rows.filter(r => r.status === 'no-show').length,
        unmarked:   rows.filter(r => isUnmarked(r, today)).length,
        sortDate:   `${focus.date}T${focus.time}`,
      }
    })

    return [...singles, ...seriesItems].sort((a, b) => {
      const cmp = a.sortDate.localeCompare(b.sortDate)
      return tab === 'upcoming' ? cmp : -cmp
    })
  }, [tab, history, past, upcoming, today])

  useEffect(() => {
    if (expandedSeries.size > 0) return
    const seriesKeys = groupedTimeline
      .filter((item): item is Extract<TimelineItem, { kind: 'series' }> => item.kind === 'series')
      .map(item => item.key)
    if (seriesKeys.length === 0) return
    setExpandedSeries(new Set(seriesKeys))
  }, [groupedTimeline, expandedSeries.size])

  const handleSaveEdit = async () => {
    if (!editingRowId || !student) return
    setEditSaving(true)
    try {
      await withCenter(
        supabase.from(SS).update({
          status: editDraft.status,
          topic:  editDraft.topic,
          notes:  editDraft.notes || null,
        }).eq('id', editingRowId)
      )
      setHistory(prev =>
        prev.map(r =>
          r.rowId === editingRowId
            ? { ...r, status: editDraft.status, topic: editDraft.topic, notes: editDraft.notes || null }
            : r
        )
      )
      setEditingRowId(null)
    } catch (err: any) {
      alert(err?.message ?? 'Failed to save')
    } finally {
      setEditSaving(false)
    }
  }

  const handleRevertCancelled = async (row: HistoryRow) => {
    if (!row.rowId || row.rowId.startsWith('exc:')) return
    setRevertingRowId(row.rowId)
    try {
      const cleanedNotes = (row.notes ?? '')
        .replace(/\n?\n?excused absence/ig, '')
        .trim()

      await withCenter(
        supabase
          .from(SS)
          .update({ status: 'scheduled', notes: cleanedNotes || null })
          .eq('id', row.rowId)
      )

      setHistory(prev =>
        prev.map(r =>
          r.rowId === row.rowId
            ? { ...r, status: 'scheduled', notes: cleanedNotes || null }
            : r
        )
      )
    } catch (err: any) {
      alert(err?.message ?? 'Failed to revert session')
    } finally {
      setRevertingRowId(null)
    }
  }

  const inputCls = "w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-slate-400"

  function SingleRow({ row, indented = false }: { row: HistoryRow; indented?: boolean }) {
    const badge     = statusBadge(row.status, row.date, today)
    const unmarked  = isUnmarked(row, today)
    const isEditing = editingRowId === row.rowId
    const canEdit   = row.status !== 'cancelled' && row.status !== 'off'
    const canRevert = row.status === 'cancelled' && !row.rowId.startsWith('exc:')

    return (
      <div className={unmarked ? 'bg-amber-50/40' : ''}>
        <div className={`group flex items-center gap-3 border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${indented ? 'pl-10 pr-4 py-2.5' : 'px-4 py-2.5'}`}>
          <DateBlock date={row.date} dim={row.status === 'cancelled'} />
          <div className="flex-1 min-w-0">
            <p className={`text-[13px] font-semibold truncate ${row.status === 'cancelled' ? 'line-through text-slate-300' : 'text-slate-900'}`}>
              {row.topic}
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5 truncate">
              {[row.tutorName, row.blockLabel].filter(Boolean).join(' · ')}
            </p>
            {row.notes && (
              <p className="text-[10px] text-slate-500 italic mt-0.5 truncate">"{row.notes}"</p>
            )}
          </div>
          <span className={`border rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none shrink-0 ${badge.cls}`}>
            {badge.text}
          </span>
          {canEdit && !isEditing && (
            <button
              onClick={() => { setEditingRowId(row.rowId); setEditDraft({ status: row.status, topic: row.topic, notes: row.notes ?? '' }) }}
              className="text-[9px] font-semibold text-slate-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
            >
              Edit
            </button>
          )}
          {canRevert && (
            <button
              onClick={() => void handleRevertCancelled(row)}
              disabled={revertingRowId === row.rowId}
              className="text-[9px] font-semibold text-slate-300 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-all shrink-0 disabled:opacity-50"
            >
              {revertingRowId === row.rowId ? 'Reverting…' : 'Revert'}
            </button>
          )}
        </div>

        {isEditing && (
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">Status</label>
                <select
                  value={editDraft.status}
                  onChange={e => setEditDraft(d => ({ ...d, status: e.target.value }))}
                  className={inputCls}
                >
                  <option value="present">Present</option>
                  <option value="no-show">No-show</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">Topic</label>
                <input
                  value={editDraft.topic}
                  onChange={e => setEditDraft(d => ({ ...d, topic: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">Notes</label>
              <textarea
                value={editDraft.notes}
                onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))}
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setEditingRowId(null)}
                className="rounded border border-slate-200 px-3 py-1.5 text-[10px] font-semibold text-slate-500 hover:bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="rounded bg-slate-900 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center max-w-sm w-full">
          <AlertTriangle size={18} className="mx-auto mb-3 text-red-500" />
          <p className="text-sm font-semibold text-red-600">{error ?? 'Student not found'}</p>
          <Link href="/students" className="mt-4 inline-block text-xs font-semibold text-blue-500 hover:underline">
            ← Back to students
          </Link>
        </div>
      </div>
    )
  }

  // ── Page ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5" style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}>
      <div className="mx-auto max-w-3xl space-y-3">

        {/* Back */}
        <Link
          href="/students"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft size={11} /> Students
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 shrink-0 rounded bg-slate-900 flex items-center justify-center text-[11px] font-black text-white">
            {student.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-slate-900 leading-tight">{student.name}</h1>
            <p className="text-[11px] text-slate-400">
              {[student.grade ? `Grade ${student.grade}` : null, student.school_name].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        {/* Summary pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center border rounded px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
            {presentCount} attended
          </span>
          <span className="inline-flex items-center border rounded px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-600 border-red-200">
            {noShowCount} no-show
          </span>
          {unmarkedCount > 0 && (
            <span className="inline-flex items-center border rounded px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-600 border-amber-200">
              {unmarkedCount} unmarked
            </span>
          )}
          <span className="inline-flex items-center border rounded px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-600 border-blue-200">
            {upcoming.length} upcoming
          </span>
          {cancelledCount > 0 && (
            <span className="inline-flex items-center border rounded px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-500 border-slate-200">
              {cancelledCount} cancelled
            </span>
          )}
          {attendancePct !== null && (
            <span className="inline-flex items-center border rounded px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-500 border-slate-200">
              {attendancePct}% attendance
            </span>
          )}
        </div>

        {/* Weekly Schedule */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setWeeklyScheduleOpen(v => !v)}
            className="w-full px-4 py-2.5 border-b border-slate-100 flex items-center justify-between text-left bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-700">Weekly Schedule</p>
              <span className="inline-flex items-center border rounded px-1.5 py-0.5 text-[9px] font-semibold bg-violet-100 text-violet-700 border-violet-200">
                {weeklySlotCount} slot{weeklySlotCount === 1 ? '' : 's'}
              </span>
              <span className="inline-flex items-center border rounded px-1.5 py-0.5 text-[9px] font-semibold bg-white text-slate-600 border-slate-300">
                {weeklyScheduleOpen ? 'Collapse' : 'Expand'}
              </span>
            </div>
            <span className="h-5 w-5 rounded-full border border-slate-300 bg-white flex items-center justify-center shrink-0">
              {weeklyScheduleOpen
                ? <ChevronUp size={12} className="text-slate-700" />
                : <ChevronDown size={12} className="text-slate-700" />}
            </span>
          </button>
          {weeklyScheduleOpen && (
            <div className="grid grid-cols-6 gap-1.5 p-3">
              {weeklySchedule.map(day => (
                <div
                  key={day.dow}
                  className={`rounded-lg p-2 min-h-[60px] ${day.slots.length > 0 ? 'bg-violet-50 border border-violet-200' : 'bg-slate-50 border border-slate-100 opacity-50'}`}
                >
                  <p className={`text-[9px] font-bold uppercase tracking-wide mb-1.5 ${day.slots.length > 0 ? 'text-violet-600' : 'text-slate-400'}`}>
                    {day.abbr}
                  </p>
                  {day.slots.map((slot, i) => (
                    <div key={i} className="bg-violet-100 rounded px-1.5 py-1 mb-1">
                      <p className="text-[9px] font-semibold text-violet-700 leading-tight truncate">{slot.blockLabel}</p>
                      <p className="text-[9px] text-violet-700 leading-tight truncate mt-0.5">{slot.topic}</p>
                      <p className="text-[8px] text-violet-600 leading-tight truncate">{slot.tutorName}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Session Timeline */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Header + tabs */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sessions</p>
            <div className="flex items-center gap-1 bg-slate-100 rounded-md p-0.5">
              {([
                ['all',      `All (${history.length})`],
                ['upcoming', `Upcoming (${upcoming.length})`],
                ['past',     `Past (${past.length})`],
              ] as const).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all ${
                    tab === t
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="max-h-[65vh] overflow-y-auto divide-y divide-slate-50">
            {groupedTimeline.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-300">No sessions.</p>
            )}

            {groupedTimeline.map(item => {
              if (item.kind === 'single') {
                return <SingleRow key={item.key} row={item.row} />
              }

              // Series row
              const isExpanded = expandedSeries.has(item.key)
              const seriesRows = (tab === 'upcoming' ? upcoming : tab === 'past' ? past : history)
                .filter(r => r.seriesId === item.seriesId)
                .sort((a, b) => b.date.localeCompare(a.date))

              return (
                <div key={item.key} className="border-l-2 border-violet-200">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left cursor-pointer border-y border-violet-200 bg-violet-50/70 hover:bg-violet-100/70"
                    onClick={() =>
                      setExpandedSeries(prev => {
                        const next = new Set(prev)
                        isExpanded ? next.delete(item.key) : next.add(item.key)
                        return next
                      })
                    }
                  >
                    <div className="w-9 shrink-0 text-center">
                      <p className="text-[9px] font-bold uppercase leading-none text-violet-700">
                        {new Date(item.focusDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                      </p>
                      <p className="text-[10px] font-black leading-tight text-violet-800 mt-0.5">
                        {item.blockLabel}
                      </p>
                      <p className="text-[9px] font-semibold uppercase leading-none text-violet-600 mt-0.5">
                        {item.time}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5 truncate">
                        <Repeat2 size={11} className="text-violet-500 shrink-0" />
                        {item.topic}
                        <span className="border rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none bg-violet-50 text-violet-600 border-violet-200 shrink-0">
                          {item.count}
                        </span>
                        <span className="border rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide bg-white text-violet-700 border-violet-300 shrink-0">
                          {isExpanded ? 'Collapse' : 'Expand'}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-700 mt-0.5 truncate">
                        {item.tutorName} · {item.blockLabel} · {item.firstDate} – {item.lastDate}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-0.5 flex gap-3">
                        {tab === 'upcoming' ? (
                          <span className="text-blue-700">{item.count} pending</span>
                        ) : (
                          <>
                            <span className="text-emerald-700">{item.present} present</span>
                            <span className="text-red-600">{item.noShow} no-show</span>
                            {item.unmarked > 0 && <span className="text-amber-700">{item.unmarked} unmarked</span>}
                          </>
                        )}
                      </p>
                    </div>
                    <span className="h-5 w-5 rounded-full border border-violet-300 bg-white flex items-center justify-center shrink-0">
                      {isExpanded
                        ? <ChevronUp size={12} className="text-violet-700" />
                        : <ChevronDown size={12} className="text-violet-700" />}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="bg-violet-50/30">
                      {seriesRows.map(row => (
                        <SingleRow key={row.rowId} row={row} indented />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}