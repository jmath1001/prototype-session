"use client"
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, GraduationCap, Loader2, Save, X, Search, ChevronDown, ChevronUp, CalendarDays, PlusCircle, Mail, Phone, ExternalLink, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { BookingForm, BookingToast } from '@/components/BookingForm';
import {
  bookStudent,
  getWeekStart,
  getWeekDates,
  toISODate,
  dayOfWeek,
  getCentralTimeNow,
} from '@/lib/useScheduleData';
import { getSessionsForDay } from '@/components/constants';

const EMPTY_FORM = { name: '', grade: '', email: '', phone: '', parent_name: '', parent_email: '', parent_phone: '' };
const ACTIVE_DAYS = [1, 2, 3, 4, 6];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'];
const MAX_CAPACITY = 3;

const isTutorAvailable = (tutor: any, dow: number, time: string) =>
  tutor.availability_blocks?.includes(`${dow}-${time}`);

const inputCls = "w-full px-3 py-2 bg-[#f0ece8]/50 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-[#dc2626] border border-transparent focus:border-[#dc2626] placeholder:text-[#c4bfba]";

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  present:   { bg: '#dcfce7', color: '#15803d', label: 'Present' },
  'no-show': { bg: '#fee2e2', color: '#b91c1c', label: 'No-show' },
  scheduled: { bg: '#ede9fe', color: '#6d28d9', label: 'Scheduled' },
  confirmed: { bg: '#dcfce7', color: '#15803d', label: 'Confirmed' },
  unknown:   { bg: '#f3f4f6', color: '#9ca3af', label: 'Not marked' },
};

const AVATAR_COLORS = [
  { bg: '#fee2e2', color: '#dc2626' },
  { bg: '#fef3c7', color: '#d97706' },
  { bg: '#dbeafe', color: '#2563eb' },
  { bg: '#dcfce7', color: '#16a34a' },
  { bg: '#ede9fe', color: '#7c3aed' },
  { bg: '#fce7f3', color: '#db2777' },
];

function SessionRow({ session, isPast }: { session: any; isPast: boolean }) {
  const rawStatus = isPast && session.status === 'scheduled' ? 'unknown' : session.status;
  const sc = STATUS_STYLE[rawStatus] ?? STATUS_STYLE.unknown;
  const d = new Date(session.date + 'T00:00:00');
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all"
      style={{ background: isPast ? '#fafafa' : 'white', borderColor: isPast ? '#f0f0f0' : '#f0ece8' }}>
      <div className="w-9 h-9 rounded-lg flex flex-col items-center justify-center shrink-0"
        style={{ background: isPast ? '#f3f4f6' : '#ede9fe' }}>
        <span className="text-[8px] font-black uppercase leading-none" style={{ color: isPast ? '#9ca3af' : '#6d28d9' }}>
          {d.toLocaleDateString('en-US', { month: 'short' })}
        </span>
        <span className="text-sm font-black leading-none" style={{ color: isPast ? '#374151' : '#6d28d9' }}>
          {d.getDate()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-[#1c1917] truncate">{session.topic}</p>
        <p className="text-[10px] text-[#a8a29e] truncate">{session.tutorName} · {session.blockLabel}</p>
      </div>
      <span className="text-[9px] font-black px-2 py-1 rounded-lg shrink-0" style={{ background: sc.bg, color: sc.color }}>
        {sc.label}
      </span>
    </div>
  );
}

// Field lifted OUTSIDE StudentRow so it never gets recreated on re-render,
// which was causing inputs to unmount/remount and lose focus after every keystroke.
function Field({
  label, value, field, type = 'text', isEditing, draft, onChange,
}: {
  label: string; value: string; field: string; type?: string;
  isEditing: boolean; draft: any; onChange: (field: string, value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black text-[#a8a29e] uppercase tracking-widest">{label}</label>
      {isEditing ? (
        <input
          type={type}
          value={draft[field] ?? ''}
          onChange={e => onChange(field, e.target.value)}
          className={inputCls}
          placeholder={label}
        />
      ) : (
        <p className="text-sm text-black">{value || <span className="text-[#c4bfba] italic text-xs">—</span>}</p>
      )}
    </div>
  );
}

function StudentRow({
  student, onRefetch, tutors, allSessions, allAvailableSeats, onBookingSuccess,
}: {
  student: any; onRefetch: () => void; tutors: any[];
  allSessions: any[]; allAvailableSeats: any[]; onBookingSuccess: (data: any) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'sessions' | 'contact'>('sessions');
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(student);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [enrollCat, setEnrollCat] = useState('math');

  const today = toISODate(getCentralTimeNow());
  const weekStart = getWeekStart(getCentralTimeNow());
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = toISODate(weekEnd);

  // Stable setter so Field's onChange never changes identity
  const handleDraftChange = useCallback((field: string, value: string) => {
    setDraft((prev: any) => ({ ...prev, [field]: value }));
  }, []);

  const allStudentSessions = useMemo(() =>
    allSessions
      .flatMap(s => s.students
        .filter((ss: any) => ss.id === student.id)
        .map((ss: any) => ({
          date: s.date, tutorId: s.tutorId,
          tutorName: tutors.find(t => t.id === s.tutorId)?.name ?? 'Unknown',
          time: s.time,
          blockLabel: (() => {
            const block = getSessionsForDay(dayOfWeek(s.date)).find((b: any) => b.time === s.time);
            return block?.label ?? s.time;
          })(),
          topic: ss.topic, status: ss.status,
          isPast: s.date < today,
        }))
      )
      .sort((a, b) => b.date.localeCompare(a.date)),
    [allSessions, student.id, tutors, today]
  );

  const upcomingSessions = allStudentSessions.filter(s => !s.isPast);
  const pastSessions = allStudentSessions.filter(s => s.isPast);
  const thisWeekSessions = upcomingSessions.filter(s => s.date <= weekEndStr);
  const isBookedThisWeek = thisWeekSessions.length > 0;
  const presentCount = pastSessions.filter(s => s.status === 'present' || s.status === 'confirmed').length;

  const handleUpdate = async () => {
    setSaving(true);
    const { error } = await supabase.from('slake_students').update({
      name: draft.name, grade: draft.grade,
      email: draft.email || null, phone: draft.phone || null,
      parent_name: draft.parent_name || null,
      parent_email: draft.parent_email || null,
      parent_phone: draft.parent_phone || null,
      bluebook_url: draft.bluebook_url || null,
    }).eq('id', student.id);
    if (!error) { onRefetch(); setIsEditing(false); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); return; }
    await supabase.from('slake_students').delete().eq('id', student.id);
    onRefetch();
  };

  const handleConfirmBooking = async (data: any) => {
    await bookStudent({
      tutorId: data.slot.tutor.id, date: data.slot.date, time: data.slot.time,
      student: { id: student.id, name: student.name, subject: student.subject ?? '', grade: student.grade ?? null, hoursLeft: student.hours_left ?? 0, availabilityBlocks: student.availability_blocks ?? [], email: student.email ?? null, phone: student.phone ?? null, parent_name: student.parent_name ?? null, parent_email: student.parent_email ?? null, parent_phone: student.parent_phone ?? null, bluebook_url: student.bluebook_url ?? null },
      topic: data.topic, recurring: data.recurring, recurringWeeks: data.recurringWeeks,
    });
    setShowBooking(false);
    onRefetch();
    onBookingSuccess(data);
  };

  const avatarColor = AVATAR_COLORS[student.name.charCodeAt(0) % AVATAR_COLORS.length];
  const initials = student.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <div className={`bg-white rounded-2xl border-2 transition-all overflow-hidden ${expanded ? 'border-[#dc2626] shadow-md' : 'border-[#f0ece8] hover:border-[#fecaca]'}`}>
        {/* Main card */}
        <div className="p-4 flex items-start gap-3">
          {/* Avatar */}
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
            style={{ background: avatarColor.bg, color: avatarColor.color }}>
            {initials}
          </div>

          {/* Info — clickable to expand */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(e => !e)}>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-black text-[#1c1917] text-sm leading-tight">{student.name}</p>
              {student.grade && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider"
                  style={{ background: '#fee2e2', color: '#dc2626' }}>Gr. {student.grade}</span>
              )}
              {isBookedThisWeek ? (
                <span className="text-[9px] font-bold text-[#15803d] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] inline-block" />
                  Booked
                </span>
              ) : (
                <span className="text-[9px] font-bold text-[#ef4444] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] inline-block" />
                  Not booked
                </span>
              )}
            </div>
            {/* Stats row */}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {(student.parent_email || student.email) && (
                <span className="text-[10px] text-[#a8a29e] flex items-center gap-1 truncate max-w-[180px]">
                  <Mail size={9} className="shrink-0" />{student.parent_email || student.email}
                </span>
              )}
              {pastSessions.length > 0 && (
                <span className="text-[10px] text-[#a8a29e] flex items-center gap-1">
                  <Clock size={9} /> {presentCount}/{pastSessions.length} attended
                </span>
              )}
              {upcomingSessions.length > 0 && (
                <span className="text-[10px] font-semibold" style={{ color: '#6d28d9' }}>
                  {upcomingSessions.length} upcoming
                </span>
              )}
            </div>
            {/* Next session preview */}
            {upcomingSessions[0] && (
              <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg w-fit"
                style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                <CalendarDays size={10} style={{ color: '#dc2626' }} />
                <span className="text-[10px] font-bold" style={{ color: '#dc2626' }}>
                  {new Date(upcomingSessions[0].date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {upcomingSessions[0].topic}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowBooking(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-white transition-all active:scale-95"
                style={{ background: '#dc2626' }}>
                <PlusCircle size={11} /> Book
              </button>
              <button onClick={() => setExpanded(e => !e)}
                className="p-1.5 rounded-lg text-[#a8a29e] hover:bg-[#f0ece8] transition-all">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
            {!isEditing && (
              <div className="flex items-center gap-1">
                <button onClick={handleDelete}
                  className={`p-1.5 rounded-lg transition-all text-xs ${confirmDelete ? 'bg-red-100 text-red-600 font-black px-2' : 'text-[#d4cfc9] hover:text-red-400 hover:bg-red-50'}`}>
                  {confirmDelete ? 'Sure?' : <Trash2 size={12} />}
                </button>
                <button onClick={() => { setIsEditing(true); setExpanded(true); setTab('contact'); }}
                  className="px-2 py-1 text-[10px] font-black text-[#78716c] border border-[#e7e3dd] rounded-lg hover:bg-[#f0ece8] transition-all">
                  Edit
                </button>
              </div>
            )}
            {isEditing && (
              <div className="flex items-center gap-1">
                <button onClick={() => { setIsEditing(false); setDraft(student); }}
                  className="p-1.5 rounded-lg text-[#a8a29e] hover:bg-[#f0ece8]"><X size={13} /></button>
                <button onClick={handleUpdate} disabled={saving}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black text-white disabled:opacity-50 transition-all"
                  style={{ background: '#1c1917' }}>
                  {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Save
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Expanded section */}
        {expanded && (
          <div className="border-t border-[#f0ece8] bg-[#faf9f7]">
            <div className="flex border-b border-[#f0ece8] px-4 pt-2 gap-1">
              {(['sessions', 'contact'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-t-lg transition-all ${tab === t ? 'bg-white border border-b-white border-[#f0ece8] -mb-px text-[#dc2626]' : 'text-[#a8a29e] hover:text-[#1c1917]'}`}>
                  {t === 'sessions' ? `Sessions (${allStudentSessions.length})` : 'Contact'}
                </button>
              ))}
            </div>

            <div className="p-4">
              {tab === 'sessions' && (
                <div className="space-y-4">
                  {upcomingSessions.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#dc2626' }}>Upcoming ({upcomingSessions.length})</p>
                      {upcomingSessions.map((s, i) => <SessionRow key={i} session={s} isPast={false} />)}
                    </div>
                  )}
                  {pastSessions.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-black text-[#a8a29e] uppercase tracking-widest">Past ({pastSessions.length})</p>
                      {pastSessions.map((s, i) => <SessionRow key={i} session={s} isPast={true} />)}
                    </div>
                  )}
                  {allStudentSessions.length === 0 && (
                    <div className="py-8 text-center rounded-xl border border-dashed border-[#e7e3dd]">
                      <CalendarDays size={20} className="mx-auto mb-2 text-[#d4cfc9]" />
                      <p className="text-xs text-[#a8a29e] italic mb-3">No sessions yet</p>
                      <button onClick={() => setShowBooking(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white mx-auto transition-all"
                        style={{ background: '#dc2626' }}>
                        <PlusCircle size={12} /> Book Now
                      </button>
                    </div>
                  )}
                </div>
              )}

              {tab === 'contact' && (
                <div className="space-y-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#dc2626' }}>Student</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <Field label="Email" value={student.email} field="email" type="email" isEditing={isEditing} draft={draft} onChange={handleDraftChange} />
                      <Field label="Phone" value={student.phone} field="phone" type="tel" isEditing={isEditing} draft={draft} onChange={handleDraftChange} />
                      <Field label="Grade" value={student.grade} field="grade" isEditing={isEditing} draft={draft} onChange={handleDraftChange} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#dc2626' }}>Parent / Guardian</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Field label="Name" value={student.parent_name} field="parent_name" isEditing={isEditing} draft={draft} onChange={handleDraftChange} />
                      <Field label="Email" value={student.parent_email} field="parent_email" type="email" isEditing={isEditing} draft={draft} onChange={handleDraftChange} />
                      <Field label="Phone" value={student.parent_phone} field="parent_phone" type="tel" isEditing={isEditing} draft={draft} onChange={handleDraftChange} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#dc2626' }}>Bluebook</p>
                    {isEditing ? (
                      <input type="url" value={draft.bluebook_url ?? ''} onChange={e => handleDraftChange('bluebook_url', e.target.value)}
                        className={inputCls} placeholder="https://yourorg.sharepoint.com/..." />
                    ) : student.bluebook_url ? (
                      <a href={student.bluebook_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f0fdf4] border border-[#bbf7d0] text-[#15803d] text-xs font-semibold hover:bg-[#dcfce7] transition-all w-fit">
                        <ExternalLink size={12} /> Open Bluebook
                      </a>
                    ) : (
                      <p className="text-xs text-[#c4bfba] italic">No Bluebook linked — click Edit to add</p>
                    )}
                  </div>
                  {isEditing && (
                    <div className="flex justify-end gap-2 pt-1">
                      <button onClick={() => { setIsEditing(false); setDraft(student); }}
                        className="px-4 py-2 text-xs font-bold text-[#78716c] border border-[#e7e3dd] rounded-xl hover:bg-[#f0ece8] transition-all">Cancel</button>
                      <button onClick={handleUpdate} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 text-white rounded-xl text-xs font-black disabled:opacity-50 transition-all"
                        style={{ background: '#dc2626' }}>
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,16,8,0.75)', backdropFilter: 'blur(8px)' }}>
          <BookingForm prefilledSlot={null} onConfirm={handleConfirmBooking} onCancel={() => setShowBooking(false)}
            enrollCat={enrollCat} setEnrollCat={setEnrollCat} allAvailableSeats={allAvailableSeats} studentDatabase={[student]} />
        </div>
      )}
    </>
  );
}

export default function StudentAdminPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [tutors, setTutors] = useState<any[]>([]);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'booked' | 'unbooked'>('all');
  const [newStudent, setNewStudent] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [bookingToast, setBookingToast] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [studentsRes, tutorsRes, sessionsRes] = await Promise.all([
      supabase.from('slake_students').select('*').order('name'),
      supabase.from('slake_tutors').select('*').order('name'),
      supabase.from('slake_sessions')
        .select('id, session_date, tutor_id, time, slake_session_students(id, student_id, name, topic, status)')
        .order('session_date'),
    ]);
    setStudents(studentsRes.data ?? []);
    setTutors(tutorsRes.data ?? []);
    setAllSessions((sessionsRes.data ?? []).map((r: any) => ({
      id: r.id, date: r.session_date, tutorId: r.tutor_id, time: r.time,
      students: (r.slake_session_students ?? []).map((ss: any) => ({
        id: ss.student_id, rowId: ss.id, name: ss.name, topic: ss.topic, status: ss.status,
      })),
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const weekStart = getWeekStart(getCentralTimeNow());
  const weekDates = getWeekDates(weekStart);
  const activeDates = weekDates.filter(d => ACTIVE_DAYS.includes(dayOfWeek(toISODate(d))));
  const today = toISODate(getCentralTimeNow());
  const weekEnd = toISODate(new Date(weekStart.getTime() + 6 * 86400000));

  const allAvailableSeats = useMemo(() => {
    const seats: any[] = [];
    tutors.forEach(tutor => {
      activeDates.forEach(date => {
        const isoDate = toISODate(date);
        const dow = dayOfWeek(isoDate);
        if (!tutor.availability?.includes(dow)) return;
        getSessionsForDay(dow).forEach((block: any) => {
          if (!isTutorAvailable(tutor, dow, block.time)) return;
          const session = allSessions.find(s => s.date === isoDate && s.tutorId === tutor.id && s.time === block.time);
          const count = session ? session.students.length : 0;
          if (count < MAX_CAPACITY) {
            seats.push({
              tutor: { ...tutor, availabilityBlocks: tutor.availability_blocks },
              dayName: DAY_NAMES[ACTIVE_DAYS.indexOf(dow)],
              date: isoDate, time: block.time, block, count,
              seatsLeft: MAX_CAPACITY - count, dayNum: dow,
            });
          }
        });
      });
    });
    return seats.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }, [tutors, allSessions, activeDates]);

  const handleCreate = async () => {
    if (!newStudent.name) return;
    setCreating(true);
    await supabase.from('slake_students').insert([{
      name: newStudent.name, grade: newStudent.grade || null,
      email: newStudent.email || null, phone: newStudent.phone || null,
      parent_name: newStudent.parent_name || null,
      parent_email: newStudent.parent_email || null,
      parent_phone: newStudent.parent_phone || null,
    }]);
    setAdding(false);
    setNewStudent(EMPTY_FORM);
    fetchData();
    setCreating(false);
  };

  const bookedThisWeekIds = useMemo(() => {
    const ids = new Set<string>();
    allSessions.filter(s => s.date >= today && s.date <= weekEnd)
      .forEach(s => s.students.forEach((st: any) => ids.add(st.id)));
    return ids;
  }, [allSessions, today, weekEnd]);

  const filtered = students.filter(s => {
    if (!s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'booked') return bookedThisWeekIds.has(s.id);
    if (filter === 'unbooked') return !bookedThisWeekIds.has(s.id);
    return true;
  });

  return (
    <div className="min-h-screen pb-20" style={{ background: '#f7f4ef', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#e7e3dd]">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#dc2626' }}>
              <GraduationCap size={15} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black text-[#1c1917] leading-none">Students</h1>
              <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: '#dc2626' }}>C2 Education</p>
            </div>
          </div>
          <button onClick={() => setAdding(a => !a)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all active:scale-95"
            style={{ background: adding ? '#6b7280' : '#dc2626' }}>
            {adding ? <X size={13} /> : <Plus size={13} />}
            {adding ? 'Cancel' : 'Add Student'}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 pt-5 space-y-4">
        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total', value: students.length, key: 'all', bg: 'white', color: '#1c1917', border: '#f0ece8' },
              { label: 'Booked', value: students.filter(s => bookedThisWeekIds.has(s.id)).length, key: 'booked', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
              { label: 'Not Booked', value: students.filter(s => !bookedThisWeekIds.has(s.id)).length, key: 'unbooked', bg: '#fff1f2', color: '#dc2626', border: '#fecdd3' },
            ].map(stat => (
              <button key={stat.key} onClick={() => setFilter(f => f === stat.key ? 'all' : stat.key as any)}
                className="p-4 rounded-2xl border-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: stat.bg,
                  borderColor: filter === stat.key ? stat.color : stat.border,
                  boxShadow: filter === stat.key ? `0 0 0 3px ${stat.color}20` : 'none',
                }}>
                <p className="text-2xl font-black leading-none" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider mt-1.5" style={{ color: stat.color, opacity: 0.7 }}>{stat.label}</p>
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a8a29e]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#e7e3dd] rounded-xl text-sm text-black outline-none focus:ring-2 focus:border-[#dc2626] transition-all placeholder:text-[#c4bfba]" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a8a29e]"><X size={13} /></button>}
        </div>

        {/* Add form */}
        {adding && (
          <div className="bg-white rounded-2xl border-2 overflow-hidden shadow-lg" style={{ borderColor: '#dc2626' }}>
            <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ background: '#fff1f2', borderColor: '#fecdd3' }}>
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#dc2626' }}>New Student</p>
              <button onClick={() => setAdding(false)} className="text-[#a8a29e] hover:text-[#1c1917]"><X size={14} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2 md:col-span-1">
                  <label className="text-[9px] font-black text-[#a8a29e] uppercase tracking-widest">Name *</label>
                  <input value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })}
                    className={inputCls} placeholder="Full name" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-[#a8a29e] uppercase tracking-widest">Grade</label>
                  <input value={newStudent.grade} onChange={e => setNewStudent({ ...newStudent, grade: e.target.value })}
                    className={inputCls} placeholder="1–12" />
                </div>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#dc2626' }}>Student Contact <span className="font-medium normal-case text-[#d4cfc9]">(optional)</span></p>
                <div className="grid grid-cols-2 gap-3">
                  {[['Email', 'email', 'email', 'student@email.com'], ['Phone', 'phone', 'tel', '(555) 000-0000']].map(([label, field, type, ph]) => (
                    <div key={field} className="space-y-1">
                      <label className="text-[9px] font-black text-[#a8a29e] uppercase tracking-widest">{label}</label>
                      <input type={type} value={(newStudent as any)[field]} onChange={e => setNewStudent({ ...newStudent, [field]: e.target.value })}
                        className={inputCls} placeholder={ph} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#dc2626' }}>Parent / Guardian <span className="font-medium normal-case text-[#d4cfc9]">(optional)</span></p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[['Name', 'parent_name', 'text', 'Parent name'], ['Email', 'parent_email', 'email', 'parent@email.com'], ['Phone', 'parent_phone', 'tel', '(555) 000-0000']].map(([label, field, type, ph]) => (
                    <div key={field} className="space-y-1">
                      <label className="text-[9px] font-black text-[#a8a29e] uppercase tracking-widest">{label}</label>
                      <input type={type} value={(newStudent as any)[field]} onChange={e => setNewStudent({ ...newStudent, [field]: e.target.value })}
                        className={inputCls} placeholder={ph} />
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={handleCreate} disabled={!newStudent.name || creating}
                className="w-full py-3 rounded-xl text-sm font-black uppercase tracking-widest text-white transition-all active:scale-[0.98] disabled:opacity-40"
                style={{ background: '#dc2626' }}>
                {creating ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Register Student'}
              </button>
            </div>
          </div>
        )}

        {/* Count */}
        {!loading && (
          <p className="text-[10px] font-bold text-[#a8a29e] uppercase tracking-widest px-1">
            {filtered.length} student{filtered.length !== 1 ? 's' : ''}
            {filter !== 'all' && <span className="ml-1" style={{ color: '#dc2626' }}>· {filter}</span>}
            {search && ` matching "${search}"`}
          </p>
        )}

        {/* List */}
        {loading ? (
          <div className="flex flex-col items-center py-24 gap-3">
            <Loader2 size={22} className="animate-spin" style={{ color: '#dc2626' }} />
            <p className="text-xs font-semibold text-[#a8a29e] uppercase tracking-widest">Loading…</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-2">
            {filtered.map(s => (
              <StudentRow key={s.id} student={s} onRefetch={fetchData}
                tutors={tutors} allSessions={allSessions}
                allAvailableSeats={allAvailableSeats}
                onBookingSuccess={(data) => { setBookingToast(data); setTimeout(() => setBookingToast(null), 4000); }}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-[#e7e3dd]">
            <GraduationCap size={28} className="mx-auto mb-3 text-[#d4cfc9]" />
            <p className="text-sm font-bold text-[#a8a29e]">No students found</p>
            {search && <p className="text-xs text-[#c4bfba] mt-1">Try a different search</p>}
          </div>
        )}
      </div>

      {bookingToast && <BookingToast data={bookingToast} onClose={() => setBookingToast(null)} />}
    </div>
  );
}