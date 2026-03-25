"use client"
import { X, UserX, CheckCircle2, CircleOff, Clock, Mail, Phone, ExternalLink, User, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import {
  bookStudent,
  removeStudentFromSession,
  updateAttendance,
  updateConfirmationStatus,
  formatDate,
  dayOfWeek,
  type Tutor,
} from '@/lib/useScheduleData';
import { MAX_CAPACITY } from '@/components/constants';
import { isTutorAvailable } from './scheduleUtils';
import { NotesEditor } from './NotesEditor';

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

  // Read directly from selectedSession — kept fresh by patchSelectedSession
  const currentStatus = student.status;
  const currentConf = student.confirmationStatus ?? null;

  const [contactExpanded, setContactExpanded] = useState(false);

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
    studentRecord?.parent_name || studentRecord?.parent_email || studentRecord?.parent_phone;

  const handleAttendance = async (status: 'scheduled' | 'present' | 'no-show') => {
    patchSelectedSession({ status }); // optimistic — instant visual update
    try {
      await updateAttendance({ sessionId: s.id, studentId: student.id, status });
      refetch();
    } catch (err) {
      patchSelectedSession({ status: currentStatus }); // revert on error
      console.error(err);
    }
  };

  const handleConfirmation = async (status: 'confirmed' | 'unconfirmed' | null) => {
    patchSelectedSession({ confirmationStatus: status }); // optimistic — instant visual update
    try {
      await updateConfirmationStatus({ rowId: student.rowId, status });
      refetch();
    } catch (err) {
      patchSelectedSession({ confirmationStatus: currentConf }); // revert on error
      console.error(err);
    }
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

  const ModalInner = () => (
    <div className="flex flex-col h-full overflow-hidden">

      {/* HEADER */}
      <div className="shrink-0 px-5 pt-5 pb-4 border-b border-stone-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-base font-black text-amber-700 shrink-0">
              {student.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-black text-stone-900 leading-tight truncate">{student.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {student.grade && <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Gr.{student.grade}</span>}
                {student.grade && <span className="text-stone-200">·</span>}
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{student.topic}</span>
              </div>
            </div>
          </div>
          <button onClick={() => setSelectedSession(null)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-400 transition-colors shrink-0 mt-0.5">
            <X size={15} />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-stone-900 text-white uppercase tracking-wider">{s.dayName}</span>
          <span className="text-[11px] text-stone-400 font-medium">{formatDate(s.date)}</span>
          <span className="text-stone-200">·</span>
          <span className="text-[11px] text-stone-500">{s.block?.label ?? sessionTime}</span>
          <span className="text-stone-200">·</span>
          <span className="text-[11px] font-bold text-amber-700">{s.tutorName}</span>
        </div>
      </div>

      {/* TABS */}
      <div className="shrink-0 flex gap-0 px-5 border-b border-stone-100 bg-white">
        {([
          { key: 'session', label: 'Session' },
          { key: 'notes', label: 'Notes' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setModalTab(t.key)}
            className="px-1 mr-5 py-3 text-[11px] font-black uppercase tracking-widest border-b-2 -mb-px transition-colors"
            style={modalTab === t.key
              ? { color: '#b45309', borderColor: '#b45309' }
              : { color: '#a8a29e', borderColor: 'transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* BODY */}
      <div className="overflow-y-auto flex-1">

        {modalTab === 'session' && (
          <div className="p-5 space-y-5">

            {/* CONFIRMATION */}
            <div>
              <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-2.5">Confirmation</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { status: 'confirmed' as const, label: 'Confirmed', icon: <CheckCircle2 size={14} />, active: { bg: '#f0fdf4', border: '#16a34a', text: '#15803d' } },
                  { status: 'unconfirmed' as const, label: 'No Response', icon: <CircleOff size={14} />, active: { bg: '#fef2f2', border: '#dc2626', text: '#b91c1c' } },
                  { status: null, label: 'Pending', icon: <Clock size={14} />, active: { bg: '#f5f5f4', border: '#78716c', text: '#44403c' } },
                ]).map(({ status, label, icon, active }) => {
                  const isActive = currentConf === status;
                  return (
                    <button key={String(status)} onClick={() => handleConfirmation(status)}
                      className="py-3 flex flex-col items-center gap-1.5 rounded-xl border-2 font-black text-[9px] uppercase tracking-wider transition-all active:scale-95"
                      style={isActive ? { background: active.bg, borderColor: active.border, color: active.text } : { background: 'white', borderColor: '#e7e3dd', color: '#a8a29e' }}>
                      {icon}
                      <span className="leading-tight text-center">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ATTENDANCE */}
            <div>
              <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-2.5">Attendance</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { status: 'present' as const, label: 'Present', active: { bg: '#f0fdf4', border: '#16a34a', text: '#15803d' } },
                  { status: 'no-show' as const, label: 'No-show', active: { bg: '#fef2f2', border: '#dc2626', text: '#b91c1c' } },
                  { status: 'scheduled' as const, label: 'Scheduled', active: { bg: '#fffbeb', border: '#f59e0b', text: '#b45309' } },
                ]).map(({ status, label, active }) => {
                  const isActive = currentStatus === status;
                  return (
                    <button key={status} onClick={() => handleAttendance(status)}
                      className="py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 border-2"
                      style={isActive ? { background: active.bg, borderColor: active.border, color: active.text } : { background: 'white', borderColor: '#e7e3dd', color: '#a8a29e' }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CONTACT */}
            {hasContactInfo && (
              <div>
                <button onClick={() => setContactExpanded(prev => !prev)}
                  className="flex items-center justify-between w-full mb-2.5 group">
                  <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Contact Info</p>
                  <span className="text-stone-300 group-hover:text-stone-400 transition-colors">
                    {contactExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </span>
                </button>
                {!contactExpanded && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {studentRecord?.email && (
                      <a href={`mailto:${studentRecord.email}`} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 transition-all">
                        <Mail size={10} className="text-stone-400" />
                        <span className="text-[10px] text-stone-500 max-w-[140px] truncate">{studentRecord.email}</span>
                      </a>
                    )}
                    {studentRecord?.phone && (
                      <a href={`tel:${studentRecord.phone}`} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 transition-all">
                        <Phone size={10} className="text-stone-400" />
                        <span className="text-[10px] text-stone-500">{studentRecord.phone}</span>
                      </a>
                    )}
                    {!studentRecord?.email && !studentRecord?.phone && studentRecord?.parent_email && (
                      <a href={`mailto:${studentRecord.parent_email}`} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 transition-all">
                        <Mail size={10} className="text-stone-400" />
                        <span className="text-[10px] text-stone-500 max-w-[140px] truncate">{studentRecord.parent_email}</span>
                      </a>
                    )}
                  </div>
                )}
                {contactExpanded && (
                  <div className="space-y-3">
                    {studentRecord?.bluebook_url && (
                      <a href={studentRecord.bluebook_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-all">
                        <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-[9px] font-black shrink-0">XL</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-black text-emerald-700">Bluebook</p>
                          <p className="text-[9px] text-emerald-500">Open in SharePoint</p>
                        </div>
                        <ExternalLink size={11} className="text-emerald-400 shrink-0" />
                      </a>
                    )}
                    {(studentRecord?.email || studentRecord?.phone) && (
                      <div>
                        <p className="text-[9px] font-semibold text-stone-300 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><User size={9}/> Student</p>
                        <div className="space-y-1.5">
                          {studentRecord?.email && (
                            <a href={`mailto:${studentRecord.email}`} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-stone-50 hover:bg-stone-100 transition-all">
                              <Mail size={11} className="text-stone-400 shrink-0"/>
                              <span className="text-[11px] text-stone-600 truncate">{studentRecord.email}</span>
                            </a>
                          )}
                          {studentRecord?.phone && (
                            <a href={`tel:${studentRecord.phone}`} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-stone-50 hover:bg-stone-100 transition-all">
                              <Phone size={11} className="text-stone-400 shrink-0"/>
                              <span className="text-[11px] text-stone-600">{studentRecord.phone}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    {(studentRecord?.parent_name || studentRecord?.parent_email || studentRecord?.parent_phone) && (
                      <div>
                        <p className="text-[9px] font-semibold text-stone-300 uppercase tracking-widest mb-1.5">Parent / Guardian</p>
                        <div className="space-y-1.5">
                          {studentRecord?.parent_name && (
                            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-stone-50">
                              <User size={11} className="text-stone-400 shrink-0"/>
                              <span className="text-[11px] text-stone-600">{studentRecord.parent_name}</span>
                            </div>
                          )}
                          {studentRecord?.parent_email && (
                            <a href={`mailto:${studentRecord.parent_email}`} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-stone-50 hover:bg-stone-100 transition-all">
                              <Mail size={11} className="text-stone-400 shrink-0"/>
                              <span className="text-[11px] text-stone-600 truncate">{studentRecord.parent_email}</span>
                            </a>
                          )}
                          {studentRecord?.parent_phone && (
                            <a href={`tel:${studentRecord.parent_phone}`} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-stone-50 hover:bg-stone-100 transition-all">
                              <Phone size={11} className="text-stone-400 shrink-0"/>
                              <span className="text-[11px] text-stone-600">{studentRecord.parent_phone}</span>
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
                <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-2.5">Reassign to</p>
                <div className="space-y-2">
                  {altTutors.map(t => {
                    const altSession = sessions.find(ss => ss.date === s.date && ss.tutorId === t.id && ss.time === sessionTime);
                    const spotsUsed = altSession ? altSession.students.length : 0;
                    return (
                      <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border-2 border-stone-100 hover:border-amber-200 hover:bg-amber-50/40 transition-all">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-xs font-black text-amber-700">{t.name.charAt(0)}</div>
                          <div>
                            <p className="text-xs font-bold text-stone-800">{t.name}</p>
                            <p className="text-[9px] text-stone-400 uppercase tracking-wide">{spotsUsed}/{MAX_CAPACITY} spots</p>
                          </div>
                        </div>
                        <button onClick={() => handleReassign(t)}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-white bg-stone-800 hover:bg-stone-900 transition-all active:scale-95">
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
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-dashed border-red-200 text-red-400 hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-all">
              <UserX size={12} strokeWidth={2} /> Remove from Session
            </button>
          </div>
        )}

        {modalTab === 'notes' && (
          <div className="p-5">
            <NotesEditor rowId={student.rowId} initialNotes={student.notes ?? ''} onSaved={refetch} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50" style={{ background: 'rgba(28,16,8,0.65)', backdropFilter: 'blur(6px)' }}>
      <div className="hidden md:flex items-center justify-center h-full p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-stone-200/60" style={{ maxHeight: 'min(640px, 90vh)' }}>
          <ModalInner />
        </div>
      </div>
      <div className="md:hidden flex flex-col h-full">
        <div className="flex-1" onClick={() => setSelectedSession(null)} />
        <div className="bg-white rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '88vh' }}>
          <div className="flex justify-center pt-2.5 pb-1 shrink-0">
            <div className="w-9 h-1 rounded-full bg-stone-200" />
          </div>
          <ModalInner />
        </div>
      </div>
    </div>
  );
}