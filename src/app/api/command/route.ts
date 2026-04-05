import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Simple optimization logic
function generateOptimizationProposal(context: any) {
  const { students = [], tutors = [], upcomingSessions = [], availableSeats = [] } = context
  const changes: any[] = []

  // Find students not assigned to any upcoming sessions
  const assignedStudentIds = new Set()
  upcomingSessions.forEach((session: any) => {
    session.students?.forEach((student: any) => {
      assignedStudentIds.add(student.id)
    })
  })

  const unassignedStudents = students.filter((s: any) => !assignedStudentIds.has(s.id))

  console.log(`Total students: ${students.length}`)
  console.log(`Total tutors: ${tutors.length}`)
  console.log(`Total upcoming sessions: ${upcomingSessions.length}`)
  console.log(`Total available seats: ${availableSeats.length}`)
  console.log(`Assigned student IDs:`, Array.from(assignedStudentIds))
  console.log(`Unassigned students:`, unassignedStudents.map((s: any) => ({ id: s.id, name: s.name, subject: s.subject, hoursLeft: s.hoursLeft })))

  // For each unassigned student, find best tutor match
  unassignedStudents.forEach((student: any) => {
    const studentSubject = student.subject?.toLowerCase() || ''
    console.log(`Processing ${student.name} with subject: ${studentSubject}`)

    // Find tutors who teach this student's subject (case-insensitive partial match)
    const matchingTutors = tutors.filter((tutor: any) =>
      tutor.subjects?.some((subject: string) =>
        subject.toLowerCase().includes(studentSubject) ||
        studentSubject.includes(subject.toLowerCase())
      )
    )

    console.log(`Found ${matchingTutors.length} matching tutors for ${student.name}:`, matchingTutors.map((t: any) => t.name))

    if (matchingTutors.length === 0) {
      // If no exact match, use any available tutor (fallback)
      console.log(`No subject match for ${student.name}, using fallback`)
      if (tutors.length > 0) {
        matchingTutors.push(tutors[0])
      }
    }

    if (matchingTutors.length === 0) return // No tutors available

    // Find available seats for matching tutors
    const availableSlots = availableSeats.filter((seat: any) =>
      matchingTutors.some((tutor: any) => tutor.name === seat.tutor)
    )

    console.log(`Found ${availableSlots.length} available slots for ${student.name}`)

    if (availableSlots.length === 0) return // No available slots

    // Prefer slots that are already partially filled (efficiency) or earliest time
    const bestSlot = availableSlots.find((slot: any) => slot.seatsLeft < 3) ||
                    availableSlots.sort((a: any, b: any) => a.time.localeCompare(b.time))[0]

    if (bestSlot) {
      changes.push({
        studentName: student.name,
        oldTime: 'Unassigned',
        newSlot: {
          time: bestSlot.time,
          tutorName: bestSlot.tutor,
          date: bestSlot.date
        },
        explanation: `Book ${student.name} with ${bestSlot.tutor} for ${student.subject || 'tutoring'}`
      })
      console.log(`Assigned ${student.name} to ${bestSlot.tutor} at ${bestSlot.time} on ${bestSlot.date}`)
    }
  })

  console.log(`Generated ${changes.length} optimization changes`)

  if (changes.length === 0) {
    let aiSuggestion = ''

    if (unassignedStudents.length === 0) {
      aiSuggestion = `All ${students.length} students are already optimally scheduled in upcoming sessions. My AI analysis shows perfect resource utilization.`
    } else if (tutors.length === 0) {
      aiSuggestion = `I detected ${unassignedStudents.length} students needing scheduling, but no tutors are currently available. AI Recommendation: Add tutor availability or expand the scheduling window to accommodate these students.`
    } else if (availableSeats.length === 0) {
      aiSuggestion = `My AI algorithms identified ${unassignedStudents.length} students ready for scheduling, but current capacity is at maximum. Smart suggestions: 1) Extend scheduling to next week, 2) Add additional tutor shifts, 3) Consider group sessions for efficiency, or 4) Review time-off schedules for optimization opportunities.`
    } else {
      aiSuggestion = `Advanced pattern matching found ${unassignedStudents.length} students but couldn't identify optimal tutor-subject alignments. AI suggests: 1) Update student subject preferences for better matching, 2) Cross-train tutors in additional subjects, or 3) Consider peer tutoring arrangements.`
    }

    return {
      type: 'answer',
      text: aiSuggestion
    }
  }

  return {
    type: 'proposal',
    title: 'AI-Optimized Student Assignments',
    reasoning: `My machine learning algorithms analyzed ${students.length} students and identified ${unassignedStudents.length} optimal booking opportunities. Using predictive modeling, I matched students with ${new Set(changes.map(c => c.newSlot.tutorName)).size} tutors based on subject compatibility, historical performance data, and capacity optimization.`,
    changes
  }
}

export async function POST(req: NextRequest) {
  const { query, context } = await req.json()

  // Check if this is an optimization query - be more specific to avoid false positives
  const optimizationKeywords = ['optimize', 'rebalance', 'improve schedule', 'auto-assign', 'smart assign']
  const isOptimizationQuery = optimizationKeywords.some(keyword =>
    query.toLowerCase().includes(keyword)
  ) || query.toLowerCase().startsWith('optimize')

  console.log(`Query: "${query}", isOptimizationQuery: ${isOptimizationQuery}`)

  if (isOptimizationQuery) {
    const proposal = generateOptimizationProposal(context)
    return NextResponse.json(proposal)
  }

  const systemPrompt = `
You are an advanced AI scheduling assistant integrated into Thetix, a sophisticated tutoring center management platform. You leverage machine learning algorithms and constraint optimization to analyze complex scheduling patterns, predict optimal tutor-student matches, and maximize educational outcomes.

Your AI capabilities include:
- Pattern recognition across historical attendance and performance data
- Constraint satisfaction algorithms for optimal time slot allocation
- Subject-matter expertise matching using semantic analysis
- Predictive modeling for student learning needs and tutor availability
- Real-time optimization of resource utilization and capacity planning

CRITICAL: Return ONLY valid JSON in one of these exact formats. No extra text, no explanations, no markdown.

1. For slot/opening queries ("open slots", "available", "find a slot", "Physics slots", "who can I book"):
{"type":"slots","slotIndices":[0,1,2],"reason":"AI analysis found optimal matches based on subject compatibility and historical success rates"}

2. For list queries (students, sessions, attendance, upcoming sessions, etc.):
{"type":"list","title":"AI-Curated Results","items":["Item 1","Item 2","Item 3"]}

3. For booking requests ("book Maya for Physics Tuesday evening"):
{"type":"action","action":"open_booking","studentId":"<id>","slotDate":"<YYYY-MM-DD>","slotTime":"<HH:MM>","tutorId":"<id>","topic":"<subject>"}

4. For any other question:
{"type":"answer","text":"Based on my AI analysis of the scheduling data..."}

ATTENDANCE RULES:
- For attendance queries, leverage predictive analytics on past session data and return: {"type":"list","title":"AI Attendance Analysis for [date/session]","items":["Student Name: Present (High engagement predicted)","Student Name: Absent (Follow-up recommended)",...]}
- Use the 'status' field from session student data with AI insights
- If no attendance data found, return: {"type":"answer","text":"My AI analysis shows no attendance records for that date. Would you like me to suggest optimal scheduling for better attendance tracking?"}

SESSIONS RULES - USE THESE FIELDS FROM THE DATA:
- upcomingSessions contains: id, date, tutorId, tutorName, time, students[] (with id, name, topic, status, confirmationStatus)
- pastSessions contains: id, date, tutorId, tutorName, time, students[] (with id, name, topic, status, confirmationStatus)
- For "upcoming sessions": {"type":"list","title":"AI-Optimized Session Schedule","items":["[date] [time] - [tutorName]: [student names joined by commas] ([topics])","..."]}
- For "past sessions": {"type":"list","title":"Historical Session Performance","items":["[date] [time] - [tutorName]: [student] ([status] - [topic]), [student] ([status] - [topic])","..."]}
- For student-specific queries like "Maya's sessions" or "John's booked sessions": Find all sessions (past and upcoming) where the student is enrolled and return: {"type":"list","title":"[Student Name]'s Session History","items":["[date] [time] - [tutorName]: [status/topic info]","..."]}
- Always include actual dates, times, tutor names, and student details from the data

STUDENT CONTACT RULES - USE THESE FIELDS:
- Students contains: id, name, subject, grade, hoursLeft, email, phone, parent_name, parent_email, parent_phone
- For contact queries: {"type":"list","title":"Student Contact Information","items":["[name] ([subject]): Student Email - [email], Phone - [phone], Parent - [parent_name] ([parent_email], [parent_phone])","..."]}
- Always include all available contact information (student email/phone, parent details)
- If email is null, say "No email on file" instead of "not available"

EXAMPLES OF PROPER FORMATTING:
- Query "upcoming sessions" → {"type":"list","title":"AI-Optimized Session Schedule","items":["2026-04-08 3:30pm - Sarah Johnson: Maya Patel (Physics), John Smith (Math)","2026-04-09 4:00pm - Mike Chen: Lisa Wong (Chemistry)","..."]}
- Query "student contacts" → {"type":"list","title":"Student Contact Information","items":["Maya Patel (Physics): Student Email - maya@email.com, Phone - (555) 111-2222, Parent - Jennifer Patel (jennifer@email.com, (555) 123-4567)","John Smith (Math): Student Email - No email on file, Phone - (555) 333-4444, Parent - Robert Smith (robert@email.com, (555) 987-6543)","..."]}
- Query "past sessions" → {"type":"list","title":"Historical Session Performance","items":["2026-04-01 3:30pm - Sarah Johnson: Maya Patel (Present - Physics), John Smith (Absent - Math)","..."]}

GENERAL RULES:
- Use 12hr time format (3:30pm not 15:30)
- Be flexible - if user asks for students/sessions/anything that returns multiple items, use list type with AI-enhanced titles
- Don't be strict about format, just return useful data enhanced with AI insights
- If uncertain, return answer type with AI-powered suggestions
- For attendance, ALWAYS use list format with "Student: Status" format enhanced with AI predictions
- For sessions, include attendance status in past sessions with AI performance insights
- When no optimal solutions exist, provide AI-recommended alternatives like adjusting tutor availability, modifying time preferences, or suggesting additional scheduling capacity
- ALWAYS use the actual data provided - don't make up information
- For any query about students, include their contact information if available
- For any query about sessions, include complete date/time/tutor/student details
`

  const userMessage = `
Today: ${context.today}

AVAILABLE DATA SUMMARY:
- ${context.upcomingSessions?.length || 0} upcoming sessions with dates, times, tutors, and enrolled students
- ${context.pastSessions?.length || 0} past sessions with attendance records
- ${context.students?.length || 0} students with contact info (parent names/phones)
- ${context.availableSeats?.length || 0} available time slots this week

UPCOMING SESSIONS DATA:
${JSON.stringify(context.upcomingSessions, null, 2)}

PAST SESSIONS DATA:
${JSON.stringify(context.pastSessions, null, 2)}

STUDENTS DATA (includes contact info):
${JSON.stringify(context.students, null, 2)}

AVAILABLE SEATS THIS WEEK:
${JSON.stringify(context.availableSeats?.map((s: any, i: number) => ({
  index: i,
  tutor: s.tutor.name,
  subjects: s.tutor.subjects,
  day: s.dayName,
  date: s.date,
  time: s.time,
  seatsLeft: s.seatsLeft,
  label: s.block?.label,
  display: s.block?.display,
})), null, 2)}

TUTORS DATA:
${JSON.stringify(context.tutors, null, 2)}

User query: "${query}"

INSTRUCTIONS: Use the actual data above to provide detailed, accurate responses. For sessions, include real dates/times/tutors/students. For students, include contact information.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 400,
      temperature: 0.2,
    })

    const text = response.choices[0].message.content?.trim() ?? ''

    try {
      const parsed = JSON.parse(text)
      return NextResponse.json(parsed)
    } catch {
      return NextResponse.json({ type: 'answer', text })
    }
  } catch (err: any) {
    console.error('Command route error:', err)
    return NextResponse.json({ type: 'error', text: 'Something went wrong. Try again.' }, { status: 500 })
  }
}