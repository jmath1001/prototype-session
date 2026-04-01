"use client"
import { X, UserX, CheckCircle2, Clock, Mail, Phone, ExternalLink, User, FileText, Save, Loader2, AlertCircle, Copy, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
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

interface ModalContentProps extends AttendanceModalProps {
  s: any;
  student: any;
  studentRecord: any;
  altTutors: Tutor[];
  hasContactInfo: boolean;
  sessionTime: string;
}

function ModalContent({
  s, student, studentRecord, altTutors, hasContactInfo, sessionTime,
  selectedSession, setSelectedSession, patchSelectedSession,
  modalTab, setModalTab, tutors, students, sessions, refetch,
}: ModalContentProps) {
  const currentStatus = student.status;
  const currentConf = student.confirmationStatus ?? null;

  const [notesEditing, setNotesEditing] = useState(false);
  const [notesDraft, setNotesDraft] = useState<string>(student.notes ?? '');
  const [notesSaving, setNotesSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmReassignId, setConfirmReassignId] = useState<string | null>(null);

  useEffect(() => {
    if (!notesEditing) setNotesDraft(student.notes ?? '');
  }, [student.notes, notesEditing]);

  const handleAttendance = async (status: 'scheduled' | 'present' | 'no-show') => {
    patchSelectedSession({ status });
    try { await updateAttendance({ sessionId: s.id, studentId: student.id, status }); refetch(); }
    catch (err) { patchSelectedSession({ status: currentStatus }); console.error(err); }
  };

  const handleConfirmation = async (status: 'confirmed' | null) => {
    patchSelectedSession({ confirmationStatus: status });
    try { await updateConfirmationStatus({ rowId: student.rowId, status }); refetch(); }
    catch (err) { patchSelectedSession({ confirmationStatus: currentConf }); console.error(err); }
  };

  const handleSaveNotes = async () => {
    setNotesSaving(true);
    try {
      await updateSessionNotes({ rowId: student.rowId, notes: notesDraft });
      patchSelectedSession({ notes: notesDraft });
      refetch(); setNotesEditing(false);
    } catch (err) { console.error(err); }
    setNotesSaving(false);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleRemove = async () => {
    try { await removeStudentFromSession({ sessionId: s.id, studentId: student.id }); refetch(); setSelectedSession(null); }
    catch (err) { console.error(err); }
  };

  const handleReassign = async (newTutor: Tutor) => {
    if (confirmReassignId !== newTutor.id) {
      setConfirmReassignId(newTutor.id);
      return;
    }
    try {
      await removeStudentFromSession({ sessionId: s.id, studentId: student.id });
      const studentObj = students.find(st => st.id === student.id) ?? {
        id: student.id, name: student.name, subject: student.topic, grade: student.grade ?? null,
        hoursLeft: 0, availabilityBlocks: [], email: null, phone: null,
        parent_name: null, parent_email: null, parent_phone: null, bluebook_url: null,
      };
      await bookStudent({ tutorId: newTutor.id, date: s.date, time: sessionTime, student: studentObj, topic: student.topic });
      refetch(); setSelectedSession(null);
    } catch (err: any) { alert(err.message || 'Reassignment failed'); }
  };

  const initials = student.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const blockLabel = s.block?.label ?? sessionTime;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div className="shrink-0 px-5 pt-5 pb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Avatar */}
          <div className="shrink-0 relative">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-black text-white select-none"
              style={{ background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' }}>
              {initials}
            </div>
            {/* Status dot */}
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
              currentStatus === 'present' ? 'bg-[#16a34a]' :
              currentStatus === 'no-show' ? 'bg-[#dc2626]' : 'bg-[#94a3b8]'
            }`} />
          </div>

          <div className="min-w-0">
            <h2 className="text-[15px] font-black text-[#0f172a] leading-tight tracking-tight truncate">
              {student.name}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-black text-[#dc2626] uppercase tracking-wide">{student.topic}</span>
              {student.grade && (
                <>
                  <span className="text-[#e2e8f0]">·</span>
                  <span className="text-[10px] font-semibold text-[#94a3b8]">Grade {student.grade}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <button onClick={() => setSelectedSession(null)}
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-[#f1f5f9]"
          style={{ color: '#94a3b8' }}>
          <X size={14} />
        </button>
      </div>

      {/* ══ SESSION PILL BAR ════════════════════════════════════════════════ */}
      <div className="shrink-0 mx-5 mb-4 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#f8fafc' }}>
        <span className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider text-white"
          style={{ background: '#0f172a' }}>{s.dayName}</span>
        <span className="text-[11px] text-[#475569] font-semibold">{formatDate(s.date)}</span>
        <span className="text-[#e2e8f0]">·</span>
        <span className="text-[11px] text-[#475569] font-semibold">{blockLabel}</span>
        <span className="text-[#e2e8f0]">·</span>
        <span className="text-[11px] font-black text-[#dc2626]">{s.tutorName}</span>
      </div>

      {/* ══ TABS ════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 flex px-5 gap-0" style={{ borderBottom: '1px solid #f1f5f9' }}>
        {(['session', 'notes'] as const).map(tab => (
          <button key={tab} onClick={() => setModalTab(tab)}
            className="py-2.5 mr-6 text-[10px] font-black uppercase tracking-widest border-b-2 -mb-px flex items-center gap-1.5 transition-colors"
            style={modalTab === tab
              ? { color: '#0f172a', borderColor: '#dc2626' }
              : { color: '#94a3b8', borderColor: 'transparent' }}>
            {tab === 'notes' ? 'Notes' : 'Session'}
            {tab === 'notes' && student.notes && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#dc2626]" />
            )}
          </button>
        ))}
      </div>

      {/* ══ BODY ════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto">
        {modalTab === 'session' && (
          <div className="px-5 py-4 space-y-5">

            {/* ── ATTENDANCE & CONFIRMATION ── */}
            <div>
              <p className="text-[9px] font-black text-[#94a3b8] uppercase tracking-widest mb-2.5">Attendance</p>

              {/* Confirmation row */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                {([
                  { val: 'confirmed' as const, label: 'Confirmed',   icon: <CheckCircle2 size={11}/> },
                  { val: null,                 label: 'Unconfirmed', icon: <Clock size={11}/> },
                ]).map(({ val, label, icon }) => {
                  const active = currentConf === val;
                  return (
                    <button key={String(val)} onClick={() => handleConfirmation(val)}
                      className="py-2 rounded-lg text-[10px] font-black uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all"
                      style={active
                        ? val === 'confirmed'
                          ? { background: '#f0fdf4', color: '#15803d', boxShadow: 'inset 0 0 0 1.5px #16a34a' }
                          : { background: '#fef2f2', color: '#b91c1c', boxShadow: 'inset 0 0 0 1.5px #dc2626' }
                        : { background: '#f8fafc', color: '#94a3b8', boxShadow: 'inset 0 0 0 1px #e2e8f0' }}>
                      {icon} {label}
                    </button>
                  );
                })}
              </div>

              {/* Attendance row */}
              <div className="grid grid-cols-3 gap-2">
                {([
                  { val: 'present'  as const, label: 'Present',   active: '#f0fdf4', activeText: '#15803d', activeBorder: '#16a34a' },
                  { val: 'no-show'  as const, label: 'No-show',   active: '#fef2f2', activeText: '#b91c1c', activeBorder: '#dc2626' },
                  { val: 'scheduled'as const, label: 'Scheduled', active: '#f8fafc', activeText: '#1e293b', activeBorder: '#475569' },
                ]).map(({ val, label, active, activeText, activeBorder }) => (
                  <button key={val} onClick={() => handleAttendance(val)}
                    className="py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all"
                    style={currentStatus === val
                      ? { background: active, color: activeText, boxShadow: `inset 0 0 0 1.5px ${activeBorder}` }
                      : { background: '#f8fafc', color: '#94a3b8', boxShadow: 'inset 0 0 0 1px #e2e8f0' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── DIVIDER ── */}
            <div style={{ height: 1, background: '#f1f5f9' }} />

            {/* ── BLUEBOOK ── */}
            <div>
              <p className="text-[9px] font-black text-[#94a3b8] uppercase tracking-widest mb-2.5">Bluebook</p>
              {studentRecord?.bluebook_url ? (
                <div className="flex gap-2">
                  <a href={studentRecord.bluebook_url} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all group"
                    style={{ background: '#f0fdf4', boxShadow: 'inset 0 0 0 1px #bbf7d0' }}>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-black shrink-0"
                      style={{ background: '#16a34a' }}>BB</div>
                    <span className="text-[11px] font-black text-[#15803d] flex-1">Open Bluebook</span>
                    <ExternalLink size={11} className="text-[#16a34a] opacity-60 group-hover:opacity-100 transition-opacity" />
                  </a>
                  <button onClick={() => copyToClipboard(studentRecord.bluebook_url, 'bb')}
                    className="w-10 flex items-center justify-center rounded-lg transition-all"
                    style={{ background: '#f8fafc', boxShadow: 'inset 0 0 0 1px #e2e8f0' }}>
                    {copiedKey === 'bb'
                      ? <Check size={13} className="text-[#16a34a]" />
                      : <Copy size={13} style={{ color: '#94a3b8' }} />}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                  style={{ background: '#fef2f2', boxShadow: 'inset 0 0 0 1px #fecaca' }}>
                  <AlertCircle size={13} className="text-[#dc2626] shrink-0" />
                  <span className="text-[11px] font-black text-[#b91c1c]">No bluebook link on file</span>
                </div>
              )}
            </div>

            {/* ── DIVIDER ── */}
            <div style={{ height: 1, background: '#f1f5f9' }} />

            {/* ── CONTACT ── */}
            <div>
              <p className="text-[9px] font-black text-[#94a3b8] uppercase tracking-widest mb-2.5">Contact</p>
              <div className="grid grid-cols-2 gap-3">
                {/* Student */}
                <div className="space-y-1.5">
                  <p className="text-[9px] font-black text-[#1e293b] uppercase tracking-wide flex items-center gap-1 mb-1.5">
                    <User size={9} /> Student
                  </p>
                  {studentRecord?.email && (
                    <ContactRow
                      href={`mailto:${studentRecord.email}`}
                      icon={<Mail size={10} />}
                      label={studentRecord.email}
                      copyKey="se"
                      value={studentRecord.email}
                      copiedKey={copiedKey}
                      onCopy={copyToClipboard}
                    />
                  )}
                  {studentRecord?.phone && (
                    <ContactRow
                      href={`tel:${studentRecord.phone}`}
                      icon={<Phone size={10} />}
                      label={studentRecord.phone}
                      copyKey="sp"
                      value={studentRecord.phone}
                      copiedKey={copiedKey}
                      onCopy={copyToClipboard}
                    />
                  )}
                  {!studentRecord?.email && !studentRecord?.phone && (
                    <p className="text-[10px] text-[#cbd5e1] font-semibold">—</p>
                  )}
                </div>

                {/* Parent */}
                <div className="space-y-1.5">
                  <p className="text-[9px] font-black text-[#1e293b] uppercase tracking-wide flex items-center gap-1 mb-1.5">
                    <User size={9} /> Parent
                  </p>
                  {studentRecord?.parent_name && (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md"
                      style={{ background: '#f8fafc' }}>
                      <span className="text-[10px] font-black text-[#0f172a] truncate">{studentRecord.parent_name}</span>
                    </div>
                  )}
                  {studentRecord?.parent_email && (
                    <ContactRow
                      href={`mailto:${studentRecord.parent_email}`}
                      icon={<Mail size={10} />}
                      label={studentRecord.parent_email}
                      copyKey="pe"
                      value={studentRecord.parent_email}
                      copiedKey={copiedKey}
                      onCopy={copyToClipboard}
                    />
                  )}
                  {studentRecord?.parent_phone && (
                    <ContactRow
                      href={`tel:${studentRecord.parent_phone}`}
                      icon={<Phone size={10} />}
                      label={studentRecord.parent_phone}
                      copyKey="pp"
                      value={studentRecord.parent_phone}
                      copiedKey={copiedKey}
                      onCopy={copyToClipboard}
                    />
                  )}
                  {!studentRecord?.parent_email && !studentRecord?.parent_phone && !studentRecord?.parent_name && (
                    <p className="text-[10px] text-[#cbd5e1] font-semibold">—</p>
                  )}
                </div>
              </div>
            </div>

            {/* ── REASSIGN ── */}
            {altTutors.length > 0 && (
              <>
                <div style={{ height: 1, background: '#f1f5f9' }} />
                <div>
                  <p className="text-[9px] font-black text-[#94a3b8] uppercase tracking-widest mb-2.5">Quick Reassign</p>
                  <div className="grid grid-cols-3 gap-2">
                    {altTutors.map(t => {
                      const alt = sessions.find(ss => ss.date === s.date && ss.tutorId === t.id && ss.time === sessionTime);
                      const used = alt ? alt.students.length : 0;
                      const isConfirming = confirmReassignId === t.id;
                      return (
                        <button key={t.id}
                          onClick={() => handleReassign(t)}
                          onMouseLeave={() => setConfirmReassignId(null)}
                          className="p-2.5 rounded-lg text-left flex flex-col justify-center min-h-[46px] transition-all"
                          style={isConfirming
                            ? { background: '#fef2f2', boxShadow: 'inset 0 0 0 1.5px #dc2626' }
                            : { background: '#f8fafc', boxShadow: 'inset 0 0 0 1px #e2e8f0' }}>
                          {isConfirming ? (
                            <p className="text-[9px] font-black text-[#dc2626] uppercase leading-tight">Confirm?</p>
                          ) : (
                            <>
                              <p className="text-[11px] font-black text-[#0f172a] truncate">{t.name.split(' ')[0]}</p>
                              <p className="text-[9px] font-semibold text-[#94a3b8] mt-0.5">{used}/{MAX_CAPACITY}</p>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ── DIVIDER ── */}
            <div style={{ height: 1, background: '#f1f5f9' }} />

            {/* ── REMOVE ── */}
            <button onClick={handleRemove}
              className="w-full py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              style={{ color: '#dc2626', boxShadow: 'inset 0 0 0 1px #fecaca', background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <UserX size={12} /> Remove Student
            </button>

            <div className="h-1" />
          </div>
        )}

        {/* ── NOTES TAB ── */}
        {modalTab === 'notes' && (
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-black text-[#94a3b8] uppercase tracking-widest">Session Notes</p>
              {notesEditing ? (
                <button onClick={handleSaveNotes} disabled={notesSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black text-white transition-all"
                  style={{ background: '#0f172a' }}>
                  {notesSaving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Save
                </button>
              ) : (
                <button onClick={() => setNotesEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all"
                  style={{ color: '#dc2626', background: '#fef2f2', boxShadow: 'inset 0 0 0 1px #fecaca' }}>
                  <FileText size={10} /> Edit
                </button>
              )}
            </div>
            <textarea
              value={notesDraft}
              onChange={e => setNotesDraft(e.target.value)}
              disabled={!notesEditing}
              className="w-full p-4 text-[13px] font-medium rounded-xl outline-none transition-all min-h-[240px] resize-none leading-relaxed"
              placeholder="Type session details..."
              style={notesEditing
                ? { background: 'white', color: '#0f172a', boxShadow: 'inset 0 0 0 1.5px #dc2626' }
                : { background: '#f8fafc', color: '#0f172a', cursor: 'default', boxShadow: 'inset 0 0 0 1px #f1f5f9' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Small helper for contact rows ── */
function ContactRow({ href, icon, label, copyKey, value, copiedKey, onCopy }: {
  href: string; icon: React.ReactNode; label: string;
  copyKey: string; value: string; copiedKey: string | null;
  onCopy: (v: string, k: string) => void;
}) {
  return (
    <div className="flex gap-1 items-center">
      <a href={href}
        className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md min-w-0 transition-colors"
        style={{ background: '#f8fafc', boxShadow: 'inset 0 0 0 1px #e2e8f0' }}>
        <span style={{ color: '#94a3b8', flexShrink: 0 }}>{icon}</span>
        <span className="text-[10px] font-semibold text-[#0f172a] truncate">{label}</span>
      </a>
      <button onClick={() => onCopy(value, copyKey)}
        className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
        style={{ color: '#cbd5e1' }}>
        {copiedKey === copyKey ? <Check size={11} className="text-[#16a34a]" /> : <Copy size={11} />}
      </button>
    </div>
  );
}

export function AttendanceModal(props: AttendanceModalProps) {
  const { selectedSession, setSelectedSession } = props;
  if (!selectedSession) return null;

  const s = selectedSession;
  const student = s.activeStudent;
  const sessionTime = s.time ?? s.block?.time;
  const sessionDow = dayOfWeek(s.date);
  const originalTutor = props.tutors.find(t => t.id === s.tutorId);
  const studentRecord = props.students.find(st => st.id === student.id);

  const altTutors = props.tutors.filter(t => {
    if (t.id === s.tutorId) return false;
    if (t.cat !== originalTutor?.cat) return false;
    if (!t.availability.includes(sessionDow)) return false;
    if (!isTutorAvailable(t, sessionDow, sessionTime)) return false;
    const alt = props.sessions.find(ss => ss.date === s.date && ss.tutorId === t.id && ss.time === sessionTime);
    if (alt && alt.students.length >= MAX_CAPACITY) return false;
    return true;
  });

  const contentProps: ModalContentProps = {
    ...props, s, student, studentRecord, altTutors, hasContactInfo: true, sessionTime,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxWidth: 560, maxHeight: '90vh', boxShadow: '0 25px 60px -10px rgba(0,0,0,0.25), 0 0 0 1px #f1f5f9' }}>
        <ModalContent {...contentProps} />
      </div>
    </div>
  );
}