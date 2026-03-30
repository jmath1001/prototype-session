"use client"
import { X, UserX, CheckCircle2, Clock, Mail, Phone, ExternalLink, User, ChevronDown, ChevronUp, FileText, Save, Loader2 } from 'lucide-react';
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

  const [contactOpen, setContactOpen] = useState(false);
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesDraft, setNotesDraft] = useState<string>(student.notes ?? '');
  const [notesSaving, setNotesSaving] = useState(false);

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

  const handleRemove = async () => {
    try { await removeStudentFromSession({ sessionId: s.id, studentId: student.id }); refetch(); setSelectedSession(null); }
    catch (err) { console.error(err); }
  };

  const handleReassign = async (newTutor: Tutor) => {
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

  // Derived display
  const initials = student.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const blockLabel = s.block?.label ?? sessionTime;

  const statusConfig = {
    present:   { label: 'Present',   bg: '#f0fdf4', border: '#16a34a', text: '#15803d' },
    'no-show': { label: 'No-show',   bg: '#fef2f2', border: '#dc2626', text: '#b91c1c' },
    scheduled: { label: 'Scheduled', bg: '#f8fafc', border: '#94a3b8', text: '#475569' },
  } as const;

  const confConfig = {
    confirmed: { bg: '#f0fdf4', border: '#16a34a', text: '#15803d' },
    null:      { bg: '#fef2f2', border: '#fca5a5', text: '#9f1239' },
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div className="shrink-0 px-5 py-4 flex items-start justify-between gap-4"
        style={{ borderBottom: '1px solid #f1f5f9' }}>
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Avatar */}
          <div className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-sm font-black text-white"
            style={{ background: '#dc2626' }}>
            {initials}
          </div>
          <div className="min-w-0">
            <h2 className="text-[17px] font-black text-[#0f172a] leading-tight tracking-tight truncate">
              {student.name}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-semibold text-[#64748b]">{student.topic}</span>
              {student.grade && (
                <>
                  <span className="text-[#cbd5e1]">·</span>
                  <span className="text-xs text-[#94a3b8]">Grade {student.grade}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button onClick={() => setSelectedSession(null)}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ background: '#f1f5f9', color: '#94a3b8' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e2e8f0'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}>
          <X size={14} />
        </button>
      </div>

      {/* Session context bar */}
      <div className="shrink-0 px-5 py-2.5 flex items-center gap-2 flex-wrap"
        style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
        <span className="text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider text-white"
          style={{ background: '#dc2626' }}>{s.dayName}</span>
        <span className="text-xs text-[#64748b]">{formatDate(s.date)}</span>
        <span className="text-[#e2e8f0]">·</span>
        <span className="text-xs text-[#64748b]">{blockLabel}</span>
        <span className="text-[#e2e8f0]">·</span>
        <span className="text-xs font-semibold text-[#475569]">{s.tutorName}</span>
      </div>

      {/* Tab bar */}
      <div className="shrink-0 flex px-5" style={{ borderBottom: '1px solid #f1f5f9' }}>
        {(['session', 'notes'] as const).map(tab => (
          <button key={tab} onClick={() => setModalTab(tab)}
            className="py-3 mr-6 text-xs font-black uppercase tracking-widest border-b-2 -mb-px flex items-center gap-1.5 transition-colors"
            style={modalTab === tab
              ? { color: '#dc2626', borderColor: '#dc2626' }
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

        {/* ── SESSION TAB ── */}
        {modalTab === 'session' && (
          <div className="p-5 space-y-5">

            {/* Confirmation + Attendance in a unified 5-button row */}
            <div>
              <p className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest mb-2">Status</p>

              {/* Confirmation row */}
              <div className="flex gap-2 mb-2">
                {([
                  { val: 'confirmed' as const, label: 'Confirmed', ...confConfig.confirmed },
                  { val: null,                 label: 'Not yet',   ...confConfig.null },
                ]).map(({ val, label, bg, border, text }) => {
                  const active = currentConf === val;
                  return (
                    <button key={String(val)} onClick={() => handleConfirmation(val)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 flex items-center justify-center gap-1.5 transition-all active:scale-[0.97]"
                      style={active
                        ? { background: bg, borderColor: border, color: text }
                        : { background: 'white', borderColor: '#e2e8f0', color: '#cbd5e1' }}>
                      {val === 'confirmed' ? <CheckCircle2 size={13}/> : <Clock size={13}/>}
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Attendance row */}
              <div className="flex gap-2">
                {(['present', 'no-show', 'scheduled'] as const).map(status => {
                  const cfg = statusConfig[status];
                  const active = currentStatus === status;
                  return (
                    <button key={status} onClick={() => handleAttendance(status)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all active:scale-[0.97]"
                      style={active
                        ? { background: cfg.bg, borderColor: cfg.border, color: cfg.text }
                        : { background: 'white', borderColor: '#e2e8f0', color: '#cbd5e1' }}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── CONTACT ── */}
            {hasContactInfo && (
              <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid #f1f5f9' }}>
                {/* Header row — always clickable */}
                <button onClick={() => setContactOpen(p => !p)}
                  className="w-full flex items-center justify-between px-4 py-3 transition-colors"
                  style={{ background: contactOpen ? '#f8fafc' : 'white' }}>
                  <span className="text-[10px] font-black text-[#64748b] uppercase tracking-widest">Contact</span>
                  {contactOpen ? <ChevronUp size={13} className="text-[#94a3b8]"/> : <ChevronDown size={13} className="text-[#94a3b8]"/>}
                </button>

                {/* Collapsed: single-line chips */}
                {!contactOpen && (
                  <div className="px-4 pb-3 flex flex-wrap gap-2" style={{ borderTop: '1px solid #f8fafc' }}>
                    {studentRecord?.bluebook_url && (
                      <a href={studentRecord.bluebook_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
                        style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                        <ExternalLink size={10}/> Bluebook
                      </a>
                    )}
                    {studentRecord?.email && (
                      <a href={`mailto:${studentRecord.email}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-[#475569] transition-colors"
                        style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <Mail size={10} className="text-[#94a3b8]"/>
                        <span className="max-w-[140px] truncate">{studentRecord.email}</span>
                      </a>
                    )}
                    {studentRecord?.phone && (
                      <a href={`tel:${studentRecord.phone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-[#475569]"
                        style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <Phone size={10} className="text-[#94a3b8]"/>{studentRecord.phone}
                      </a>
                    )}
                    {!studentRecord?.email && !studentRecord?.phone && studentRecord?.parent_email && (
                      <a href={`mailto:${studentRecord.parent_email}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-[#475569]"
                        style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <Mail size={10} className="text-[#94a3b8]"/>
                        <span className="max-w-[140px] truncate">{studentRecord.parent_email}</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Expanded: full details */}
                {contactOpen && (
                  <div className="px-4 pb-4 space-y-4" style={{ borderTop: '1px solid #f1f5f9' }}>
                    {/* Bluebook — featured */}
                    {studentRecord?.bluebook_url && (
                      <a href={studentRecord.bluebook_url} target="_blank" rel="noopener noreferrer"
                        className="mt-3 flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-colors"
                        style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
                        <div className="w-9 h-9 rounded-xl bg-[#16a34a] flex items-center justify-center text-white text-[10px] font-black shrink-0">XL</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-[#15803d]">Bluebook</p>
                          <p className="text-[10px] text-[#16a34a]">Open in SharePoint →</p>
                        </div>
                        <ExternalLink size={13} className="text-[#16a34a] shrink-0"/>
                      </a>
                    )}

                    {/* Student */}
                    {(studentRecord?.email || studentRecord?.phone) && (
                      <div>
                        <p className="text-[9px] font-black text-[#94a3b8] uppercase tracking-widest mb-1.5 flex items-center gap-1"><User size={8}/> Student</p>
                        <div className="space-y-1">
                          {studentRecord?.email && (
                            <a href={`mailto:${studentRecord.email}`}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                              style={{ background: '#f8fafc' }}>
                              <Mail size={12} className="text-[#94a3b8] shrink-0"/>
                              <span className="text-[13px] text-[#1e293b] truncate">{studentRecord.email}</span>
                            </a>
                          )}
                          {studentRecord?.phone && (
                            <a href={`tel:${studentRecord.phone}`}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                              style={{ background: '#f8fafc' }}>
                              <Phone size={12} className="text-[#94a3b8] shrink-0"/>
                              <span className="text-[13px] text-[#1e293b]">{studentRecord.phone}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Parent */}
                    {(studentRecord?.parent_name || studentRecord?.parent_email || studentRecord?.parent_phone) && (
                      <div>
                        <p className="text-[9px] font-black text-[#94a3b8] uppercase tracking-widest mb-1.5">Parent / Guardian</p>
                        <div className="space-y-1">
                          {studentRecord?.parent_name && (
                            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: '#f8fafc' }}>
                              <User size={12} className="text-[#94a3b8] shrink-0"/>
                              <span className="text-[13px] text-[#1e293b]">{studentRecord.parent_name}</span>
                            </div>
                          )}
                          {studentRecord?.parent_email && (
                            <a href={`mailto:${studentRecord.parent_email}`}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                              style={{ background: '#f8fafc' }}>
                              <Mail size={12} className="text-[#94a3b8] shrink-0"/>
                              <span className="text-[13px] text-[#1e293b] truncate">{studentRecord.parent_email}</span>
                            </a>
                          )}
                          {studentRecord?.parent_phone && (
                            <a href={`tel:${studentRecord.parent_phone}`}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                              style={{ background: '#f8fafc' }}>
                              <Phone size={12} className="text-[#94a3b8] shrink-0"/>
                              <span className="text-[13px] text-[#1e293b]">{studentRecord.parent_phone}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── REASSIGN ── */}
            {altTutors.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest mb-2">Reassign to</p>
                <div className="space-y-2">
                  {altTutors.map(t => {
                    const alt = sessions.find(ss => ss.date === s.date && ss.tutorId === t.id && ss.time === sessionTime);
                    const used = alt ? alt.students.length : 0;
                    return (
                      <div key={t.id} className="flex items-center justify-between px-3.5 py-3 rounded-xl"
                        style={{ background: '#f8fafc', border: '1.5px solid #f1f5f9' }}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#fee2e2] text-[#dc2626] flex items-center justify-center text-xs font-black">
                            {t.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#1e293b]">{t.name}</p>
                            <p className="text-[10px] text-[#94a3b8]">{used}/{MAX_CAPACITY} students</p>
                          </div>
                        </div>
                        <button onClick={() => handleReassign(t)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-black text-white uppercase tracking-wider transition-all active:scale-95"
                          style={{ background: '#0f172a' }}>
                          Move
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── REMOVE ── */}
            <button onClick={handleRemove}
              className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              style={{ border: '1.5px dashed #fecaca', color: '#dc2626', background: 'transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fef2f2'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <UserX size={13} strokeWidth={2}/> Remove from Session
            </button>
          </div>
        )}

        {/* ── NOTES TAB ── */}
        {modalTab === 'notes' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest">Session Notes</p>
              <div className="flex items-center gap-2">
                {notesEditing ? (
                  <>
                    <button onClick={() => { setNotesDraft(student.notes ?? ''); setNotesEditing(false); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#64748b] transition-colors"
                      style={{ background: '#f1f5f9' }}>
                      Cancel
                    </button>
                    <button onClick={handleSaveNotes} disabled={notesSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black text-white disabled:opacity-40 transition-all"
                      style={{ background: '#0f172a' }}>
                      {notesSaving ? <Loader2 size={11} className="animate-spin"/> : <Save size={11}/>} Save
                    </button>
                  </>
                ) : (
                  <button onClick={() => setNotesEditing(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#dc2626] transition-colors"
                    style={{ background: '#fef2f2' }}>
                    <FileText size={11}/> Edit
                  </button>
                )}
              </div>
            </div>

            {notesEditing ? (
              <textarea value={notesDraft} onChange={e => setNotesDraft(e.target.value)}
                placeholder="Add session notes…" autoFocus rows={8}
                className="w-full px-4 py-3 text-sm rounded-2xl resize-none outline-none transition-all"
                style={{ background: 'white', border: '1.5px solid #dc2626', color: '#1e293b', fontFamily: 'inherit', lineHeight: 1.6 }}
              />
            ) : (
              <div onClick={() => setNotesEditing(true)}
                className="px-4 py-3 rounded-2xl cursor-text transition-colors min-h-[160px]"
                style={{ background: '#f8fafc', border: '1.5px solid #f1f5f9' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#f1f5f9'; }}>
                {student.notes
                  ? <p className="text-sm text-[#1e293b] whitespace-pre-wrap leading-relaxed">{student.notes}</p>
                  : <p className="text-sm text-[#cbd5e1] italic">No notes yet — click to add</p>}
              </div>
            )}
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

  const hasContactInfo = !!(
    studentRecord?.email || studentRecord?.phone || studentRecord?.bluebook_url ||
    studentRecord?.parent_name || studentRecord?.parent_email || studentRecord?.parent_phone
  );

  const contentProps: ModalContentProps = {
    ...props, s, student, studentRecord, altTutors, hasContactInfo, sessionTime,
  };

  return (
    <div className="fixed inset-0 z-50" style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}>
      {/* Desktop */}
      <div className="hidden md:flex items-center justify-center h-full p-6">
        <div className="w-full rounded-2xl overflow-hidden shadow-xl flex flex-col bg-white"
          style={{ maxWidth: 460, maxHeight: 'min(660px, 92vh)', border: '1px solid #e2e8f0' }}>
          <ModalContent {...contentProps}/>
        </div>
      </div>
      {/* Mobile bottom sheet */}
      <div className="md:hidden flex flex-col h-full">
        <div className="flex-1" onClick={() => setSelectedSession(null)}/>
        <div className="bg-white rounded-t-2xl shadow-xl flex flex-col" style={{ maxHeight: '92vh' }}>
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-9 h-1 rounded-full bg-[#e2e8f0]"/>
          </div>
          <ModalContent {...contentProps}/>
        </div>
      </div>
    </div>
  );
}