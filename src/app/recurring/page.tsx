'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  fetchAllSeries,
  fetchSeriesSessions,
  cancelSeries,
  rescheduleSeries,
  markCompletedSeries,
  type RecurringSeries,
  type Tutor,
  type Student,
  toISODate,
} from '@/lib/useScheduleData';
import { getSessionsForDay } from '@/components/constants';
import {
  Repeat, ChevronDown, ChevronUp, X, AlertTriangle,
  Check, Clock, RefreshCw, Calendar, User, BookOpen, Edit3
} from 'lucide-react';

const DAY_NAMES: Record<number, string> = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday' };
const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  active:    { bg: '#fff5f5', text: '#dc2626', dot: '#dc2626' },
  completed: { bg: '#f0fdf4', text: '#16a34a', dot: '#16a34a' },
  cancelled: { bg: '#f9fafb', text: '#6b7280', dot: '#9ca3af' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.cancelled;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
      style={{ background: s.bg, color: s.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {status}
    </span>
  );
}

type SessionRow = {
  id: string;
  status: string;
  notes: string | null;
  slake_sessions: { id: string; session_date: string; time: string; tutor_id: string } | null;
};

export default function RecurringManager() {
  const [series, setSeries] = useState<RecurringSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  // Expanded series row
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<SessionRow[]>([]);
  const [loadingExpanded, setLoadingExpanded] = useState(false);

  // Cancel confirm
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Reschedule modal
  const [reschedulingSeries, setReschedulingSeries] = useState<RecurringSeries | null>(null);
  const [newTutorId, setNewTutorId] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Status filter
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await markCompletedSeries();
      const [seriesData, tutorRes, studentRes] = await Promise.all([
        fetchAllSeries(),
        supabase.from('slake_tutors').select('*').order('name'),
        supabase.from('slake_students').select('*').order('name'),
      ]);
      setSeries(seriesData);
      setTutors((tutorRes.data ?? []).map((r: any) => ({
        id: r.id, name: r.name, subjects: r.subjects ?? [], cat: r.cat,
        availability: r.availability ?? [], availabilityBlocks: r.availability_blocks ?? [],
      })));
      setStudents((studentRes.data ?? []).map((r: any) => ({
        id: r.id, name: r.name, subject: r.subject, grade: r.grade ?? null,
        hoursLeft: r.hours_left, availabilityBlocks: r.availability_blocks ?? [],
        email: r.email ?? null, phone: r.phone ?? null,
        parent_name: r.parent_name ?? null, parent_email: r.parent_email ?? null,
        parent_phone: r.parent_phone ?? null, bluebook_url: r.bluebook_url ?? null,
      })));
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Replace your existing toggleExpand function with this:
const toggleExpand = async (id: string) => {
  if (expandedId === id) {
    setExpandedId(null);
    return;
  }
  setExpandedId(id);
  setLoadingExpanded(true);
  try {
    const data = await fetchSeriesSessions(id);

    // Map the data to flatten the slake_sessions array into a single object
    const mappedRows: SessionRow[] = (data as any[]).map((row) => ({
      id: row.id,
      status: row.status,
      notes: row.notes,
      // If slake_sessions is an array, take the first element. 
      // If it's already an object or null, use it as is.
      slake_sessions: Array.isArray(row.slake_sessions)
        ? row.slake_sessions[0] || null
        : row.slake_sessions || null,
    }));

    setExpandedSessions(mappedRows);
  } catch (e) {
    console.error("Error fetching sessions:", e);
  }
  setLoadingExpanded(false);
};

  const handleCancel = async (id: string) => {
    setCancelling(true);
    try {
      await cancelSeries(id);
      await load();
      setCancellingId(null);
      if (expandedId === id) setExpandedId(null);
    } catch (e: any) {
      alert(e.message);
    }
    setCancelling(false);
  };

  const openReschedule = (s: RecurringSeries) => {
    setReschedulingSeries(s);
    setNewTutorId(s.tutorId);
    setNewTime(s.time);
    setNewTopic(s.topic);
    setRescheduleError(null);
  };

  const handleReschedule = async () => {
    if (!reschedulingSeries) return;
    setRescheduling(true);
    setRescheduleError(null);
    const student = students.find(s => s.id === reschedulingSeries.studentId);
    if (!student) { setRescheduleError('Student not found'); setRescheduling(false); return; }
    try {
      await rescheduleSeries({
        seriesId: reschedulingSeries.id,
        newTutorId,
        newTime,
        student,
        topic: newTopic,
      });
      setReschedulingSeries(null);
      await load();
    } catch (e: any) {
      setRescheduleError(e.message);
    }
    setRescheduling(false);
  };

  const filtered = statusFilter === 'all' ? series : series.filter(s => s.status === statusFilter);

  const counts = {
    all: series.length,
    active: series.filter(s => s.status === 'active').length,
    completed: series.filter(s => s.status === 'completed').length,
    cancelled: series.filter(s => s.status === 'cancelled').length,
  };

  // For reschedule: get available time slots for the selected tutor on the series day
  const availableBlocks = reschedulingSeries
    ? getSessionsForDay(reschedulingSeries.dayOfWeek)
    : [];

  const today = toISODate(new Date());

  return (
    <div className="min-h-screen" style={{ background: '#fafafa', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: '#111827' }}>Recurring Sessions</h1>
            <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Manage all recurring student schedules</p>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all"
            style={{ background: 'white', border: '1px solid #fca5a5', color: '#dc2626' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#f3f4f6' }}>
          {(['all', 'active', 'completed', 'cancelled'] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all"
              style={statusFilter === f
                ? { background: f === 'active' ? '#dc2626' : f === 'completed' ? '#16a34a' : f === 'cancelled' ? '#6b7280' : '#111827', color: 'white' }
                : { color: '#9ca3af' }}>
              {f} <span className="ml-1 opacity-70">({counts[f]})</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
            style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3" style={{ color: '#9ca3af' }}>
            <RefreshCw size={18} className="animate-spin" />
            <span className="text-sm">Loading series…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Repeat size={32} className="mx-auto mb-3" style={{ color: '#fca5a5' }} />
            <p className="text-sm font-semibold" style={{ color: '#9ca3af' }}>No {statusFilter !== 'all' ? statusFilter : ''} recurring series found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(s => {
              const isExpanded = expandedId === s.id;
              const isCancelling = cancellingId === s.id;
              const isPast = s.endDate < today;

              return (
                <div key={s.id} className="rounded-2xl overflow-hidden transition-all"
                  style={{ background: 'white', border: `1px solid ${s.status === 'active' ? '#fca5a5' : '#e5e7eb'}`, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>

                  {/* Series row */}
                  <div className="flex items-center gap-4 px-5 py-4">
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: s.status === 'active' ? '#fff5f5' : '#f9fafb', border: `1.5px solid ${s.status === 'active' ? '#fca5a5' : '#e5e7eb'}` }}>
                      <Repeat size={16} style={{ color: s.status === 'active' ? '#dc2626' : '#9ca3af' }} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black" style={{ color: '#111827' }}>{s.studentName}</p>
                        <StatusBadge status={s.status} />
                        {s.status === 'active' && isPast && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: '#fef3c7', color: '#92400e' }}>ENDING</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-[11px]" style={{ color: '#6b7280' }}>
                          <User size={10} /> {s.tutorName}
                        </span>
                        <span className="flex items-center gap-1 text-[11px]" style={{ color: '#6b7280' }}>
                          <Calendar size={10} /> {DAY_NAMES[s.dayOfWeek]} · {s.time}
                        </span>
                        <span className="flex items-center gap-1 text-[11px]" style={{ color: '#6b7280' }}>
                          <BookOpen size={10} /> {s.topic}
                        </span>
                        <span className="text-[11px]" style={{ color: '#9ca3af' }}>
                          {s.startDate} → {s.endDate} ({s.totalWeeks}wk)
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {s.status === 'active' && (
                        <>
                          <button onClick={() => openReschedule(s)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                            style={{ background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626' }}>
                            <Edit3 size={11} /> Reschedule
                          </button>
                          <button onClick={() => setCancellingId(s.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                            style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#6b7280' }}>
                            <X size={11} /> Cancel
                          </button>
                        </>
                      )}
                      <button onClick={() => toggleExpand(s.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                        style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#6b7280' }}>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Cancel confirm inline */}
                  {isCancelling && (
                    <div className="mx-5 mb-4 px-4 py-3 rounded-xl flex items-center justify-between gap-4"
                      style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={14} style={{ color: '#dc2626' }} />
                        <p className="text-xs font-bold" style={{ color: '#dc2626' }}>
                          Cancel all future sessions for {s.studentName}?
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => setCancellingId(null)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
                          style={{ background: 'white', border: '1px solid #e5e7eb', color: '#6b7280' }}>
                          Keep
                        </button>
                        <button onClick={() => handleCancel(s.id)} disabled={cancelling}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white"
                          style={{ background: cancelling ? '#9ca3af' : '#dc2626' }}>
                          {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expanded sessions list */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #f3f4f6' }}>
                      {loadingExpanded ? (
                        <div className="flex items-center gap-2 px-5 py-4" style={{ color: '#9ca3af' }}>
                          <RefreshCw size={13} className="animate-spin" />
                          <span className="text-xs">Loading sessions…</span>
                        </div>
                      ) : expandedSessions.length === 0 ? (
                        <p className="px-5 py-4 text-xs italic" style={{ color: '#9ca3af' }}>No individual sessions found</p>
                      ) : (
                        <div className="px-5 py-3">
                          <p className="text-[9px] font-black uppercase tracking-widest mb-2.5" style={{ color: '#9ca3af' }}>
                            Individual Sessions ({expandedSessions.length})
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {expandedSessions
                              .sort((a, b) => (a.slake_sessions?.session_date ?? '').localeCompare(b.slake_sessions?.session_date ?? ''))
                              .map(row => {
                                const date = row.slake_sessions?.session_date ?? '';
                                const isPastSession = date < today;
                                const statusColor = row.status === 'present' ? '#16a34a'
                                  : row.status === 'no-show' ? '#dc2626'
                                  : isPastSession ? '#9ca3af' : '#dc2626';
                                const statusBg = row.status === 'present' ? '#f0fdf4'
                                  : row.status === 'no-show' ? '#fef2f2'
                                  : isPastSession ? '#f9fafb' : '#fff5f5';
                                return (
                                  <div key={row.id} className="px-3 py-2.5 rounded-xl"
                                    style={{ background: statusBg, border: `1px solid ${statusColor}22` }}>
                                    <p className="text-[11px] font-bold" style={{ color: '#111827' }}>{date}</p>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusColor }} />
                                      <span className="text-[10px] font-semibold capitalize" style={{ color: statusColor }}>{row.status}</span>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── RESCHEDULE MODAL ── */}
      {reschedulingSeries && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl"
            style={{ border: '1px solid #fca5a5' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ background: '#dc2626', borderBottom: '1px solid #b91c1c' }}>
              <div>
                <p className="text-sm font-black text-white">Reschedule Series</p>
                <p className="text-[11px] text-red-200 mt-0.5">{reschedulingSeries.studentName} · {DAY_NAMES[reschedulingSeries.dayOfWeek]}s</p>
              </div>
              <button onClick={() => setReschedulingSeries(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="px-3 py-2.5 rounded-xl text-xs"
                style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}>
                <strong>Note:</strong> Past sessions are untouched. Only future sessions will be rescheduled.
              </div>

              {/* Tutor select */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: '#6b7280' }}>
                  Tutor
                </label>
                <select value={newTutorId} onChange={e => setNewTutorId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border-2 outline-none"
                  style={{ border: '2px solid #fca5a5', color: '#111827' }}>
                  {tutors.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Time select */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: '#6b7280' }}>
                  Time Slot
                </label>
                <select value={newTime} onChange={e => setNewTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border-2 outline-none"
                  style={{ border: '2px solid #fca5a5', color: '#111827' }}>
                  {availableBlocks.map(b => (
                    <option key={b.time} value={b.time}>{b.label} ({b.display})</option>
                  ))}
                </select>
              </div>

              {/* Topic */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: '#6b7280' }}>
                  Topic
                </label>
                <input value={newTopic} onChange={e => setNewTopic(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border-2 outline-none"
                  style={{ border: '2px solid #fca5a5', color: '#111827' }}
                  placeholder="Session topic" />
              </div>

              {rescheduleError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
                  style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }}>
                  <AlertTriangle size={12} /> {rescheduleError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setReschedulingSeries(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#6b7280' }}>
                  Cancel
                </button>
                <button onClick={handleReschedule} disabled={rescheduling}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
                  style={{ background: rescheduling ? '#9ca3af' : '#dc2626' }}>
                  {rescheduling ? 'Rescheduling…' : 'Confirm Reschedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}