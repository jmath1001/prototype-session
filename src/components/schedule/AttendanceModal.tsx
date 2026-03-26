"use client"
import { X, UserX, CheckCircle2, Clock, Mail, Phone, ExternalLink, User, ChevronDown, ChevronUp, FileText, Save, Loader2 } from 'lucide-react';
import { useState, useCallback } from 'react';
import {
  bookStudent,
  removeStudentFromSession,
  updateAttendance,
  updateConfirmationStatus,
  updateSessionNotes,
  formatDate,
  dayOfWeek,
  type Tutor,
} from '@/lib/useScheduleData';
import { MAX_CAPACITY } from '@/components/constants';
import { isTutorAvailable } from './scheduleUtils';

interface AttendanceModalProps {
  selectedSession: any;
  setSelectedSession: (s: any) => void;
  patchSelectedSession: (patch: Record<string, any>) => void;
  modalTab: 'session' | 'notes';
  setModalTab: (t: 'session' | 'notes') => void;
  tutors: Tutor[];
  students: any[];
  sessions: any[];
  refetch: () => void;
}

export function AttendanceModal({
  selectedSession,
  setSelectedSession,
  patchSelectedSession,
  modalTab,
  setModalTab,
  tutors,
  students,
  sessions,
  refetch,
}: AttendanceModalProps) {
  if (!selectedSession) return null;

  const s = selectedSession;
  const student = s.activeStudent;

  const currentStatus = student.status;
  const currentConf = student.confirmationStatus ?? null;

  const [contactExpanded, setContactExpanded] = useState(false);
  const [notesDraft, setNotesDraft] = useState<string>(student.notes ?? '');
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);

  const sessionDow = dayOfWeek(s.date);
  const sessionTime = s.time ?? s.block?.time;
  const originalTutor = tutors.find(t => t.id === s.tutorId);
  const studentRecord = students.find(st => st.id === student.id);

  const altTutors = tutors.filter(t => {
    if (t.id === s.tutorId) return false;
    if (t.cat !== originalTutor?.cat) return false;
    if (!t.availability.includes(sessionDow)) return false;
    if (!isTutorAvailable(t, sessionDow, sessionTime)) return false;
    const altSession = sessions.find(ss => ss.date === s.date && ss.tutorId === t.id && ss.time === sessionTime);
    if (altSession && altSession.students.length >= MAX_CAPACITY) return false;
    return true;
  });

  const hasContactInfo = studentRecord?.email || studentRecord?.phone ||
    studentRecord?.parent_name || studentRecord?.parent_email || studentRecord?.parent_phone ||
    studentRecord?.bluebook_url;

  const handleAttendance = async (status: 'scheduled' | 'present' | 'no-show') => {
    patchSelectedSession({ status });
    try {
      await updateAttendance({ sessionId: s.id, studentId: student.id, status });
      refetch();
    } catch (err) {
      patchSelectedSession({ status: currentStatus });
      console.error(err);
    }
  };

  const handleConfirmation = async (status: 'confirmed' | null) => {
    patchSelectedSession({ confirmationStatus: status });
    try {
      await updateConfirmationStatus({ rowId: student.rowId, status });
      refetch();
    } catch (err) {
      patchSelectedSession({ confirmationStatus: currentConf });
      console.error(err);
    }
  };

  const handleSaveNotes = async () => {
    setNotesSaving(true);
    try {
      await updateSessionNotes({ rowId: student.rowId, notes: notesDraft });
      patchSelectedSession({ notes: notesDraft }); // instant modal update
      refetch();
      setNotesEditing(false);
    } catch (err) {
      console.error(err);
    }
    setNotesSaving(false);
  };

  const handleRemove = async () => {
    try {
      await removeStudentFromSession({ sessionId: s.id, studentId: student.id });
      refetch();
      setSelectedSession(null);
    } catch (err) { console.error(err); }
  };

  const handleReassign = async (newTutor: Tutor) => {
    try {
      await removeStudentFromSession({ sessionId: s.id, studentId: student.id });
      const studentObj = students.find(st => st.id === student.id) ?? {
        id: student.id, name: student.name, subject: student.topic,
        grade: student.grade ?? null, hoursLeft: 0, availabilityBlocks: [],
        email: null, phone: null, parent_name: null, parent_email: null,
        parent_phone: null, bluebook_url: null,
      };
      await bookStudent({ tutorId: newTutor.id, date: s.date, time: sessionTime, student: studentObj, topic: student.topic });
      refetch();
      setSelectedSession(null);
    } catch (err: any) {
      alert(err.message || 'Reassignment failed');
    }
  };

  // Confirmation: just confirmed vs not confirmed
  const isConfirmed = currentConf === 'confirmed';

  const ModalInner = () => (
    <div className="flex flex-col h-full overflow-hidden bg-white">

      {/* ── HEADER ── */}
      <div className="shrink-0 px-6 pt-5 pb-4" style={{ background: '#1c1917' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-black shrink-0"
              style={{ background: '#dc2626', color: 'white' }}>
              {student.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-base font-black text-white leading-tight truncate">{student.name}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {student.grade && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}>
                    Gr.{student.grade}
                  </span>
                )}
                <span className="text-[11px] font-semibold" style={{ color: '#dc2626' }}>{student.topic}</span>
              </div>
            </div>
          </div>
          <button onClick={() => setSelectedSession(null)}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors shrink-0 mt-0.5"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#a8a29e' }}>
            <X size={14} />
          </button>
        </div>

        {/* Session strip */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider"
            style={{ background: '#dc2626', color: 'white' }}>{s.dayName}</span>
          <span className="text-[11px] font-medium" style={{ color: '#a8a29e' }}>{formatDate(s.date)}</span>
          <span style={{ color: '#44403c' }}>·</span>
          <span className="text-[11px]" style={{ color: '#78716c' }}>{s.block?.label ?? sessionTime}</span>
          <span style={{ color: '#44403c' }}>·</span>
          <span className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>{s.tutorName}</span>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="shrink-0 flex border-b px-6" style={{ borderColor: '#f0ece8', background: 'white' }}>
        {([
          { key: 'session', label: 'Session' },
          { key: 'notes', label: 'Notes' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setModalTab(t.key)}
            className="mr-6 py-3 text-[11px] font-black uppercase tracking-widest border-b-2 -mb-px transition-colors"
            style={modalTab === t.key
              ? { color: '#dc2626', borderColor: '#dc2626' }
              : { color: '#a8a29e', borderColor: 'transparent' }}>
            {t.label}
            {t.key === 'notes' && student.notes && (
              <span className="ml-1.5 w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#dc2626' }} />
            )}
          </button>
        ))}
      </div>

      {/* ── BODY ── */}
      <div className="overflow-y-auto flex-1" style={{ background: '#fafafa' }}>

        {/* SESSION TAB */}
        {modalTab === 'session' && (
          <div className="p-6 space-y-6">

            {/* CONFIRMATION — two big toggle buttons */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color: '#a8a29e' }}>Confirmation</p>
              <div className="grid grid-cols-2 gap-2.5">
                {([
                  {
                    status: 'confirmed' as const,
                    label: 'Confirmed',
                    icon: <CheckCircle2 size={16} />,
                    active: { bg: '#f0fdf4', border: '#16a34a', text: '#15803d' },
                  },
                  {
                    status: null,
                    label: 'Not Yet',
                    icon: <Clock size={16} />,
                    active: { bg: '#fff1f2', border: '#dc2626', text: '#991b1b' },
                  },
                ]).map(({ status, label, icon, active }) => {
                  const isActive = currentConf === status;
                  return (
                    <button key={String(status)} onClick={() => handleConfirmation(status)}
                      className="py-3.5 flex flex-col items-center gap-2 rounded-xl border-2 font-black text-[10px] uppercase tracking-wider transition-all active:scale-[0.97]"
                      style={isActive
                        ? { background: active.bg, borderColor: active.border, color: active.text }
                        : { background: 'white', borderColor: '#e7e3dd', color: '#c4bfba' }}>
                      {icon}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ATTENDANCE — three buttons */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color: '#a8a29e' }}>Attendance</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { status: 'present' as const, label: 'Present', active: { bg: '#f0fdf4', border: '#16a34a', text: '#15803d' } },
                  { status: 'no-show' as const, label: 'No-show', active: { bg: '#fef2f2', border: '#dc2626', text: '#b91c1c' } },
                  { status: 'scheduled' as const, label: 'Scheduled', active: { bg: '#fff1f2', border: '#dc2626', text: '#991b1b' } },
                ]).map(({ status, label, active }) => {
                  const isActive = currentStatus === status;
                  return (
                    <button key={status} onClick={() => handleAttendance(status)}
                      className="py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-[0.97] border-2"
                      style={isActive
                        ? { background: active.bg, borderColor: active.border, color: active.text }
                        : { background: 'white', borderColor: '#e7e3dd', color: '#c4bfba' }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CONTACT — collapsible, full width */}
            {hasContactInfo && (
              <div className="rounded-xl overflow-hidden border-2" style={{ borderColor: '#f0ece8' }}>
                <button onClick={() => setContactExpanded(prev => !prev)}
                  className="flex items-center justify-between w-full px-4 py-3 transition-colors"
                  style={{ background: contactExpanded ? '#f5f5f4' : 'white' }}>
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#78716c' }}>Contact Info</p>
                  <span style={{ color: '#a8a29e' }}>
                    {contactExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </span>
                </button>

                {/* Collapsed preview */}
                {!contactExpanded && (
                  <div className="px-4 pb-3 pt-1 flex items-center gap-2 flex-wrap bg-white">
                    {studentRecord?.email && (
                      <a href={`mailto:${studentRecord.email}`}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-[10px] font-medium"
                        style={{ background: '#f7f4ef', color: '#78716c' }}>
                        <Mail size={10} />
                        <span className="max-w-[150px] truncate">{studentRecord.email}</span>
                      </a>
                    )}
                    {studentRecord?.phone && (
                      <a href={`tel:${studentRecord.phone}`}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-[10px] font-medium"
                        style={{ background: '#f7f4ef', color: '#78716c' }}>
                        <Phone size={10} />
                        {studentRecord.phone}
                      </a>
                    )}
                    {!studentRecord?.email && !studentRecord?.phone && studentRecord?.parent_email && (
                      <a href={`mailto:${studentRecord.parent_email}`}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-[10px] font-medium"
                        style={{ background: '#f7f4ef', color: '#78716c' }}>
                        <Mail size={10} />
                        <span className="max-w-[150px] truncate">{studentRecord.parent_email}</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Expanded */}
                {contactExpanded && (
                  <div className="px-4 pb-4 pt-2 space-y-4 bg-white">
                    {/* Bluebook — full width */}
                    {studentRecord?.bluebook_url && (
                      <a href={studentRecord.bluebook_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-all"
                        style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[9px] font-black shrink-0"
                          style={{ background: '#16a34a' }}>XL</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-black" style={{ color: '#15803d' }}>Bluebook</p>
                          <p className="text-[10px]" style={{ color: '#16a34a' }}>Open in SharePoint →</p>
                        </div>
                        <ExternalLink size={12} style={{ color: '#16a34a' }} className="shrink-0" />
                      </a>
                    )}

                    {(studentRecord?.email || studentRecord?.phone) && (
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: '#a8a29e' }}>
                          <User size={9} /> Student
                        </p>
                        <div className="space-y-1.5">
                          {studentRecord?.email && (
                            <a href={`mailto:${studentRecord.email}`}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full transition-all"
                              style={{ background: '#f7f4ef' }}>
                              <Mail size={12} style={{ color: '#a8a29e' }} className="shrink-0" />
                              <span className="text-[12px] truncate" style={{ color: '#1c1917' }}>{studentRecord.email}</span>
                            </a>
                          )}
                          {studentRecord?.phone && (
                            <a href={`tel:${studentRecord.phone}`}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full transition-all"
                              style={{ background: '#f7f4ef' }}>
                              <Phone size={12} style={{ color: '#a8a29e' }} className="shrink-0" />
                              <span className="text-[12px]" style={{ color: '#1c1917' }}>{studentRecord.phone}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {(studentRecord?.parent_name || studentRecord?.parent_email || studentRecord?.parent_phone) && (
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#a8a29e' }}>
                          Parent / Guardian
                        </p>
                        <div className="space-y-1.5">
                          {studentRecord?.parent_name && (
                            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: '#f7f4ef' }}>
                              <User size={12} style={{ color: '#a8a29e' }} className="shrink-0" />
                              <span className="text-[12px]" style={{ color: '#1c1917' }}>{studentRecord.parent_name}</span>
                            </div>
                          )}
                          {studentRecord?.parent_email && (
                            <a href={`mailto:${studentRecord.parent_email}`}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full transition-all"
                              style={{ background: '#f7f4ef' }}>
                              <Mail size={12} style={{ color: '#a8a29e' }} className="shrink-0" />
                              <span className="text-[12px] truncate" style={{ color: '#1c1917' }}>{studentRecord.parent_email}</span>
                            </a>
                          )}
                          {studentRecord?.parent_phone && (
                            <a href={`tel:${studentRecord.parent_phone}`}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full transition-all"
                              style={{ background: '#f7f4ef' }}>
                              <Phone size={12} style={{ color: '#a8a29e' }} className="shrink-0" />
                              <span className="text-[12px]" style={{ color: '#1c1917' }}>{studentRecord.parent_phone}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* REASSIGN */}
            {altTutors.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color: '#a8a29e' }}>Reassign to</p>
                <div className="space-y-2">
                  {altTutors.map(t => {
                    const altSession = sessions.find(ss => ss.date === s.date && ss.tutorId === t.id && ss.time === sessionTime);
                    const spotsUsed = altSession ? altSession.students.length : 0;
                    return (
                      <div key={t.id}
                        className="flex items-center justify-between p-3 rounded-xl border-2 transition-all"
                        style={{ borderColor: '#f0ece8', background: 'white' }}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
                            style={{ background: '#fff1f2', color: '#dc2626' }}>
                            {t.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-bold" style={{ color: '#1c1917' }}>{t.name}</p>
                            <p className="text-[9px] uppercase tracking-wide" style={{ color: '#a8a29e' }}>{spotsUsed}/{MAX_CAPACITY} spots</p>
                          </div>
                        </div>
                        <button onClick={() => handleReassign(t)}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-white transition-all active:scale-95"
                          style={{ background: '#1c1917' }}>
                          Move
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* REMOVE */}
            <button onClick={handleRemove}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-dashed transition-all"
              style={{ borderColor: '#fca5a5', color: '#ef4444' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff1f2'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
              <UserX size={12} strokeWidth={2} /> Remove from Session
            </button>
          </div>
        )}

        {/* NOTES TAB — inline edit/save, no external component */}
        {modalTab === 'notes' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#a8a29e' }}>Session Notes</p>
              <div className="flex items-center gap-2">
                {notesEditing ? (
                  <>
                    <button onClick={() => { setNotesDraft(student.notes ?? ''); setNotesEditing(false); }}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                      style={{ color: '#78716c', background: '#f5f5f4' }}>
                      Cancel
                    </button>
                    <button onClick={handleSaveNotes} disabled={notesSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
                      style={{ background: '#1c1917' }}>
                      {notesSaving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                      Save
                    </button>
                  </>
                ) : (
                  <button onClick={() => setNotesEditing(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                    style={{ color: '#dc2626', background: '#fff1f2' }}>
                    <FileText size={10} /> Edit
                  </button>
                )}
              </div>
            </div>

            {notesEditing ? (
              <textarea
                value={notesDraft}
                onChange={e => setNotesDraft(e.target.value)}
                placeholder="Add notes about this session..."
                autoFocus
                className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none border-2 transition-all"
                style={{
                  minHeight: 180,
                  background: 'white',
                  borderColor: '#dc2626',
                  color: '#1c1917',
                  fontFamily: 'inherit',
                }}
              />
            ) : (
              <div
                className="w-full rounded-xl px-4 py-3 min-h-[120px] cursor-pointer transition-all"
                style={{ background: 'white', border: '2px solid #f0ece8' }}
                onClick={() => setNotesEditing(true)}>
                {student.notes ? (
                  <p className="text-sm whitespace-pre-wrap" style={{ color: '#1c1917' }}>{student.notes}</p>
                ) : (
                  <p className="text-sm italic" style={{ color: '#c4bfba' }}>No notes yet — click to add</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50" style={{ background: 'rgba(14,10,6,0.72)', backdropFilter: 'blur(6px)' }}>
      {/* Desktop — wider modal */}
      <div className="hidden md:flex items-center justify-center h-full p-6">
        <div className="w-full bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          style={{ maxWidth: 480, maxHeight: 'min(680px, 92vh)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <ModalInner />
        </div>
      </div>
      {/* Mobile — taller bottom sheet */}
      <div className="md:hidden flex flex-col h-full">
        <div className="flex-1" onClick={() => setSelectedSession(null)} />
        <div className="bg-white rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '92vh' }}>
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full" style={{ background: '#e7e3dd' }} />
          </div>
          <ModalInner />
        </div>
      </div>
    </div>
  );
}