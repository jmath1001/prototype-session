import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Tutor = {
  id: string
  name: string
  subjects: string[]
  cat: string
  availability: number[]
  availabilityBlocks: string[]
}

export type Student = {
  id: string
  name: string
  subject: string
  hoursLeft: number
}

export type SessionStudent = {
  rowId: string
  id: string
  name: string
  topic: string
  status: string
}

export type Session = {
  id: string
  date: string
  tutorId: string
  time: string
  students: SessionStudent[]
}

export type ScheduleData = {
  tutors: Tutor[]
  students: Student[]
  sessions: Session[]
  loading: boolean
  error: string | null
  refetch: () => void
}

// ── Date helpers ──────────────────────────────────────────────────────────────

// ── Date helpers (FIXED FOR CENTRAL TIME) ──────────────────────────────────────

// Add this one new function to get "Now" in Central Time
export function getCentralTimeNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }));
}

export function getWeekStart(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

// THIS IS THE MAIN FIX: Manual string building prevents UTC day-jumping
export function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
}

// KEPT EXACTLY THE SAME: Monday=1, Saturday=6, Sunday=7
export function dayOfWeek(isoDate: string): number {
  const d = new Date(isoDate + 'T00:00:00')
  const js = d.getDay()
  return js === 0 ? 7 : js
}

// KEPT EXACTLY THE SAME: Safe for rendering
export function formatDate(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

// KEPT EXACTLY THE SAME: Just math
export function getOccupiedBlocks(startTime: string, durationMinutes: number): string[] {
  const [h, m] = startTime.split(':').map(Number)
  const blocks: string[] = []
  const totalMinutes = h * 60 + m
  const numBlocks = Math.ceil(durationMinutes / 30)
  for (let i = 0; i < numBlocks; i++) {
    const blockMinutes = totalMinutes + i * 30
    const bh = Math.floor(blockMinutes / 60)
    const bm = blockMinutes % 60
    blocks.push(`${String(bh).padStart(2, '0')}:${String(bm).padStart(2, '0')}`)
  }
  return blocks
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useScheduleData(weekStart: Date): ScheduleData {
  const [tutors,   setTutors]   = useState<Tutor[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [tick,     setTick]     = useState(0)

  const refetch = () => setTick(t => t + 1)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const from = toISODate(weekStart)
      const to   = toISODate(weekEnd)

      try {
        const [tutorRes, studentRes, sessionRes] = await Promise.all([
          supabase.from('tutors2').select('*').order('name'),
          supabase.from('students2').select('*').order('name'),
          supabase
            .from('sessions2')
            .select(`
              id, session_date, tutor_id, time,
              session_students2 ( id, student_id, name, topic, status )
            `)
            .gte('session_date', from)
            .lte('session_date', to)
            .order('session_date')
            .order('time'),
        ])

        if (tutorRes.error)   throw tutorRes.error
        if (studentRes.error) throw studentRes.error
        if (sessionRes.error) throw sessionRes.error

        const tutors: Tutor[] = (tutorRes.data ?? []).map(r => ({
          id:                 r.id,
          name:               r.name,
          subjects:           r.subjects ?? [],
          cat:                r.cat,
          availability:       r.availability ?? [],
          availabilityBlocks: r.availability_blocks ?? [],
        }))

        const students: Student[] = (studentRes.data ?? []).map(r => ({
          id:        r.id,
          name:      r.name,
          subject:   r.subject,
          hoursLeft: r.hours_left,
        }))

        const sessions: Session[] = (sessionRes.data ?? []).map(r => ({
          id:       r.id,
          date:     r.session_date,
          tutorId:  r.tutor_id,
          time:     r.time,
          students: (r.session_students2 ?? []).map((ss: any) => ({
            id:     ss.student_id,
            rowId:  ss.id,
            name:   ss.name,
            topic:  ss.topic,
            status: ss.status,
          })),
        }))

        if (!cancelled) {
          setTutors(tutors)
          setStudents(students)
          setSessions(sessions)
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'Failed to load schedule')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [toISODate(weekStart), tick])

  return { tutors, students, sessions, loading, error, refetch }
}

// ── Write helpers ─────────────────────────────────────────────────────────────

export async function bookStudent({
  tutorId,
  date,
  time,
  student,
  topic,
  recurring = false,
  recurringWeeks = 1,
}: {
  tutorId: string
  date: string
  time: string
  student: Student
  topic: string
  recurring?: boolean
  recurringWeeks?: number
}) {
  const weeks = recurring ? recurringWeeks : 1
  const MAX_CAPACITY = 3 // Adjust this number to your center's limit

  for (let w = 0; w < weeks; w++) {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + w * 7)
    const isoDate = toISODate(d)

    // 1. CHECK FOR STUDENT DOUBLE-BOOKING
    // Check if this student is already in ANY session on this date and time
    const { data: studentConflict, error: conflictErr } = await supabase
      .from('session_students2')
      .select('id, sessions2!inner(id)')
      .eq('student_id', student.id)
      .eq('sessions2.session_date', isoDate)
      .eq('sessions2.time', time)
      .maybeSingle()

    if (conflictErr) throw conflictErr
    if (studentConflict) {
      throw new Error(`${student.name} is already booked at ${time} on ${isoDate}`)
    }

    // 2. FIND OR CREATE SESSION & CHECK CAPACITY
    let { data: existing, error: fetchErr } = await supabase
      .from('sessions2')
      .select('id, session_students2(id)')
      .eq('session_date', isoDate)
      .eq('tutor_id', tutorId)
      .eq('time', time)
      .maybeSingle()

    if (fetchErr) throw fetchErr

    let sessionId: string

    if (existing) {
      // Check if session is full
      if (existing.session_students2 && existing.session_students2.length >= MAX_CAPACITY) {
        throw new Error(`This session with the tutor is full for ${isoDate}`)
      }
      sessionId = existing.id
    } else {
      const { data: created, error: createErr } = await supabase
        .from('sessions2')
        .insert({ session_date: isoDate, tutor_id: tutorId, time })
        .select('id')
        .single()
      if (createErr) throw createErr
      sessionId = created.id
    }

    // 3. FINAL ENROLLMENT
    const { error: enrollErr } = await supabase
      .from('session_students2')
      .insert({
        session_id: sessionId,
        student_id: student.id,
        name: student.name,
        topic,
        status: 'scheduled',
      })

    if (enrollErr) throw enrollErr
  }
}

export async function updateAttendance({
  sessionId,
  studentId,
  status,
}: {
  sessionId: string
  studentId: string
  status: 'scheduled' | 'present' | 'no-show'
}) {
  const { error } = await supabase
    .from('session_students2')
    .update({ status })
    .eq('session_id', sessionId)
    .eq('student_id', studentId)

  if (error) throw error
}

export async function removeStudentFromSession({
  sessionId,
  studentId,
}: {
  sessionId: string
  studentId: string
}) {
  const { error } = await supabase
    .from('session_students2')
    .delete()
    .eq('session_id', sessionId)
    .eq('student_id', studentId)

  if (error) throw error
}