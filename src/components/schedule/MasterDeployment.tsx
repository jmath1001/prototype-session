"use client"
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Loader2, Zap } from 'lucide-react';

import { MAX_CAPACITY, getSessionsForDay, type SessionBlock } from '@/components/constants';
import {
  useScheduleData,
  bookStudent,
  removeStudentFromSession,
  moveStudentSession,
  clearWeekNonRecurring,
  getWeekStart,
  getWeekDates,
  toISODate,
  dayOfWeek,
  getCentralTimeNow,
  type BookStudentResult,
  type Tutor,
  type Student,
} from '@/lib/useScheduleData';
import { BookingForm, BookingToast } from '@/components/BookingForm';
import { TutorManagementModal } from '@/components/TutorManagementModal';
import OptimizationPreview from '@/components/OptimizationPreview';
import { useOptimizer } from '@/hooks/useOptimizer';
import type { PrefilledSlot, BookingConfirmData } from '@/components/BookingForm';

import { ACTIVE_DAYS, DAY_NAMES, TUTOR_PALETTES } from './scheduleConstants';
import { isTutorAvailable } from './scheduleUtils';
import { ScheduleNav } from './ScheduleNav';
import { TodayView } from './TodayView';
import { WeekView } from './WeekView';
import { AttendanceModal } from './AttendanceModal';
import { logEvent } from '@/lib/analytics';
import { CommandBar } from '@/components/CommandBar';
import { ScheduleBuilder } from '@/components/ScheduleBuilder';

export default function MasterDeployment() {
  const [todayDate, setTodayDate] = useState<Date>(() => getCentralTimeNow());
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(getCentralTimeNow()));
  const [isScheduleBuilderOpen, setIsScheduleBuilderOpen] = useState(false);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const { tutors, students, sessions, timeOff, loading, error, refetch } = useScheduleData(weekStart);
  const nextWeekStart = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    return d;
  }, [weekStart]);
  const { sessions: nextWeekSessions } = useScheduleData(nextWeekStart);

  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [aiPrefilledStudentId, setAiPrefilledStudentId] = useState<string | null>(null);
  const [gridSlotToBook, setGridSlotToBook] = useState<PrefilledSlot | null>(null);
  const [enrollCat, setEnrollCat] = useState('math');
  const [bookingToast, setBookingToast] = useState<BookingConfirmData | null>(null);
  const [isTutorModalOpen, setIsTutorModalOpen] = useState(false);
  const [selectedTutorFilter, setSelectedTutorFilter] = useState<string | null>(null);
  const [todayView, setTodayView] = useState(true);
  const [modalTab, setModalTab] = useState<'attendance' | 'confirmation' | 'notes'>('attendance');
  const [bulkRemoveMode, setBulkRemoveMode] = useState(false);
  const [selectedRemovals, setSelectedRemovals] = useState<Record<string, { sessionId: string; studentId: string; name: string }>>({});
  const [isBulkRemoving, setIsBulkRemoving] = useState(false);
  const [isClearingWeek, setIsClearingWeek] = useState(false);
  const [localSessions, setLocalSessions] = useState(sessions);

  useEffect(() => {
    setLocalSessions(sessions);
  }, [sessions]);

  const applyInlineBookingOptimistic = useCallback((
    current: typeof localSessions,
    args: {
      tutorId: string;
      date: string;
      time: string;
      student: Student;
      topic: string;
      notes: string;
      recurring: boolean;
      recurringWeeks: number;
    }
  ) => {
    const { tutorId, date, time, student, topic, notes, recurring, recurringWeeks } = args;
    const weeks = recurring ? recurringWeeks : 1;
    const next = [...current];

    for (let w = 0; w < weeks; w++) {
      const d = new Date(date + 'T00:00:00');
      d.setDate(d.getDate() + (w * 7));
      const isoDate = toISODate(d);

      const studentRow = {
        rowId: `temp-${Date.now()}-${w}-${Math.random().toString(16).slice(2)}`,
        id: student.id,
        name: student.name,
        topic,
        status: 'scheduled',
        grade: student.grade ?? null,
        notes: notes || null,
        confirmationStatus: null,
        seriesId: null,
      };

      const existingIdx = next.findIndex(s => s.date === isoDate && s.tutorId === tutorId && s.time === time);
      if (existingIdx >= 0) {
        const existing = next[existingIdx];
        if (existing.students.some(st => st.id === student.id && st.status !== 'cancelled')) continue;
        next[existingIdx] = {
          ...existing,
          students: [...existing.students, studentRow],
        };
      } else {
        next.push({
          id: `temp-session-${Date.now()}-${w}-${Math.random().toString(16).slice(2)}`,
          date: isoDate,
          tutorId,
          time,
          students: [studentRow],
        });
      }
    }

    next.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    return next;
  }, []);

  const reconcileInlineBooking = useCallback((
    current: typeof localSessions,
    bookedRows: BookStudentResult[],
    student: Student,
  ) => {
    const next = [...current];

    for (const row of bookedRows) {
      const idx = next.findIndex(s => s.date === row.date && s.tutorId === row.tutorId && s.time === row.time);
      const normalizedStudent = {
        rowId: row.rowId,
        id: row.studentId,
        name: student.name,
        topic: row.topic,
        status: 'scheduled',
        grade: student.grade ?? null,
        notes: row.notes,
        confirmationStatus: null,
        seriesId: row.seriesId,
      };

      if (idx >= 0) {
        const existing = next[idx];
        const studentIdx = existing.students.findIndex(st => st.id === row.studentId);
        const studentsForSession = studentIdx >= 0
          ? existing.students.map((st, sIdx) => (sIdx === studentIdx ? normalizedStudent : st))
          : [...existing.students, normalizedStudent];
        next[idx] = {
          ...existing,
          id: row.sessionId,
          students: studentsForSession,
        };
      } else {
        next.push({
          id: row.sessionId,
          date: row.date,
          tutorId: row.tutorId,
          time: row.time,
          students: [normalizedStudent],
        });
      }
    }

    next.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    return next;
  }, []);

  const handleTodayDateChange = useCallback((date: Date) => {
    setTodayDate(date);
    setWeekStart(getWeekStart(date));
  }, []);

  useEffect(() => {
    if (!todayView) return;
    const selectedWeek = getWeekStart(todayDate);
    if (toISODate(selectedWeek) !== toISODate(weekStart)) {
      setWeekStart(selectedWeek);
    }
  }, [todayView, todayDate, weekStart]);

  const handleScheduleBuilderConfirm = useCallback(async (
    bookings: { student: Student; slot: any; topic: string }[]
  ) => {
    for (const booking of bookings) {
      await bookStudent({
        tutorId: booking.slot.tutor.id,
        date: booking.slot.date,
        time: booking.slot.time,
        student: booking.student,
        topic: booking.topic,
        notes: '',
        recurring: false,
        recurringWeeks: 1,
      });
    }
    refetch();
    setIsScheduleBuilderOpen(false);
    logEvent('schedule_builder_confirmed', { count: bookings.length });
  }, [refetch]);

  useEffect(() => {
    if (todayView) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.background = '#fafafa';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.background = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.background = '';
    };
  }, [todayView]);

  const tutorPaletteMap = useMemo(() => {
    const map: Record<string, number> = {};
    tutors.forEach((t, i) => { map[t.id] = i % TUTOR_PALETTES.length; });
    return map;
  }, [tutors]);

  const goToPrevWeek = () => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; });
  const goToNextWeek = () => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; });
  const goToThisWeek = () => {
    const now = getCentralTimeNow();
    setTodayDate(now);
    setWeekStart(getWeekStart(now));
  };
  const isCurrentWeek = toISODate(weekStart) === toISODate(getWeekStart(new Date()));

  const activeDates = useMemo(() =>
    weekDates.filter(d => ACTIVE_DAYS.includes(dayOfWeek(toISODate(d)))),
    [weekDates]
  );
  const selectedBulkCount = useMemo(() => Object.keys(selectedRemovals).length, [selectedRemovals]);

  useEffect(() => {
    if (!bulkRemoveMode) setSelectedRemovals({});
  }, [bulkRemoveMode]);

  const handleBulkRemove = useCallback(async () => {
    if (!selectedBulkCount) return;
    if (!window.confirm(`Remove ${selectedBulkCount} selected booking${selectedBulkCount === 1 ? '' : 's'}?`)) return;
    setIsBulkRemoving(true);
    try {
      await Promise.all(Object.values(selectedRemovals).map(item =>
        removeStudentFromSession({ sessionId: item.sessionId, studentId: item.studentId })
      ));
      setSelectedRemovals({});
      setBulkRemoveMode(false);
      refetch();
      logEvent('bulk_remove_sessions', { count: selectedBulkCount, source: 'schedule_nav' });
    } catch (err: any) {
      console.error('Bulk removal failed', err);
      alert(err?.message || 'Bulk removal failed. Please try again.');
    } finally {
      setIsBulkRemoving(false);
    }
  }, [selectedBulkCount, selectedRemovals, refetch]);

  const handleClearWeekNonRecurring = useCallback(async () => {
    const from = toISODate(weekStart);
    if (!window.confirm(`Clear all non-recurring bookings for the week starting ${from}? Recurring bookings will be preserved.`)) {
      return;
    }

    setIsClearingWeek(true);
    try {
      const result = await clearWeekNonRecurring({ weekStart: from });
      setSelectedRemovals({});
      setBulkRemoveMode(false);
      refetch();
      logEvent('week_cleared_non_recurring', { weekStart: from, ...result });
      alert(`Cleared ${result.deletedBookings} non-recurring booking${result.deletedBookings === 1 ? '' : 's'} for this week.`);
    } catch (err: any) {
      console.error('Clear week failed', err);
      alert(err?.message || 'Failed to clear this week. Please try again.');
    } finally {
      setIsClearingWeek(false);
    }
  }, [weekStart, refetch]);

  // Filtered by enrollCat — for BookingForm
  const allAvailableSeats = useMemo(() => {
    const seats: any[] = [];
    tutors.filter(t => t.cat === enrollCat).forEach(tutor => {
      activeDates.forEach(date => {
        const isoDate = toISODate(date);
        const dow = dayOfWeek(isoDate);
        if (!tutor.availability.includes(dow)) return;
        if (timeOff.some(t => t.tutorId === tutor.id && t.date === isoDate)) return;
        getSessionsForDay(dow).forEach(block => {
          if (!isTutorAvailable(tutor, dow, block.time)) return;
          const session = localSessions.find(s => s.date === isoDate && s.tutorId === tutor.id && s.time === block.time);
          const count = session ? session.students.length : 0;
          if (count < MAX_CAPACITY) {
            seats.push({ tutor, dayName: DAY_NAMES[ACTIVE_DAYS.indexOf(dow)], date: isoDate, time: block.time, block, count, seatsLeft: MAX_CAPACITY - count, dayNum: dow });
          }
        });
      });
    });
    return seats.sort((a, b) => { const dd = a.date.localeCompare(b.date); return dd !== 0 ? dd : a.time.localeCompare(b.time); });
  }, [enrollCat, tutors, localSessions, activeDates, timeOff]);

  // All tutors regardless of category — for ScheduleBuilder
  const allSeatsForBuilder = useMemo(() => {
    const seats: any[] = [];
    tutors.forEach(tutor => {
      activeDates.forEach(date => {
        const isoDate = toISODate(date);
        const dow = dayOfWeek(isoDate);
        if (!tutor.availability.includes(dow)) return;
        if (timeOff.some(t => t.tutorId === tutor.id && t.date === isoDate)) return;
        getSessionsForDay(dow).forEach(block => {
          if (!isTutorAvailable(tutor, dow, block.time)) return;
          const session = localSessions.find(s => s.date === isoDate && s.tutorId === tutor.id && s.time === block.time);
          const count = session ? session.students.length : 0;
          if (count < MAX_CAPACITY) {
            seats.push({ tutor, dayName: DAY_NAMES[ACTIVE_DAYS.indexOf(dow)], date: isoDate, time: block.time, block, count, seatsLeft: MAX_CAPACITY - count, dayNum: dow });
          }
        });
      });
    });
    return seats.sort((a, b) => { const dd = a.date.localeCompare(b.date); return dd !== 0 ? dd : a.time.localeCompare(b.time); });
  }, [tutors, localSessions, activeDates, timeOff]);

  const handleInlineBook = useCallback(async ({ tutorId, date, time, student, topic, notes, recurring, recurringWeeks }: {
    tutorId: string;
    date: string;
    time: string;
    student: Student;
    topic: string;
    notes: string;
    recurring: boolean;
    recurringWeeks: number;
  }) => {
    let previousSessions = localSessions;
    setLocalSessions(curr => {
      previousSessions = curr;
      return applyInlineBookingOptimistic(curr, { tutorId, date, time, student, topic, notes, recurring, recurringWeeks });
    });

    try {
      const bookedRows = await bookStudent({ tutorId, date, time, student, topic, notes: notes || '', recurring, recurringWeeks });
      setLocalSessions(curr => reconcileInlineBooking(curr, bookedRows, student));
    } catch (err) {
      setLocalSessions(previousSessions);
      throw err;
    }
  }, [localSessions, applyInlineBookingOptimistic, reconcileInlineBooking]);

  // Week range strings for ScheduleBuilder
  const weekStartIso = toISODate(weekStart);
  const weekEndIso = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return toISODate(d);
  }, [weekStart]);

  const handleGridSlotClick = (tutor: Tutor, date: string, dayName: string, block: SessionBlock) => {
    setGridSlotToBook({ tutor, dayNum: dayOfWeek(date), dayName, time: block.time, date, block } as any);
  };

  const handleConfirmBooking = async (data: BookingConfirmData) => {
    try {
      await bookStudent({
        tutorId: data.slot.tutor.id, date: (data.slot as any).date, time: data.slot.time,
        student: data.student, topic: data.topic || data.subject || data.student.subject,
        notes: data.notes || '', recurring: data.recurring, recurringWeeks: data.recurringWeeks
      });
      refetch();
      setBookingToast(data);
      setIsEnrollModalOpen(false);
      setGridSlotToBook(null);
      logEvent('session_booked', {
        studentName: data.student.name,
        tutorName: data.slot.tutor.name,
        date: (data.slot as any).date,
        recurring: data.recurring,
        source: gridSlotToBook ? 'grid_slot' : 'booking_form',
      });
      setTimeout(() => setBookingToast(null), 4000);
    } catch (err: any) {
      alert(err.message || "Something went wrong with the booking.");
      console.error('Booking failed:', err);
    }
  };

  const handleAIBookingAction = useCallback(({
    studentId, slotDate, slotTime, tutorId, topic,
  }: {
    studentId?: string
    slotDate?: string
    slotTime?: string
    tutorId?: string
    topic?: string
  }) => {
    if (studentId && !slotDate && !slotTime && !tutorId) {
      setAiPrefilledStudentId(studentId);
      setIsEnrollModalOpen(true);
      logEvent('ai_booking_initiated', { studentId });
      return;
    }
    if (!slotDate || !slotTime || !tutorId) return;
    const tutor = tutors.find(t => t.id === tutorId);
    if (!tutor) return;
    const dow = dayOfWeek(slotDate);
    const block = getSessionsForDay(dow).find(b => b.time === slotTime);
    const dayName = DAY_NAMES[ACTIVE_DAYS.indexOf(dow)];
    setGridSlotToBook({ tutor, dayNum: dow, dayName, time: slotTime, date: slotDate, block } as any);
    setEnrollCat(tutor.cat);
    setAiPrefilledStudentId(studentId ?? null);
    setIsEnrollModalOpen(true);
    logEvent('ai_booking_initiated', { studentId, tutorId, slotDate, slotTime, topic });
  }, [tutors]);

  const setSelectedSessionWithNotes = (s: any) => {
    setSelectedSession(s);
    setModalTab('attendance');
  };

  const patchSelectedSession = useCallback((patch: Record<string, any>) => {
    setSelectedSession((prev: any) => {
      if (!prev) return prev;
      return { ...prev, activeStudent: { ...prev.activeStudent, ...patch } };
    });
  }, []);

  const closeAllModals = () => {
    setIsEnrollModalOpen(false);
    setGridSlotToBook(null);
    setAiPrefilledStudentId(null);
  };

  const { proposal, isApplying, openPreview, confirmChanges, closePreview } = useOptimizer(refetch);

  if (loading) return (
    <div className="w-full min-h-screen flex items-center justify-center" style={{ background: '#fafafa' }}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin" style={{ color: '#c27d38' }} />
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#a07850', fontFamily: 'ui-serif, Georgia, serif' }}>Loading schedule…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="w-full min-h-screen flex items-center justify-center" style={{ background: '#fafafa' }}>
      <div className="text-center">
        <p className="text-sm font-bold mb-2" style={{ color: '#c0392b' }}>Failed to load</p>
        <p className="text-xs mb-6" style={{ color: '#9e8e7e' }}>{error}</p>
        <button onClick={refetch} className="px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-white" style={{ background: '#c27d38' }}>Retry</button>
      </div>
    </div>
  );

  return (
    <div className={`w-full ${todayView ? '' : 'min-h-screen pb-12'}`} style={{ background: '#fafafa', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>

      <ScheduleNav
        todayView={todayView}
        setTodayView={setTodayView}
        weekStart={weekStart}
        isCurrentWeek={isCurrentWeek}
        goToPrevWeek={goToPrevWeek}
        goToNextWeek={goToNextWeek}
        goToThisWeek={goToThisWeek}
        tutors={tutors}
        selectedTutorFilter={selectedTutorFilter}
        setSelectedTutorFilter={setSelectedTutorFilter}
        onOpenEnrollModal={() => setIsEnrollModalOpen(true)}
        bulkRemoveMode={bulkRemoveMode}
        selectedBulkCount={selectedBulkCount}
        isBulkRemoving={isBulkRemoving}
        onToggleBulkRemoveMode={() => setBulkRemoveMode(prev => !prev)}
        onBulkRemove={handleBulkRemove}
        onClearBulkSelection={() => setSelectedRemovals({})}
        onClearWeekNonRecurring={handleClearWeekNonRecurring}
        isClearingWeek={isClearingWeek}
        commandBarSlot={
          <>
            <CommandBar
              sessions={[...localSessions, ...(nextWeekSessions ?? [])]}
              students={students}
              tutors={tutors}
              onBookingAction={handleAIBookingAction}
              onOpenProposal={openPreview}
              onOpenAttendanceModal={(session) => setSelectedSession(session)}
              allAvailableSeats={allAvailableSeats}
              weekStart={weekStartIso}
              nextWeekStart={toISODate(nextWeekStart)}
            />
            <span title="Open schedule builder" style={{ display: 'inline-flex' }}>
              <button
                onClick={() => setIsScheduleBuilderOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 11px',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg,#f59e0b,#ea580c)',
                  border: '1px solid #c2410c',
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(194,65,12,0.35)',
                }}
              >
                <Zap size={12} /> Build
              </button>
            </span>
          </>
        }
      />

      {todayView && (
        <TodayView
          tutors={tutors}
          sessions={localSessions}
          timeOff={timeOff}
          students={students}
          selectedTutorFilter={selectedTutorFilter}
          tutorPaletteMap={tutorPaletteMap}
          setSelectedSessionWithNotes={setSelectedSessionWithNotes}
          handleGridSlotClick={handleGridSlotClick}
          refetch={refetch}
          selectedDate={todayDate}
          onDateChange={handleTodayDateChange}
          onInlineBook={handleInlineBook}
          onMoveStudent={async ({ rowId, studentId, fromSessionId, toTutorId, toDate, toTime }) => {
            await moveStudentSession({ rowId, studentId, fromSessionId, toTutorId, toDate, toTime });
            refetch();
          }}
        />
      )}

      {!todayView && (
        <WeekView
          activeDates={activeDates}
          tutors={tutors}
          sessions={localSessions}
          timeOff={timeOff}
          students={students}
          selectedTutorFilter={selectedTutorFilter}
          tutorPaletteMap={tutorPaletteMap}
          setSelectedSessionWithNotes={setSelectedSessionWithNotes}
          handleGridSlotClick={handleGridSlotClick}
          refetch={refetch}
          bulkRemoveMode={bulkRemoveMode}
          selectedRemovals={selectedRemovals}
          setSelectedRemovals={setSelectedRemovals}
          onInlineBook={handleInlineBook}
          onMoveStudent={async ({ rowId, studentId, fromSessionId, toTutorId, toDate, toTime }) => {
            await moveStudentSession({ rowId, studentId, fromSessionId, toTutorId, toDate, toTime });
            refetch();
          }}
        />
      )}

      {isEnrollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(20,14,8,0.75)', backdropFilter: 'blur(8px)' }}>
          <BookingForm
            prefilledSlot={null}
            onConfirm={handleConfirmBooking}
            onCancel={closeAllModals}
            enrollCat={enrollCat}
            setEnrollCat={setEnrollCat}
            allAvailableSeats={allAvailableSeats}
            studentDatabase={students}
            initialStudentId={aiPrefilledStudentId}
            sessions={localSessions}
          />
        </div>
      )}
      {gridSlotToBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(20,14,8,0.75)', backdropFilter: 'blur(8px)' }}>
          <BookingForm
            prefilledSlot={gridSlotToBook}
            onConfirm={handleConfirmBooking}
            onCancel={closeAllModals}
            enrollCat={enrollCat}
            setEnrollCat={setEnrollCat}
            allAvailableSeats={allAvailableSeats}
            studentDatabase={students}
            initialStudentId={aiPrefilledStudentId}
            sessions={localSessions}
          />
        </div>
      )}

      <AttendanceModal
        selectedSession={selectedSession}
        setSelectedSession={setSelectedSession}
        patchSelectedSession={patchSelectedSession}
        modalTab={modalTab}
        setModalTab={setModalTab}
        tutors={tutors}
        students={students}
        sessions={localSessions}
        refetch={refetch}
      />

      {bookingToast && <BookingToast data={bookingToast} onClose={() => setBookingToast(null)} />}
      {isTutorModalOpen && <TutorManagementModal tutors={tutors} onClose={() => setIsTutorModalOpen(false)} onRefetch={refetch} />}

      <OptimizationPreview
        proposal={proposal}
        onConfirm={confirmChanges}
        onCancel={closePreview}
        isApplying={isApplying}
        activeDates={activeDates}
        tutors={tutors}
        sessions={localSessions}
        timeOff={timeOff}
        students={students}
        tutorPaletteMap={tutorPaletteMap}
      />

      {isScheduleBuilderOpen && (
        <ScheduleBuilder
          students={students}
          tutors={tutors}
          sessions={localSessions}
          allAvailableSeats={allSeatsForBuilder}
          weekStart={weekStartIso}
          weekEnd={weekEndIso}
          onConfirm={handleScheduleBuilderConfirm}
          onClose={() => setIsScheduleBuilderOpen(false)}
        />
      )}
    </div>
  );
}