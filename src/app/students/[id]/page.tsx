"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, AlertTriangle, CalendarDays, Repeat2, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { DB, withCenter } from '@/lib/db'
import { dayOfWeek, getCentralTimeNow, toISODate, correctSessionRecord } from '@/lib/useScheduleData'
import { getSessionsForDay } from '@/components/constants'

const STUDENTS = DB.students
const SESSIONS = DB.sessions
const SS = DB.sessionStudents
const TUTORS = DB.tutors

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
  | {
      kind: 'single'
      key: string
      row: HistoryRow
      sortDate: string
    }
  | {
      kind: 'series'
      key: string
      seriesId: string
      topic: string
      tutorName: string
      blockLabel: string
      time: string
      firstDate: string
      lastDate: string
      focusDate: string
      count: number
      present: number
      noShow: number
      cancelled: number
      off: number
      unmarked: number
      notesCount: number
      sortDate: string
    }

// ── Status pill config ─────────────────────────────────────────────────────
function statusBadge(row: HistoryRow, today: string) {
  if (row.status === 'present' || row.status === 'confirmed') return { text: 'Present',   bg: '#dcfce7', color: '#15803d' }
  if (row.status === 'no-show')  return { text: 'No-show',   bg: '#fee2e2', color: '#b91c1c' }
  if (row.status === 'cancelled') return { text: 'Cancelled', bg: '#f3f4f6', color: '#9ca3af' }
  if (row.status === 'off')       return { text: 'Off',       bg: '#fff7ed', color: '#c2410c' }
  if (row.date < today)           return { text: 'Unmarked',  bg: '#f1f5f9', color: '#475569' }
  return                                 { text: 'Upcoming',  bg: '#dbeafe', color: '#1d4ed8' }
}

export default function StudentHistoryPage() {
  const params = useParams<{ id: string }>()
  const studentId = String(params?.id ?? '')

  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [student, setStudent]   = useState<any | null>(null)
  const [history, setHistory]   = useState<HistoryRow[]>([])
  const [timelineTab, setTimelineTab] = useState<'all' | 'upcoming' | 'past'>('all')
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editDraft, setEditDraft]       = useState({ status: '', topic: '', notes: '' })
  const [editSaving, setEditSaving]     = useState(false)
  const [expandedSeriesKeys, setExpandedSeriesKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!studentId) return
      setLoading(true)
      setError(null)
      try {
        const [
          { data: studentRow, error: studentErr },
          { data: rows, error: rowsErr },
          { data: tutorRows, error: tutorErr },
          { data: exRows },
        ] = await Promise.all([
          withCenter(supabase.from(STUDENTS).select('*').eq('id', studentId)).single(),
          (withCenter(supabase
            .from(SS)
            .select(`id, topic, status, notes, series_id, session_id, ${SESSIONS} ( id, session_date, time, tutor_id )`)
            .eq('student_id', studentId)) as any),
          withCenter(supabase.from(TUTORS).select('id, name')),
          (withCenter(supabase.from(DB.studentDateExceptions).select('id, series_id, exception_date, reason').eq('student_id', studentId)) as any),
        ])

        if (studentErr) throw studentErr
        if (rowsErr) throw rowsErr
        if (tutorErr) throw tutorErr

        const tutorMap = new Map<string, string>((tutorRows ?? []).map((t: any) => [String(t.id), t.name]))

        const mapped = (rows ?? [])
          .map((r: any) => {
            const session = Array.isArray(r[SESSIONS]) ? r[SESSIONS][0] : r[SESSIONS]
            if (!session?.session_date) return null
            const blockLabel = getSessionsForDay(dayOfWeek(session.session_date)).find((b: any) => b.time === session.time)?.label ?? session.time
            return {
              rowId: r.id,
              date: session.session_date,
              time: session.time,
              blockLabel,
              tutorId: session.tutor_id,
              tutorName: tutorMap.get(String(session.tutor_id)) ?? 'Unknown',
              topic: r.topic ?? 'Session',
              status: r.status ?? 'scheduled',
              notes: r.notes ?? null,
              seriesId: r.series_id ?? null,
            }
          })
          .filter(Boolean)
          .sort((a: any, b: any) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))

        const exceptionRows: HistoryRow[] = (exRows ?? []).map((e: any) => ({
          rowId: `exc:${e.id}`,
          date: e.exception_date,
          time: '',
          blockLabel: '',
          tutorId: '',
          tutorName: '',
          topic: 'Planned Absence',
          status: 'off',
          notes: e.reason ?? null,
          seriesId: e.series_id ?? null,
        }))

        if (!cancelled) {
          setStudent(studentRow)
          setHistory(
            [...(mapped as HistoryRow[]), ...exceptionRows]
              .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
          )
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Failed to load student history')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [studentId])

  const today = toISODate(getCentralTimeNow())

  const past     = useMemo(() => history.filter(s => s.date < today), [history, today])
  const upcoming = useMemo(() => history.filter(s => s.date >= today && s.status !== 'cancelled'), [history, today])
  const pastActive   = useMemo(() => past.filter(s => s.status !== 'cancelled' && s.status !== 'off'), [past])
  const presentCount = useMemo(() => pastActive.filter(s => s.status === 'present' || s.status === 'confirmed').length, [pastActive])
  const noShowCount  = useMemo(() => pastActive.filter(s => s.status === 'no-show').length, [pastActive])
  const cancelledCount = useMemo(() => history.filter(s => s.status === 'cancelled').length, [history])
  const offCount       = useMemo(() => history.filter(s => s.status === 'off').length, [history])
  const attendanceRate = pastActive.length > 0 ? presentCount / pastActive.length : null
  const noShowRate     = pastActive.length > 0 ? noShowCount / pastActive.length : null

  // ── Weekly schedule ────────────────────────────────────────────────────────
  const weeklySchedule = useMemo(() => {
    const DAYS = [
      { abbr: 'Mon', dow: 1 },
      { abbr: 'Tue', dow: 2 },
      { abbr: 'Wed', dow: 3 },
      { abbr: 'Thu', dow: 4 },
      { abbr: 'Fri', dow: 5 },
      { abbr: 'Sat', dow: 6 },
    ]
    const seriesSlots = new Map<string, { dow: number; tutorName: string; blockLabel: string; time: string; topic: string; isUpcoming: boolean }>()
    for (const row of [...upcoming, ...history]) {
      if (row.seriesId && !seriesSlots.has(row.seriesId)) {
        seriesSlots.set(row.seriesId, {
          dow: new Date(row.date + 'T00:00:00').getDay(),
          tutorName: row.tutorName,
          blockLabel: row.blockLabel,
          time: row.time,
          topic: row.topic,
          isUpcoming: row.date >= today,
        })
      }
    }
    const byDow: Record<number, Array<{ seriesId: string; tutorName: string; blockLabel: string; time: string; topic: string; isUpcoming: boolean }>> = {}
    for (const [seriesId, slot] of seriesSlots) {
      if (!byDow[slot.dow]) byDow[slot.dow] = []
      byDow[slot.dow].push({ seriesId, ...slot })
    }
    return DAYS.map(day => ({ ...day, slots: byDow[day.dow] ?? [] }))
  }, [upcoming, history, today])

  // ── Grouped timeline ───────────────────────────────────────────────────────
  const groupedTimeline = useMemo(() => {
    const source = timelineTab === 'upcoming' ? upcoming : timelineTab === 'past' ? past : history

    const singles: TimelineItem[] = []
    const recurringBuckets = new Map<string, HistoryRow[]>()

    for (const row of source) {
      if (row.seriesId) {
        const key = String(row.seriesId)
        const existing = recurringBuckets.get(key) ?? []
        existing.push(row)
        recurringBuckets.set(key, existing)
      } else {
        singles.push({ kind: 'single', key: `single-${row.rowId}`, row, sortDate: `${row.date}T${row.time}` })
      }
    }

    const seriesItems: TimelineItem[] = Array.from(recurringBuckets.entries()).map(([seriesId, rows]) => {
      const ordered = [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      const first = ordered[0]
      const last  = ordered[ordered.length - 1]
      const focus = timelineTab === 'upcoming' ? first : last
      const present   = rows.filter(r => r.status === 'present' || r.status === 'confirmed').length
      const noShow    = rows.filter(r => r.status === 'no-show').length
      const cancelled = rows.filter(r => r.status === 'cancelled').length
      const off       = rows.filter(r => r.status === 'off').length
      const unmarked  = rows.length - present - noShow - cancelled - off
      return {
        kind: 'series',
        key: `series-${seriesId}-${timelineTab}`,
        seriesId,
        topic: focus.topic,
        tutorName: focus.tutorName,
        blockLabel: focus.blockLabel,
        time: focus.time,
        firstDate: first.date,
        lastDate: last.date,
        focusDate: focus.date,
        count: rows.length,
        present, noShow, cancelled, off, unmarked,
        notesCount: rows.filter(r => !!r.notes).length,
        sortDate: `${focus.date}T${focus.time}`,
      } as TimelineItem
    })

    const merged = [...singles, ...seriesItems]
    return merged.sort((a, b) => {
      const cmp = a.sortDate.localeCompare(b.sortDate)
      return timelineTab === 'upcoming' ? cmp : -cmp
    })
  }, [timelineTab, past, upcoming, history])

  const handleSaveEdit = async () => {
    if (!editingRowId || !student) return
    setEditSaving(true)
    try {
      await correctSessionRecord({
        rowId:     editingRowId,
        studentId: student.id,
        status:    editDraft.status,
        topic:     editDraft.topic,
        notes:     editDraft.notes || null,
      })
      setHistory(prev => prev.map(r =>
        r.rowId === editingRowId
          ? { ...r, status: editDraft.status, topic: editDraft.topic, notes: editDraft.notes || null }
          : r
      ))
      setEditingRowId(null)
    } catch (err: any) {
      alert(err?.message ?? 'Failed to save')
    } finally {
      setEditSaving(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f7fa' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#e2e8f0] border-t-[#3b82f6] rounded-full animate-spin" />
          <p className="text-[11px] font-bold tracking-widest uppercase text-[#94a3b8]">Loading</p>
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f7fa' }}>
        <div className="bg-white rounded-2xl border border-[#fca5a5] p-8 text-center shadow-sm max-w-sm w-full">
          <AlertTriangle size={22} className="mx-auto mb-3 text-[#dc2626]" />
          <p className="font-black text-[#dc2626]">{error ?? 'Student not found'}</p>
          <Link href="/students" className="mt-4 inline-block text-xs font-bold text-[#3b82f6] hover:underline">
            ← Back to students
          </Link>
        </div>
      </div>
    )
  }

  // ── Page ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#f1f5f9' }}>
      <div className="max-w-5xl mx-auto px-4 py-5 space-y-4">

        {/* Nav */}
        <Link
          href="/students"
          className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#94a3b8] hover:text-[#0f172a] transition-colors"
        >
          <ArrowLeft size={11} /> Students
        </Link>

        {/* ── Header card ── */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] px-6 py-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black text-[#0f172a] tracking-tight">{student.name}</h1>
              <p className="text-[12px] text-[#64748b] font-semibold mt-1">
                {upcoming.length > 0
                  ? `${upcoming.length} upcoming session${upcoming.length !== 1 ? 's' : ''}`
                  : 'No upcoming sessions'}
                {pastActive.length > 0 && attendanceRate !== null &&
                  ` · ${Math.round(attendanceRate * 100)}% attendance (${presentCount}/${pastActive.length})`}
                {cancelledCount > 0 && ` · ${cancelledCount} cancelled`}
              </p>
            </div>
            {past.length >= 3 && noShowRate !== null && noShowRate > 0.4 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest"
                style={{ background: '#fef2f2', color: '#b91c1c', border: '1.5px solid #fca5a5' }}>
                <AlertTriangle size={10} /> At Risk
              </span>
            )}
          </div>

          {/* Stat pills */}
          {pastActive.length > 0 && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {[
                { label: 'Present',   val: presentCount,                    bg: '#dcfce7', color: '#15803d' },
                { label: 'No-show',   val: noShowCount,                     bg: '#fee2e2', color: '#b91c1c' },
                { label: 'Upcoming',  val: upcoming.length,                 bg: '#dbeafe', color: '#1d4ed8' },
                { label: 'Cancelled', val: cancelledCount,                  bg: '#f3f4f6', color: '#6b7280' },
                ...(offCount > 0 ? [{ label: 'Off', val: offCount,          bg: '#fff7ed', color: '#c2410c' }] : []),
              ].map(p => (
                <span key={p.label}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                  style={{ background: p.bg, color: p.color }}>
                  <span className="text-base font-black leading-none">{p.val}</span> {p.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Weekly Schedule ── */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[#f1f5f9] flex items-center gap-2">
            <CalendarDays size={13} className="text-[#94a3b8]" />
            <p className="text-[10px] font-black uppercase tracking-widest text-[#0f172a]">Weekly Schedule</p>
            {weeklySchedule.every(d => d.slots.length === 0) && (
              <span className="text-[10px] text-[#94a3b8] ml-1">— no recurring sessions</span>
            )}
          </div>
          <div className="p-4 grid grid-cols-3 md:grid-cols-6 gap-2">
            {weeklySchedule.map(day => {
              const active     = day.slots.length > 0
              const hasUpcoming = day.slots.some(s => s.isUpcoming)
              return (
                <div key={day.dow}
                  className="rounded-xl p-2.5 min-h-[72px] flex flex-col gap-1.5"
                  style={{
                    background: active
                      ? hasUpcoming ? '#f5f3ff' : '#f8fafc'
                      : '#f8fafc',
                    border: `1.5px solid ${active ? (hasUpcoming ? '#c4b5fd' : '#e2e8f0') : '#e2e8f0'}`,
                    opacity: active ? 1 : 0.45,
                  }}>
                  <p className="text-[9px] font-black uppercase tracking-widest"
                    style={{ color: active ? (hasUpcoming ? '#6d28d9' : '#64748b') : '#cbd5e1' }}>
                    {day.abbr}
                  </p>
                  {active ? day.slots.map(s => (
                    <div key={s.seriesId}
                      className="rounded-md px-1.5 py-1 flex flex-col gap-0.5"
                      style={{ background: s.isUpcoming ? '#ede9fe' : '#f1f5f9' }}>
                      <span className="text-[8px] font-black flex items-center gap-0.5 leading-none"
                        style={{ color: s.isUpcoming ? '#4c1d95' : '#94a3b8' }}>
                        <Repeat2 size={7} /> {s.blockLabel || s.time}
                      </span>
                      <span className="text-[9px] font-semibold truncate leading-tight"
                        style={{ color: s.isUpcoming ? '#5b21b6' : '#374151' }}>
                        {s.topic}
                      </span>
                      <span className="text-[8px] truncate"
                        style={{ color: s.isUpcoming ? '#7c3aed' : '#9ca3af' }}>
                        {s.tutorName}
                      </span>
                    </div>
                  )) : (
                    <p className="text-[9px] text-[#cbd5e1] mt-auto">—</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Session Timeline ── */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm overflow-hidden">

          {/* Timeline header + tabs */}
          <div className="px-5 py-3 border-b border-[#f1f5f9] flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#0f172a]">Session Timeline</p>
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: '#f1f5f9' }}>
              {([
                ['all',      `All (${history.length})`],
                ['upcoming', `↑ Upcoming (${upcoming.length})`],
                ['past',     `✓ Past (${past.length})`],
              ] as const).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setTimelineTab(t)}
                  className="px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wide transition-all"
                  style={timelineTab === t
                    ? { background: t === 'upcoming' ? '#3b82f6' : t === 'past' ? '#10b981' : '#0f172a', color: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }
                    : { color: '#94a3b8' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[#f1f5f9] max-h-[70vh] overflow-y-auto">
            {groupedTimeline.length === 0 && (
              <p className="px-5 py-10 text-sm text-center text-[#94a3b8]">
                No {timelineTab === 'all' ? '' : timelineTab + ' '}sessions.
              </p>
            )}

            {groupedTimeline.map(item => {
              /* ── Single row ── */
              if (item.kind === 'single') {
                const row   = item.row
                const badge = statusBadge(row, today)
                const d     = new Date(row.date + 'T00:00:00')
                const isEditing = editingRowId === row.rowId

                return (
                  <div key={item.key}
                    className="group"
                    style={{ borderLeft: `3px solid ${badge.color}30` }}>
                    {isEditing ? (
                      <div className="px-5 py-4 space-y-3" style={{ background: '#f8fafc' }}>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
                            Editing · {row.date}
                          </p>
                          <button onClick={() => setEditingRowId(null)}
                            className="text-[10px] font-bold text-[#94a3b8] hover:text-[#ef4444]">
                            ✕ Cancel
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">Status</label>
                            <select value={editDraft.status}
                              onChange={e => setEditDraft(d => ({ ...d, status: e.target.value }))}
                              className="w-full rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0f172a]">
                              <option value="present">✓ Present</option>
                              <option value="no-show">✕ No-show</option>
                              <option value="scheduled">→ Scheduled</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">Topic</label>
                            <input value={editDraft.topic}
                              onChange={e => setEditDraft(d => ({ ...d, topic: e.target.value }))}
                              className="w-full rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-xs text-[#0f172a]" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">Notes</label>
                          <textarea value={editDraft.notes}
                            onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))}
                            rows={2}
                            className="w-full rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-xs text-[#0f172a] resize-none" />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingRowId(null)}
                            className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-[10px] font-bold text-[#64748b] hover:bg-white">
                            Cancel
                          </button>
                          <button onClick={handleSaveEdit} disabled={editSaving}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-black text-white disabled:opacity-50"
                            style={{ background: '#3b82f6' }}>
                            {editSaving ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 px-5 py-3 hover:bg-[#f8fafc] transition-colors">
                        {/* Date */}
                        <div className="w-9 shrink-0 text-center">
                          <p className="text-[8px] font-black uppercase text-[#94a3b8] leading-none tracking-wide">
                            {d.toLocaleDateString('en-US', { month: 'short' })}
                          </p>
                          <p className="text-[17px] font-black leading-tight"
                            style={{ color: row.status === 'cancelled' ? '#d1d5db' : '#0f172a' }}>
                            {d.getDate()}
                          </p>
                          <p className="text-[8px] font-bold uppercase text-[#cbd5e1] leading-none">
                            {d.toLocaleDateString('en-US', { weekday: 'short' })}
                          </p>
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold truncate"
                            style={{
                              color: row.status === 'cancelled' ? '#9ca3af' : '#0f172a',
                              textDecoration: row.status === 'cancelled' ? 'line-through' : 'none',
                            }}>
                            {row.topic}
                          </p>
                          <p className="text-[11px] text-[#64748b] mt-0.5 truncate">
                            {[row.tutorName, row.blockLabel].filter(Boolean).join(' · ')}
                          </p>
                          {row.notes && (
                            <p className="text-[10px] text-[#94a3b8] italic mt-0.5 truncate">"{row.notes}"</p>
                          )}
                        </div>
                        {/* Badge + edit */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide"
                            style={{ background: badge.bg, color: badge.color }}>
                            {badge.text}
                          </span>
                          {row.status !== 'cancelled' && row.status !== 'off' && (
                            <button
                              onClick={() => { setEditingRowId(row.rowId); setEditDraft({ status: row.status, topic: row.topic, notes: row.notes ?? '' }) }}
                              className="text-[9px] font-bold text-[#cbd5e1] hover:text-[#3b82f6] opacity-0 group-hover:opacity-100 transition-all">
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              }

              /* ── Series row ── */
              const focus = new Date(item.focusDate + 'T00:00:00')
              const isExpanded = expandedSeriesKeys.has(item.key)
              const seriesRows = (timelineTab === 'upcoming' ? upcoming : timelineTab === 'past' ? past : history)
                .filter(r => r.seriesId === item.seriesId)
                .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))

              return (
                <div key={item.key} style={{ borderLeft: '3px solid #c4b5fd' }}>
                  {/* Series header button */}
                  <button
                    className="w-full flex items-center gap-4 px-5 py-3 hover:bg-[#faf9ff] transition-colors text-left"
                    onClick={() => setExpandedSeriesKeys(prev => {
                      const next = new Set(prev)
                      isExpanded ? next.delete(item.key) : next.add(item.key)
                      return next
                    })}>
                    {/* Date */}
                    <div className="w-9 shrink-0 text-center">
                      <p className="text-[8px] font-black uppercase text-[#a78bfa] leading-none tracking-wide">
                        {focus.toLocaleDateString('en-US', { month: 'short' })}
                      </p>
                      <p className="text-[17px] font-black text-[#6d28d9] leading-tight">{focus.getDate()}</p>
                      <p className="text-[8px] font-bold uppercase text-[#c4b5fd] leading-none">
                        {focus.toLocaleDateString('en-US', { weekday: 'short' })}
                      </p>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[#0f172a] truncate flex items-center gap-1.5">
                        <Repeat2 size={12} className="text-[#7c3aed] shrink-0" />
                        {item.topic}
                      </p>
                      <p className="text-[11px] text-[#64748b] mt-0.5 truncate">
                        {item.tutorName} · {item.blockLabel}
                      </p>
                      <p className="text-[10px] text-[#94a3b8] mt-0.5">
                        {item.count} sessions · {item.firstDate} – {item.lastDate}
                      </p>
                    </div>
                    {/* Right side */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide"
                        style={{ background: '#f5f3ff', color: '#6d28d9' }}>
                        Recurring
                      </span>
                      {timelineTab === 'upcoming' ? (
                        <span className="text-[9px] font-semibold text-[#3b82f6]">{item.count} pending</span>
                      ) : (
                        <span className="text-[9px] text-[#64748b] font-semibold">
                          {item.present}p · {item.noShow}ns{item.unmarked > 0 ? ` · ${item.unmarked} left` : ''}
                        </span>
                      )}
                      {isExpanded
                        ? <ChevronUp size={12} className="text-[#a78bfa]" />
                        : <ChevronDown size={12} className="text-[#a78bfa]" />}
                    </div>
                  </button>

                  {/* Expanded sub-rows */}
                  {isExpanded && (
                    <div className="divide-y divide-[#f5f3ff]" style={{ background: '#faf9ff' }}>
                      {seriesRows.map(row => {
                        const badge = statusBadge(row, today)
                        const d = new Date(row.date + 'T00:00:00')
                        const isEditing = editingRowId === row.rowId
                        const isReadOnly = row.status === 'cancelled' || row.status === 'off'

                        return (
                          <div key={row.rowId}
                            className="group"
                            style={{ borderLeft: `2px solid ${badge.color}25`, opacity: isReadOnly ? 0.7 : 1 }}>
                            {isEditing ? (
                              <div className="pl-14 pr-5 py-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
                                    Editing · {row.date}
                                  </p>
                                  <button onClick={() => setEditingRowId(null)}
                                    className="text-[10px] font-bold text-[#94a3b8] hover:text-[#ef4444]">
                                    ✕ Cancel
                                  </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">Status</label>
                                    <select value={editDraft.status}
                                      onChange={e => setEditDraft(d => ({ ...d, status: e.target.value }))}
                                      className="w-full rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0f172a]">
                                      <option value="present">✓ Present</option>
                                      <option value="no-show">✕ No-show</option>
                                      <option value="scheduled">→ Scheduled</option>
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">Topic</label>
                                    <input value={editDraft.topic}
                                      onChange={e => setEditDraft(d => ({ ...d, topic: e.target.value }))}
                                      className="w-full rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-xs text-[#0f172a]" />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">Notes</label>
                                  <textarea value={editDraft.notes}
                                    onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))}
                                    rows={2}
                                    className="w-full rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-xs text-[#0f172a] resize-none" />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => setEditingRowId(null)}
                                    className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-[10px] font-bold text-[#64748b] hover:bg-white">
                                    Cancel
                                  </button>
                                  <button onClick={handleSaveEdit} disabled={editSaving}
                                    className="px-3 py-1.5 rounded-lg text-[10px] font-black text-white disabled:opacity-50"
                                    style={{ background: '#3b82f6' }}>
                                    {editSaving ? 'Saving…' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-4 pl-14 pr-5 py-3 hover:bg-[#f5f3ff30] transition-colors">
                                <div className="w-9 shrink-0 text-center">
                                  <p className="text-[8px] font-black uppercase text-[#94a3b8] leading-none tracking-wide">
                                    {d.toLocaleDateString('en-US', { month: 'short' })}
                                  </p>
                                  <p className="text-[17px] font-black leading-tight"
                                    style={{ color: row.status === 'cancelled' ? '#d1d5db' : '#0f172a' }}>
                                    {d.getDate()}
                                  </p>
                                  <p className="text-[8px] font-bold uppercase text-[#cbd5e1] leading-none">
                                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                                  </p>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-bold truncate"
                                    style={{
                                      color: row.status === 'cancelled' ? '#9ca3af' : '#0f172a',
                                      textDecoration: row.status === 'cancelled' ? 'line-through' : 'none',
                                    }}>
                                    {row.topic}
                                  </p>
                                  <p className="text-[11px] text-[#64748b] mt-0.5 truncate">
                                    {[row.tutorName, row.blockLabel].filter(Boolean).join(' · ')}
                                  </p>
                                  {row.notes && (
                                    <p className="text-[10px] text-[#94a3b8] italic mt-0.5 truncate">"{row.notes}"</p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <span className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide"
                                    style={{ background: badge.bg, color: badge.color }}>
                                    {badge.text}
                                  </span>
                                  {!isReadOnly && (
                                    <button
                                      onClick={() => { setEditingRowId(row.rowId); setEditDraft({ status: row.status, topic: row.topic, notes: row.notes ?? '' }) }}
                                      className="text-[9px] font-bold text-[#cbd5e1] hover:text-[#3b82f6] opacity-0 group-hover:opacity-100 transition-all">
                                      Edit
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
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