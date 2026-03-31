"use client"
import { X, UserX, CheckCircle2, Clock, Mail, Phone, ExternalLink, User, FileText, Save, Loader2, AlertCircle, Copy, Check, ArrowRightLeft } from 'lucide-react';
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
  
  // Reassign Confirmation State
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

  const statusConfig = {
    present:   { label: 'Present',   bg: '#f0fdf4', border: '#16a34a', text: '#15803d' },
    'no-show': { label: 'No-show',   bg: '#fef2f2', border: '#dc2626', text: '#b91c1c' },
    scheduled: { label: 'Scheduled', bg: '#f8fafc', border: '#475569', text: '#1e293b' },
  } as const;

  const confConfig = {
    confirmed: { bg: '#f0fdf4', border: '#16a34a', text: '#15803d' },
    null:      { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div className="shrink-0 px-4 py-3 flex items-start justify-between gap-4"
        style={{ borderBottom: '1px solid #e2e8f0' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white"
            style={{ background: '#dc2626' }}>
            {initials}
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-black text-[#0f172a] leading-tight tracking-tight truncate">
              {student.name}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-black text-[#1e293b] uppercase tracking-tight">{student.topic}</span>
              {student.grade && (
                <>
                  <span className="text-[#cbd5e1]">·</span>
                  <span className="text-[10px] font-bold text-[#475569]">Grade {student.grade}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button onClick={() => setSelectedSession(null)}
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
          style={{ background: '#f1f5f9', color: '#1e293b' }}>
          <X size={14} />
        </button>
      </div>

      <div className="shrink-0 px-4 py-2 flex items-center gap-2 flex-wrap"
        style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider text-white"
          style={{ background: '#1e293b' }}>{s.dayName}</span>
        <span className="text-[11px] text-[#0f172a] font-bold">{formatDate(s.date)}</span>
        <span className="text-[#cbd5e1]">·</span>
        <span className="text-[11px] text-[#0f172a] font-bold">{blockLabel}</span>
        <span className="text-[#cbd5e1]">·</span>
        <span className="text-[11px] font-black text-[#dc2626]">{s.tutorName}</span>
      </div>

      <div className="shrink-0 flex px-4" style={{ borderBottom: '1px solid #e2e8f0' }}>
        {(['session', 'notes'] as const).map(tab => (
          <button key={tab} onClick={() => setModalTab(tab)}
            className="py-2.5 mr-5 text-[10px] font-black uppercase tracking-widest border-b-2 -mb-px flex items-center gap-1.5 transition-colors"
            style={modalTab === tab
              ? { color: '#dc2626', borderColor: '#dc2626' }
              : { color: '#475569', borderColor: 'transparent' }}>
            {tab === 'notes' ? 'Notes' : 'Session'}
            {tab === 'notes' && student.notes && (
              <span className="w-1 h-1 rounded-full bg-[#dc2626]" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {modalTab === 'session' && (
          <div className="p-4 space-y-5">
            
            {/* ── STATUS SECTION ── */}
            <div>
              <p className="text-[9px] font-black text-[#1e293b] uppercase tracking-widest mb-1.5">Attendance & Confirmation</p>
              <div className="flex gap-2 mb-1.5">
                {([
                  { val: 'confirmed' as const, label: 'Confirmed', ...confConfig.confirmed },
                  { val: null,                 label: 'Unconfirmed',   ...confConfig.null },
                ]).map(({ val, label, bg, border, text }) => {
                  const active = currentConf === val;
                  return (
                    <button key={String(val)} onClick={() => handleConfirmation(val)}
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border-2 flex items-center justify-center gap-1.5 transition-all"
                      style={active
                        ? { background: bg, borderColor: border, color: text }
                        : { background: 'white', borderColor: '#cbd5e1', color: '#475569' }}>
                      {val === 'confirmed' ? <CheckCircle2 size={12}/> : <Clock size={12}/>}
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-1.5">
                {(['present', 'no-show', 'scheduled'] as const).map(status => {
                  const cfg = statusConfig[status];
                  const active = currentStatus === status;
                  return (
                    <button key={status} onClick={() => handleAttendance(status)}
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border-2 transition-all"
                      style={active
                        ? { background: cfg.bg, borderColor: cfg.border, color: cfg.text }
                        : { background: 'white', borderColor: '#cbd5e1', color: '#475569' }}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── BLUEBOOK SECTION ── */}
            <div>
              <p className="text-[9px] font-black text-[#1e293b] uppercase tracking-widest mb-1.5">Student Bluebook</p>
              {studentRecord?.bluebook_url ? (
                <div className="flex gap-1.5">
                  <a href={studentRecord.bluebook_url} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all border-2 border-[#16a34a] bg-[#f0fdf4] hover:bg-[#dcfce7]">
                    <div className="w-6 h-6 rounded bg-[#16a34a] flex items-center justify-center text-white text-[9px] font-black shrink-0">BB</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black text-[#15803d]">Open Bluebook</p>
                    </div>
                    <ExternalLink size={12} className="text-[#16a34a] shrink-0"/>
                  </a>
                  <button onClick={() => copyToClipboard(studentRecord.bluebook_url, 'bb')}
                    className="w-10 flex items-center justify-center rounded-lg border-2 border-[#cbd5e1] bg-white hover:bg-[#f8fafc] transition-all">
                    {copiedKey === 'bb' ? <Check size={14} className="text-[#16a34a]"/> : <Copy size={14} className="text-[#1e293b]"/>}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-[#dc2626] bg-[#fef2f2]">
                  <AlertCircle size={14} className="text-[#dc2626]"/>
                  <span className="text-[11px] font-black text-[#991b1b]">Link missing from profile</span>
                </div>
              )}
            </div>

            {/* ── CONTACT INFO ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border-2 border-[#e2e8f0] bg-white p-3">
                <p className="text-[9px] font-black text-[#1e293b] uppercase tracking-widest mb-2 flex items-center gap-1">
                  <User size={10}/> Student
                </p>
                <div className="space-y-1.5">
                  {studentRecord?.email && (
                    <div className="flex gap-1 items-center">
                      <a href={`mailto:${studentRecord.email}`} className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md bg-[#f1f5f9] border border-[#cbd5e1] min-w-0">
                        <Mail size={11} className="text-[#1e293b] shrink-0"/>
                        <span className="text-[11px] font-black text-[#000000] truncate">{studentRecord.email}</span>
                      </a>
                      <button onClick={() => copyToClipboard(studentRecord.email, 'se')} className="p-1.5 text-[#475569] hover:text-[#000000]">
                         {copiedKey === 'se' ? <Check size={12} className="text-[#16a34a]"/> : <Copy size={12}/>}
                      </button>
                    </div>
                  )}
                  {studentRecord?.phone && (
                    <div className="flex gap-1 items-center">
                      <a href={`tel:${studentRecord.phone}`} className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md bg-[#f1f5f9] border border-[#cbd5e1]">
                        <Phone size={11} className="text-[#1e293b] shrink-0"/>
                        <span className="text-[11px] font-black text-[#000000]">{studentRecord.phone}</span>
                      </a>
                      <button onClick={() => copyToClipboard(studentRecord.phone, 'sp')} className="p-1.5 text-[#475569] hover:text-[#000000]">
                         {copiedKey === 'sp' ? <Check size={12} className="text-[#16a34a]"/> : <Copy size={12}/>}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border-2 border-[#e2e8f0] bg-[#f8fafc] p-3">
                <p className="text-[9px] font-black text-[#1e293b] uppercase tracking-widest mb-2">Parent / Guardian</p>
                <div className="space-y-1.5">
                  {studentRecord?.parent_name && (
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-[#cbd5e1] bg-white mb-1">
                      <User size={11} className="text-[#1e293b]"/>
                      <span className="text-[11px] font-black text-[#000000]">{studentRecord.parent_name}</span>
                    </div>
                  )}
                  {studentRecord?.parent_email && (
                    <div className="flex gap-1 items-center">
                      <a href={`mailto:${studentRecord.parent_email}`} className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md bg-white border border-[#cbd5e1] min-w-0">
                        <Mail size={11} className="text-[#1e293b] shrink-0"/>
                        <span className="text-[11px] font-black text-[#000000] truncate">{studentRecord.parent_email}</span>
                      </a>
                      <button onClick={() => copyToClipboard(studentRecord.parent_email, 'pe')} className="p-1.5 text-[#475569] hover:text-[#000000]">
                         {copiedKey === 'pe' ? <Check size={12} className="text-[#16a34a]"/> : <Copy size={12}/>}
                      </button>
                    </div>
                  )}
                  {studentRecord?.parent_phone && (
                    <div className="flex gap-1 items-center">
                      <a href={`tel:${studentRecord.parent_phone}`} className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md bg-white border border-[#cbd5e1]">
                        <Phone size={11} className="text-[#1e293b] shrink-0"/>
                        <span className="text-[11px] font-black text-[#000000]">{studentRecord.parent_phone}</span>
                      </a>
                      <button onClick={() => copyToClipboard(studentRecord.parent_phone, 'pp')} className="p-1.5 text-[#475569] hover:text-[#000000]">
                         {copiedKey === 'pp' ? <Check size={12} className="text-[#16a34a]"/> : <Copy size={12}/>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── REASSIGN SECTION ── */}
            {altTutors.length > 0 && (
              <div>
                <p className="text-[9px] font-black text-[#1e293b] uppercase tracking-widest mb-1.5">Quick Reassign</p>
                <div className="grid grid-cols-3 gap-2">
                  {altTutors.map(t => {
                    const alt = sessions.find(ss => ss.date === s.date && ss.tutorId === t.id && ss.time === sessionTime);
                    const used = alt ? alt.students.length : 0;
                    const isConfirming = confirmReassignId === t.id;

                    return (
                      <button key={t.id} 
                        onClick={() => handleReassign(t)}
                        onMouseLeave={() => setConfirmReassignId(null)}
                        className={`p-2 rounded-lg border-2 transition-all text-left flex flex-col justify-center min-h-[44px] ${
                            isConfirming 
                            ? 'border-[#dc2626] bg-[#fff1f2] ring-2 ring-[#fecaca]' 
                            : 'border-[#cbd5e1] bg-white hover:border-[#1e293b]'
                        }`}>
                        {isConfirming ? (
                            <p className="text-[9px] font-black text-[#dc2626] uppercase leading-tight">Confirm?</p>
                        ) : (
                            <>
                                <p className="text-[11px] font-black text-[#0f172a] truncate">{t.name.split(' ')[0]}</p>
                                <p className="text-[9px] text-[#1e293b] font-black">{used}/{MAX_CAPACITY}</p>
                            </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button onClick={handleRemove}
              className="w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors border-2 border-dashed border-[#fecaca] text-[#dc2626] hover:bg-[#fff1f2]">
              <UserX size={12}/> Remove Student
            </button>
          </div>
        )}

        {/* ── NOTES TAB ── */}
        {modalTab === 'notes' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-black text-[#1e293b] uppercase tracking-widest">Session Notes</p>
              <div className="flex items-center gap-2">
                {notesEditing ? (
                  <button onClick={handleSaveNotes} disabled={notesSaving}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#0f172a] text-[10px] font-black text-white">
                    {notesSaving ? <Loader2 size={10} className="animate-spin"/> : <Save size={10}/>} Save
                  </button>
                ) : (
                  <button onClick={() => setNotesEditing(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#fef2f2] text-[10px] font-black text-[#dc2626] border border-[#fecaca]">
                    <FileText size={10}/> Edit
                  </button>
                )}
              </div>
            </div>

            <textarea 
              value={notesDraft} 
              onChange={e => setNotesDraft(e.target.value)}
              disabled={!notesEditing}
              className={`w-full p-3 text-sm font-bold rounded-xl outline-none transition-all min-h-[220px] border-2 ${
                notesEditing ? 'border-[#dc2626] bg-white text-[#000000]' : 'border-transparent bg-[#f8fafc] cursor-default text-[#000000]'
              }`}
              placeholder="Type session details..."
              style={{ color: '#000000' }} // Forced black
            />
          </div>
        )}
      </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col border-2 border-[#e2e8f0]"
        style={{ maxWidth: 640, height: 'auto', maxHeight: '90vh' }}>
        <ModalContent {...contentProps}/>
      </div>
    </div>
  );
}