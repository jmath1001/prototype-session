"use client"
import { ChevronLeft, ChevronRight, CalendarDays, ChevronDown, Trash2, Check, NotebookPen, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { formatWeekRange } from './scheduleConstants';
import { toISODate } from '@/lib/useScheduleData';
import { supabase } from '@/lib/supabaseClient';
import { DB, getCenterId } from '@/lib/db';

interface ScheduleNavProps {
  todayView: boolean;
  setTodayView: (v: boolean) => void;
  weekStart: Date;
  isCurrentWeek: boolean;
  goToPrevWeek: () => void;
  goToNextWeek: () => void;
  goToThisWeek: () => void;
  terms?: Array<{ id: string; name: string; status?: string | null }>;
  selectedTermId?: string;
  setSelectedTermId?: (v: string) => void;
  bulkRemoveMode?: boolean;
  selectedBulkCount?: number;
  isBulkRemoving?: boolean;
  onToggleBulkRemoveMode?: () => void;
  onBulkRemove?: () => void;
  onClearBulkSelection?: () => void;
  onClearWeekNonRecurring?: () => void;
  isClearingWeek?: boolean;
  weeklyStudents?: number;
  weeklySessions?: number;
  commandBarSlot?: React.ReactNode;
  onConfirmWeek?: () => void;
  weekConfirmedAt?: string | null;
  onJumpToDate?: (date: Date) => void;
}

export function ScheduleNav({
  todayView,
  setTodayView,
  weekStart,
  isCurrentWeek,
  goToPrevWeek,
  goToNextWeek,
  goToThisWeek,
  terms = [],
  selectedTermId = '',
  setSelectedTermId,
  bulkRemoveMode,
  selectedBulkCount = 0,
  isBulkRemoving,
  onToggleBulkRemoveMode,
  onBulkRemove,
  onClearBulkSelection,
  onClearWeekNonRecurring,
  isClearingWeek,
  weeklyStudents,
  weeklySessions,
  commandBarSlot,
  onConfirmWeek,
  weekConfirmedAt,
  onJumpToDate,
}: ScheduleNavProps) {
  const [clearMenuOpen, setClearMenuOpen] = useState(false);

  // ── Sticky notes ──
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notesDirty, setNotesDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const notesDirtyRef = useRef(false);

  useEffect(() => {
    notesDirtyRef.current = notesDirty;
  }, [notesDirty]);

  useEffect(() => {
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;
    let realtime: ReturnType<typeof supabase.channel> | null = null;

    async function loadNotes(opts?: { force?: boolean }) {
      setNotesError(null);
      try {
        const res = await fetch('/api/center-weekly-notes', { cache: 'no-store' });
        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setNotesError(payload?.error ?? 'Failed to load notes');
          return;
        }
        if (opts?.force || !notesDirtyRef.current) {
          setNotes(typeof payload?.notes === 'string' ? payload.notes : '');
          if (opts?.force) setNotesDirty(false);
        }
      } catch (err: any) {
        if (cancelled) return;
        setNotesError(err?.message ?? 'Failed to load notes');
      }
    }

    loadNotes();

    // Poll as a fallback in case realtime isn't available.
    pollId = setInterval(() => {
      void loadNotes();
    }, 15000);

    try {
      realtime = supabase
        .channel('center-notes-sync')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: DB.centerSettings,
            filter: `center_id=eq.${getCenterId()}`,
          },
          () => {
            void loadNotes();
          }
        )
        .subscribe();
    } catch {
      // Ignore realtime initialization errors and rely on polling.
    }

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      if (realtime) supabase.removeChannel(realtime);
    };
  }, []);

  async function handleSaveNotes() {
    setNotesError(null);
    setNotesSaving(true);
    try {
      const res = await fetch('/api/center-weekly-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? 'Failed to save notes');

      setNotes(typeof payload?.notes === 'string' ? payload.notes : notes);
      setNotesDirty(false);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch (err: any) {
      setNotesError(err?.message ?? 'Failed to save notes');
      setNotesSaved(false);
    } finally {
      setNotesSaving(false);
    }
  }

  function insertBullet() {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = notes.slice(0, start);
    const after = notes.slice(end);
    const prefix = start === 0 || notes[start - 1] === '\n' ? '• ' : '\n• ';
    const next = before + prefix + after;
    setNotes(next);
    setNotesDirty(true);
    setNotesSaved(false);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + prefix.length;
      el.focus();
    });
  }

  return (
    <div className="sticky top-0 z-30 border-b"
      style={{ background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(16px)', borderColor: '#e0e7ff' }}>
      <div className="mx-auto px-2 md:px-6 h-10 md:h-11 relative flex items-center gap-1.5 md:gap-2" style={{ maxWidth: 1600 }}>
          {/* Week/Today toggle */}
          <div className="flex gap-0.5 p-0.5 rounded-lg shrink-0" style={{ background: '#e0e7ff' }}>
            <button onClick={() => setTodayView(false)}
              className="px-2 md:px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all"
              style={!todayView ? { background: 'white', color: '#4f46e5', boxShadow: '0 1px 3px rgba(79,70,229,0.15)' } : { color: '#818cf8' }}>
              Week
            </button>
            <button onClick={() => setTodayView(true)}
              className="px-2 md:px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all"
              style={todayView ? { background: '#4f46e5', color: 'white', boxShadow: '0 1px 3px rgba(79,70,229,0.3)' } : { color: '#818cf8' }}>
              Today
            </button>
          </div>

          {/* Week navigator */}
          {!todayView && (
            <>
              <div className="w-px h-5 shrink-0 hidden md:block" style={{ background: '#a5b4fc' }} />
              <button onClick={goToPrevWeek} className="w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center transition-all shrink-0"
                style={{ background: 'white', border: '1px solid #a5b4fc', color: '#4f46e5' }}>
                <ChevronLeft size={12} />
              </button>
              <div className="hidden sm:flex flex-col items-center shrink-0">
                <div className="text-xs font-bold leading-none" style={{ color: '#111827', fontFamily: 'ui-serif, Georgia, serif' }}>{formatWeekRange(weekStart)}</div>
                {isCurrentWeek && <div className="text-[8px] font-bold uppercase tracking-widest mt-0.5" style={{ color: '#4f46e5' }}>This Week</div>}
              </div>
              {onJumpToDate && (
                <label
                  className="w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center cursor-pointer shrink-0 relative overflow-hidden"
                  style={{ background: 'white', border: '1px solid #a5b4fc', color: '#818cf8' }}
                  title="Jump to week">
                  <CalendarDays size={11} className="pointer-events-none relative z-10" />
                  <input
                    type="date"
                    value={toISODate(weekStart)}
                    onChange={e => {
                      if (!e.target.value) return;
                      const d = new Date(e.target.value + 'T00:00:00');
                      if (!isNaN(d.getTime())) onJumpToDate(d);
                    }}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                </label>
              )}
              <button onClick={goToNextWeek} className="w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center transition-all shrink-0"
                style={{ background: 'white', border: '1px solid #a5b4fc', color: '#4f46e5' }}>
                <ChevronRight size={12} />
              </button>
              {!isCurrentWeek && (
                <button onClick={goToThisWeek}
                  className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-[9px] font-bold uppercase transition-all shrink-0"
                  style={{ background: '#e0e7ff', border: '1px solid #a5b4fc', color: '#4f46e5' }}>
                  <CalendarDays size={9} />
                  <span className="hidden sm:inline">Now</span>
                </button>
              )}
              <div className="w-px h-5 shrink-0" style={{ background: '#a5b4fc' }} />
              <button
                onClick={() => setNotesOpen(o => !o)}
                title="Notes"
                className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-lg shrink-0 transition-all"
                style={{
                  background: notesOpen ? '#4f46e5' : 'white',
                  border: `1px solid ${notesOpen ? '#4f46e5' : '#a5b4fc'}`,
                  color: notesOpen ? 'white' : '#4f46e5',
                  cursor: 'pointer',
                }}>
                <NotebookPen size={12} />
              </button>
            </>
          )}

        {/* Centered command bar */}
        {commandBarSlot && (
          <div
            className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center gap-2 shrink-0 rounded-lg px-1.5 py-1"
            style={{
              width: '680px',
              background: 'linear-gradient(120deg, rgba(79,70,229,0.12) 0%, rgba(129,140,248,0.16) 52%, rgba(224,231,255,0.9) 100%)',
              border: '1px solid #c7d2fe',
              boxShadow: '0 6px 14px rgba(79,70,229,0.1)',
            }}
          >
            {commandBarSlot}
          </div>
        )}

        <div className="flex-1 min-w-0" />

        {!todayView && onToggleBulkRemoveMode && onBulkRemove && onClearWeekNonRecurring && (
          <div className="relative shrink-0">
            <button
              onClick={() => setClearMenuOpen(v => !v)}
              disabled={!!isClearingWeek || !!isBulkRemoving}
              className="w-7 h-7 md:w-auto md:h-auto md:px-2.5 md:py-1.5 flex items-center justify-center md:gap-1 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: bulkRemoveMode ? '#312e81' : weekConfirmedAt ? '#dcfce7' : 'white',
                border: `1px solid ${bulkRemoveMode ? '#312e81' : weekConfirmedAt ? '#86efac' : '#fca5a5'}`,
                color: bulkRemoveMode ? 'white' : weekConfirmedAt ? '#15803d' : '#b91c1c',
                cursor: (isClearingWeek || isBulkRemoving) ? 'not-allowed' : 'pointer',
              }}>
              {weekConfirmedAt ? <Check size={12} /> : <Trash2 size={12} />}
              <span className="hidden md:inline">
                {bulkRemoveMode ? `Bulk Remove (${selectedBulkCount})` : isClearingWeek ? 'Clearing…' : weekConfirmedAt ? 'Week OK' : 'Manage'}
              </span>
              <ChevronDown size={12} />
            </button>

            {clearMenuOpen && (
              <div className="absolute right-0 mt-1 z-40 rounded-lg overflow-hidden"
                style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(15,23,42,0.16)', minWidth: 200 }}>

                {onConfirmWeek && (
                  <button
                    onClick={() => { setClearMenuOpen(false); onConfirmWeek(); }}
                    className="w-full text-left px-3 py-2.5 text-xs font-bold flex items-center gap-2"
                    style={{
                      color: weekConfirmedAt ? '#15803d' : '#4f46e5',
                      background: weekConfirmedAt ? '#f0fdf4' : 'white',
                      borderBottom: '1px solid #f1f5f9',
                    }}>
                    <Check size={12} />
                    {weekConfirmedAt ? 'Week confirmed ✓' : 'Confirm & Send Week…'}
                  </button>
                )}

                <button
                  onClick={() => { setClearMenuOpen(false); onClearWeekNonRecurring(); }}
                  disabled={!!isClearingWeek}
                  className="w-full text-left px-3 py-2 text-xs font-semibold"
                  style={{ color: '#b91c1c', background: 'white', borderBottom: '1px solid #f1f5f9' }}>
                  {isClearingWeek ? 'Clearing Week…' : 'Clear Week'}
                </button>

                <button
                  onClick={() => { setClearMenuOpen(false); onToggleBulkRemoveMode(); }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold"
                  style={{ color: bulkRemoveMode ? '#312e81' : '#334155', background: 'white', borderBottom: bulkRemoveMode ? '1px solid #f1f5f9' : 'none' }}>
                  {bulkRemoveMode ? 'Exit Bulk Remove' : 'Enter Bulk Remove'}
                </button>

                {bulkRemoveMode && (
                  <>
                    <button
                      onClick={() => { setClearMenuOpen(false); onBulkRemove(); }}
                      disabled={!selectedBulkCount || !!isBulkRemoving}
                      className="w-full text-left px-3 py-2 text-xs font-bold"
                      style={{
                        color: selectedBulkCount ? '#4f46e5' : '#94a3b8',
                        background: 'white',
                        borderBottom: !!selectedBulkCount ? '1px solid #f1f5f9' : 'none',
                        cursor: selectedBulkCount ? 'pointer' : 'not-allowed',
                      }}>
                      {isBulkRemoving ? 'Removing…' : `Delete Selected (${selectedBulkCount})`}
                    </button>

                    {!!selectedBulkCount && onClearBulkSelection && (
                      <button
                        onClick={() => { setClearMenuOpen(false); onClearBulkSelection(); }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold"
                        style={{ color: '#475569', background: 'white' }}>
                        Clear Selection
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

          {!todayView && weeklyStudents !== undefined && weeklySessions !== undefined && (
            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
              <div className="w-px h-5" style={{ background: '#a5b4fc' }} />
              <span className="text-[10px] font-semibold" style={{ color: '#475569' }}>
                {weeklyStudents} students · {weeklySessions} sessions
              </span>
            </div>
          )}

          {!todayView && terms.length > 0 && setSelectedTermId && (
            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
              <div className="w-px h-5" style={{ background: '#a5b4fc' }} />
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#818cf8' }}>Term</span>
              <div className="relative">
                <select
                  value={selectedTermId}
                  onChange={e => setSelectedTermId(e.target.value)}
                  className="appearance-none pl-3 pr-7 py-1 rounded-lg text-[11px] font-black uppercase tracking-wide cursor-pointer"
                  style={{
                    background: '#4f46e5',
                    border: '1.5px solid #4338ca',
                    color: 'white',
                    outline: 'none',
                    maxWidth: 160,
                    boxShadow: '0 2px 6px rgba(79,70,229,0.35)',
                  }}>
                  {terms.map(term => (
                    <option key={term.id} value={term.id}>{term.name}</option>
                  ))}
                </select>
                <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'rgba(255,255,255,0.75)' }} />
              </div>
              <div className="w-px h-5" style={{ background: '#a5b4fc' }} />
            </div>
          )}

      </div>

      {/* ── Center Notes modal ── */}
      {notesOpen && typeof document !== 'undefined' && createPortal((
        <div
          onClick={() => setNotesOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.52)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(620px, 92vw)',
              maxHeight: '84vh',
              background: '#ffffff',
              border: '1px solid #c7d2fe',
              borderRadius: 14,
              boxShadow: '0 24px 64px rgba(15,23,42,0.26)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                padding: '14px 16px',
                borderBottom: '1px solid #e0e7ff',
                background: '#f8faff',
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#3730a3' }}>Center Notes</p>
                <p style={{ margin: '2px 0 0', fontWeight: 500, fontSize: 11, color: '#64748b' }}>
                  Shared across all weeks
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={insertBullet}
                  title="Insert bullet point"
                  style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', background: '#e0e7ff', border: '1px solid #c7d2fe', borderRadius: 7, padding: '4px 10px', cursor: 'pointer' }}
                >• Bullet</button>
                <button
                  onClick={() => setNotesOpen(false)}
                  title="Close"
                  style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #cbd5e1', background: 'white', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
              <textarea
                ref={textareaRef}
                autoFocus
                value={notes}
                onChange={e => { setNotes(e.target.value); setNotesSaved(false); setNotesDirty(true); }}
                placeholder="Jot down anything you need to remember…"
                style={{
                  width: '100%',
                  minHeight: 220,
                  maxHeight: '46vh',
                  resize: 'vertical',
                  border: '1px solid #c7d2fe',
                  borderRadius: 10,
                  padding: '12px 14px',
                  fontSize: 14,
                  color: '#1f2937',
                  outline: 'none',
                  fontFamily: 'inherit',
                  lineHeight: 1.6,
                  background: '#ffffff',
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <p style={{ margin: 0, color: '#64748b', fontSize: 11, fontWeight: 600 }}>
                  These notes persist globally for this center.
                </p>
                <button
                  onClick={handleSaveNotes}
                  disabled={notesSaving}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 800,
                    border: 'none',
                    cursor: notesSaving ? 'not-allowed' : 'pointer',
                    background: notesSaved ? '#dcfce7' : notesSaving ? '#e0e7ff' : '#4f46e5',
                    color: notesSaved ? '#15803d' : notesSaving ? '#818cf8' : 'white',
                    transition: 'background 0.2s',
                  }}
                >
                  {notesSaving ? 'Saving…' : notesSaved ? '✓ Saved' : 'Save Notes'}
                </button>
              </div>
              {notesError && (
                <p style={{ margin: 0, color: '#b91c1c', fontSize: 11, fontWeight: 600 }}>
                  {notesError}
                </p>
              )}
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}