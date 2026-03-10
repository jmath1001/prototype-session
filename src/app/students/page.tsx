"use client"
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, GraduationCap, Loader2, Save, X, Search, ChevronDown, ChevronUp, Mail, Phone, User } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const EMPTY_FORM = { name: '', grade: '', email: '', phone: '', parent_name: '', parent_email: '', parent_phone: '' };

// ─── Expandable Student Row ───────────────────────────────────────────────────

function StudentRow({ student, onRefetch }: { student: any; onRefetch: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(student);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hasContact = student.email || student.phone || student.parent_name || student.parent_email || student.parent_phone;

  const handleUpdate = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('slake_students')
      .update({
        name: draft.name,
        grade: draft.grade,
        email: draft.email || null,
        phone: draft.phone || null,
        parent_name: draft.parent_name || null,
        parent_email: draft.parent_email || null,
        parent_phone: draft.parent_phone || null,
      })
      .eq('id', student.id);
    if (!error) { onRefetch(); setIsEditing(false); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); return; }
    await supabase.from('slake_students').delete().eq('id', student.id);
    onRefetch();
  };

  const Field = ({ label, value, field, type = 'text' }: { label: string; value: string; field: string; type?: string }) => (
    <div className="space-y-1">
      <label className="text-[9px] font-black text-[#a8a29e] uppercase tracking-widest">{label}</label>
      {isEditing ? (
        <input
          type={type}
          value={draft[field] ?? ''}
          onChange={e => setDraft({ ...draft, [field]: e.target.value })}
          className="w-full px-3 py-2 bg-[#f0ece8]/50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#6d28d9] border border-transparent focus:border-[#6d28d9]"
          placeholder={label}
        />
      ) : (
        <p className="text-sm text-[#1c1917]">{value || <span className="text-[#c4bfba] italic text-xs">—</span>}</p>
      )}
    </div>
  );

  return (
    <div className={`bg-white rounded-2xl border-2 transition-all ${expanded ? 'border-[#c4b5fd]' : 'border-[#f0ece8] hover:border-[#e7e3dd]'} overflow-hidden`}>
      {/* Main row */}
      <div className="p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#ede9fe] flex items-center justify-center text-sm font-black text-[#6d28d9] shrink-0">
          {student.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <p className="font-bold text-[#1c1917] text-sm leading-tight truncate">{student.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {student.grade && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-[#ede9fe] text-[#6d28d9] uppercase tracking-wider">Gr. {student.grade}</span>
            )}
            {hasContact && (
              <span className="text-[9px] text-[#a8a29e] font-medium">
                {[student.email, student.phone, student.parent_email].filter(Boolean).length} contact{[student.email, student.phone, student.parent_email].filter(Boolean).length !== 1 ? 's' : ''}
              </span>
            )}
            {!hasContact && (
              <span className="text-[9px] text-[#d4cfc9] italic">No contact info</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isEditing ? (
            <>
              <button onClick={() => { setIsEditing(false); setDraft(student); }}
                className="p-2 rounded-lg text-[#a8a29e] hover:text-[#1c1917] hover:bg-[#f0ece8] transition-all">
                <X size={15} />
              </button>
              <button onClick={handleUpdate} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6d28d9] text-white rounded-lg text-xs font-black hover:bg-[#5b21b6] disabled:opacity-50 transition-all">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleDelete}
                className={`p-2 rounded-lg text-xs font-black transition-all ${confirmDelete ? 'bg-red-100 text-red-600' : 'text-[#d4cfc9] hover:text-red-400 hover:bg-red-50'}`}>
                {confirmDelete ? <span className="px-1">Sure?</span> : <Trash2 size={14} />}
              </button>
              <button
                onClick={() => { setIsEditing(true); setExpanded(true); }}
                className="px-3 py-1.5 text-xs font-black text-[#78716c] border border-[#e7e3dd] rounded-lg hover:bg-[#f0ece8] transition-all">
                Edit
              </button>
              <button onClick={() => setExpanded(e => !e)}
                className="p-2 rounded-lg text-[#a8a29e] hover:bg-[#f0ece8] transition-all">
                {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="border-t border-[#f0ece8] px-4 pb-4 pt-3 bg-[#faf9f7]">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="col-span-2 md:col-span-3">
              <p className="text-[9px] font-black text-[#c4b5fd] uppercase tracking-widest mb-3">Student Contact</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Field label="Email" value={student.email} field="email" type="email" />
                <Field label="Phone" value={student.phone} field="phone" type="tel" />
                <Field label="Grade" value={student.grade} field="grade" />
              </div>
            </div>
            <div className="col-span-2 md:col-span-3 mt-1">
              <p className="text-[9px] font-black text-[#c4b5fd] uppercase tracking-widest mb-3">Parent / Guardian</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Name" value={student.parent_name} field="parent_name" />
                <Field label="Email" value={student.parent_email} field="parent_email" type="email" />
                <Field label="Phone" value={student.parent_phone} field="parent_phone" type="tel" />
              </div>
            </div>
          </div>
          {isEditing && (
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setIsEditing(false); setDraft(student); }}
                className="px-4 py-2 text-xs font-bold text-[#78716c] border border-[#e7e3dd] rounded-xl hover:bg-[#f0ece8] transition-all">
                Cancel
              </button>
              <button onClick={handleUpdate} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-[#6d28d9] text-white rounded-xl text-xs font-black hover:bg-[#5b21b6] disabled:opacity-50 transition-all">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save Changes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudentAdminPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [newStudent, setNewStudent] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('slake_students').select('*').order('name');
    setStudents(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!newStudent.name) return;
    setCreating(true);
    await supabase.from('slake_students').insert([{
      name: newStudent.name,
      grade: newStudent.grade || null,
      email: newStudent.email || null,
      phone: newStudent.phone || null,
      parent_name: newStudent.parent_name || null,
      parent_email: newStudent.parent_email || null,
      parent_phone: newStudent.parent_phone || null,
    }]);
    setAdding(false);
    setNewStudent(EMPTY_FORM);
    fetchData();
    setCreating(false);
  };

  const filtered = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen pb-20" style={{ background: '#f7f4ef', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>

      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#e7e3dd]">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#6d28d9] flex items-center justify-center">
              <GraduationCap size={15} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black text-[#1c1917] leading-none">Student Directory</h1>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-[#6d28d9]">Slake</p>
            </div>
          </div>
          <button
            onClick={() => setAdding(a => !a)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all active:scale-95"
            style={{ background: '#1c1917' }}>
            {adding ? <X size={13} /> : <Plus size={13} />}
            {adding ? 'Cancel' : 'Add Student'}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 pt-6 space-y-4">

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a8a29e]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search students..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#e7e3dd] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#6d28d9]/20 focus:border-[#6d28d9] transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a8a29e] hover:text-[#1c1917]">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Add form */}
        {adding && (
          <div className="bg-white rounded-2xl border-2 border-[#6d28d9] overflow-hidden shadow-lg shadow-violet-100/50">
            <div className="px-5 py-3.5 bg-[#faf9ff] border-b border-[#ede9fe]">
              <p className="text-xs font-black text-[#6d28d9] uppercase tracking-widest">New Student</p>
            </div>
            <div className="p-5 space-y-4">
              {/* Required */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2 md:col-span-1">
                  <label className="text-[9px] font-black text-[#a8a29e] uppercase tracking-widest">Name *</label>
                  <input
                    value={newStudent.name}
                    onChange={e => setNewStudent({ ...newStudent, name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#f0ece8]/50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#6d28d9] border border-transparent focus:border-[#6d28d9]"
                    placeholder="Full name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-[#a8a29e] uppercase tracking-widest">Grade</label>
                  <input
                    value={newStudent.grade}
                    onChange={e => setNewStudent({ ...newStudent, grade: e.target.value })}
                    className="w-full px-3 py-2 bg-[#f0ece8]/50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#6d28d9] border border-transparent focus:border-[#6d28d9]"
                    placeholder="1–12"
                  />
                </div>
              </div>

              {/* Student contact */}
              <div>
                <p className="text-[9px] font-black text-[#c4b5fd] uppercase tracking-widest mb-2">Student Contact <span className="font-medium normal-case text-[#d4cfc9]">(optional)</span></p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#a8a29e] uppercase tracking-widest">Email</label>
                    <input type="email" value={newStudent.email} onChange={e => setNewStudent({ ...newStudent, email: e.target.value })}
                      className="w-full px-3 py-2 bg-[#f0ece8]/50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#6d28d9] border border-transparent focus:border-[#6d28d9]"
                      placeholder="student@email.com" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#a8a29e] uppercase tracking-widest">Phone</label>
                    <input type="tel" value={newStudent.phone} onChange={e => setNewStudent({ ...newStudent, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-[#f0ece8]/50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#6d28d9] border border-transparent focus:border-[#6d28d9]"
                      placeholder="(555) 000-0000" />
                  </div>
                </div>
              </div>

              {/* Parent contact */}
              <div>
                <p className="text-[9px] font-black text-[#c4b5fd] uppercase tracking-widest mb-2">Parent / Guardian <span className="font-medium normal-case text-[#d4cfc9]">(optional)</span></p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#a8a29e] uppercase tracking-widest">Name</label>
                    <input value={newStudent.parent_name} onChange={e => setNewStudent({ ...newStudent, parent_name: e.target.value })}
                      className="w-full px-3 py-2 bg-[#f0ece8]/50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#6d28d9] border border-transparent focus:border-[#6d28d9]"
                      placeholder="Parent name" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#a8a29e] uppercase tracking-widest">Email</label>
                    <input type="email" value={newStudent.parent_email} onChange={e => setNewStudent({ ...newStudent, parent_email: e.target.value })}
                      className="w-full px-3 py-2 bg-[#f0ece8]/50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#6d28d9] border border-transparent focus:border-[#6d28d9]"
                      placeholder="parent@email.com" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#a8a29e] uppercase tracking-widest">Phone</label>
                    <input type="tel" value={newStudent.parent_phone} onChange={e => setNewStudent({ ...newStudent, parent_phone: e.target.value })}
                      className="w-full px-3 py-2 bg-[#f0ece8]/50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#6d28d9] border border-transparent focus:border-[#6d28d9]"
                      placeholder="(555) 000-0000" />
                  </div>
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={!newStudent.name || creating}
                className="w-full py-3 rounded-xl text-sm font-black uppercase tracking-widest text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: '#1c1917' }}>
                {creating ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Register Student'}
              </button>
            </div>
          </div>
        )}

        {/* Count */}
        {!loading && (
          <p className="text-[10px] font-bold text-[#a8a29e] uppercase tracking-widest px-1">
            {filtered.length} student{filtered.length !== 1 ? 's' : ''}{search ? ` matching "${search}"` : ''}
          </p>
        )}

        {/* List */}
        {loading ? (
          <div className="flex flex-col items-center py-24 gap-3">
            <Loader2 size={22} className="animate-spin text-[#6d28d9]" />
            <p className="text-xs font-semibold text-[#a8a29e] uppercase tracking-widest">Loading students…</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-2">
            {filtered.map(s => <StudentRow key={s.id} student={s} onRefetch={fetchData} />)}
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-[#e7e3dd]">
            <p className="text-sm text-[#a8a29e] italic">No students found</p>
          </div>
        )}
      </div>
    </div>
  );
}