import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Day name aliases for matching
const DAY_ALIASES: Record<string, string[]> = {
  monday:    ['monday', 'mon'],
  tuesday:   ['tuesday', 'tue'],
  wednesday: ['wednesday', 'wed'],
  thursday:  ['thursday', 'thu'],
  friday:    ['friday', 'fri'],
  saturday:  ['saturday', 'sat'],
  sunday:    ['sunday', 'sun'],
  today:     ['today'],
  tomorrow:  ['tomorrow'],
}

function resolveDayName(raw: string, today: string): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase().trim()

  // today / tomorrow -> resolve to actual date string YYYY-MM-DD
  if (lower === 'today') return today
  if (lower === 'tomorrow') {
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }

  // Otherwise return the normalized day name (monday, tuesday, etc.)
  for (const [canonical, aliases] of Object.entries(DAY_ALIASES)) {
    if (aliases.includes(lower)) return canonical
  }
  return null
}

export async function POST(req: NextRequest) {
  const { query, context } = await req.json()

  const { students = [], availableSeats = [], today = '' } = context

  const studentIndex = students.map((s: any) => ({ id: s.id, name: s.name }))

  const systemPrompt = `You are a scheduling assistant for a tutoring center. Classify the query and return ONLY a tiny JSON object. No markdown, no explanation.

STUDENTS: ${JSON.stringify(studentIndex)}

Return ONLY one of these shapes:

1. Student contact info ("contact", "email", "phone", "parent"):
{"type":"student_contact","studentId":"<id>"}

2. Student sessions/history/upcoming ("sessions", "history", "upcoming", "booked", "schedule"):
{"type":"student_sessions","studentId":"<id>"}

3. General student lookup ("show me", "find", "look up", name only):
{"type":"student_profile","studentId":"<id>"}

4. Available slot query ("open slots", "available", "find a slot", "slots", subject + slots):
{"type":"slots","subject":"<subject keyword or empty string>","day":"<day name or today/tomorrow or empty string>","reason":"<one sentence>"}

5. Anything else:
{"type":"answer","text":"<brief answer>"}

RULES:
- For slot queries: extract subject (e.g. "physics", "math") and day (e.g. "monday", "today", "tomorrow"). Use "" if not mentioned.
- For student queries: match name to STUDENTS list exactly and return their id.
- Never include slotIndices — that is handled by the server.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      max_tokens: 80,
      temperature: 0,
    })

    const text = response.choices[0].message.content?.trim() ?? ''

    try {
      const parsed = JSON.parse(text)

      if (parsed.type === 'slots') {
        const subject: string = (parsed.subject ?? '').toLowerCase().trim()
        const dayRaw: string = (parsed.day ?? '').toLowerCase().trim()
        const resolvedDay = resolveDayName(dayRaw, today)
        console.log('[slots] subject:', subject, '| dayRaw:', dayRaw, '| resolvedDay:', resolvedDay, '| today:', today, '| totalSeats:', availableSeats.length)

        const matchingIndices: number[] = availableSeats.reduce((acc: number[], seat: any, i: number) => {
          // Subject filter
          if (subject) {
            const tutorSubjects: string[] = (seat.tutor?.subjects ?? []).map((s: string) => s.toLowerCase())
            const subjectMatch = tutorSubjects.some(s => s.includes(subject) || subject.includes(s))
            if (!subjectMatch) return acc
          }

          // Day filter
          if (resolvedDay) {
            // If it's a full date (today/tomorrow), match exact date
            if (resolvedDay.match(/^\d{4}-\d{2}-\d{2}$/)) {
              if (seat.date !== resolvedDay) return acc
            } else {
              // Match by day name (dayName field on seat)
              const seatDay = (seat.dayName ?? '').toLowerCase()
              if (!seatDay.startsWith(resolvedDay.slice(0, 3))) return acc
            }
          }

          acc.push(i)
          return acc
        }, [])

        console.log('[slots] matchingIndices count:', matchingIndices.length)
        return NextResponse.json({
          type: 'slots',
          slotIndices: matchingIndices,
          reason: parsed.reason ?? `Available slots${subject ? ` for ${subject}` : ''}${dayRaw ? ` on ${dayRaw}` : ' this week'}`,
        })
      }

      return NextResponse.json(parsed)
    } catch {
      return NextResponse.json({ type: 'answer', text })
    }
  } catch (err: any) {
    console.error('Command route error:', err)
    return NextResponse.json({ type: 'error', text: 'Something went wrong. Try again.' }, { status: 500 })
  }
}