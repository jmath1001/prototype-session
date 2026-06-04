import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { DB, withCenter, getCenterId } from "@/lib/db";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EMAIL_SEND_MODE = (process.env.EMAIL_SEND_MODE ?? "redirect").toLowerCase();
const TEST_RECIPIENT = process.env.EMAIL_TEST_RECIPIENT?.trim() || process.env.GOOGLE_EMAIL?.trim() || null;

type DeliveryMode = "live" | "redirect" | "disabled";

function getDeliveryGuard(): { mode: DeliveryMode; redirectTo: string | null } {
  if (EMAIL_SEND_MODE === "live") return { mode: "live", redirectTo: null };
  if (EMAIL_SEND_MODE === "disabled") return { mode: "disabled", redirectTo: null };
  return { mode: "redirect", redirectTo: TEST_RECIPIENT };
}

function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GOOGLE_EMAIL,
      pass: process.env.GOOGLE_APP_PASSWORD,
    },
  });
}

const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function fmt12(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${suffix}`;
}

function fmtWeekRange(weekStart: string, weekEnd: string): string {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(`${weekEnd}T00:00:00`);
  const startFmt = start.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const endFmt = end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return `${startFmt} – ${endFmt}`;
}

type SessionEntry = {
  session_date: string;
  time: string;
  topic: string;
  tutor_name: string;
};

function buildWeeklyStudentScheduleHtml(
  centerName: string,
  studentName: string,
  weekLabel: string,
  sessions: SessionEntry[],
  centerPhone?: string | null
): string {
  const BRAND = "#0f172a";

  const rows = sessions
    .sort((a, b) => a.session_date.localeCompare(b.session_date) || a.time.localeCompare(b.time))
    .map((s) => {
      const date = new Date(`${s.session_date}T00:00:00`);
      const dayLabel = DOW_NAMES[date.getDay()] ?? "";
      const dateFmt = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `<tr>
        <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#111827;white-space:nowrap;border-right:1px solid #f3f4f6;">${dayLabel}</td>
        <td style="padding:10px 14px;font-size:13px;color:#374151;white-space:nowrap;border-right:1px solid #f3f4f6;">${dateFmt}</td>
        <td style="padding:10px 14px;font-size:13px;color:#374151;white-space:nowrap;border-right:1px solid #f3f4f6;">${fmt12(s.time)}</td>
        <td style="padding:10px 14px;font-size:13px;color:#374151;border-right:1px solid #f3f4f6;">${s.topic || "—"}</td>
        <td style="padding:10px 14px;font-size:13px;color:#6b7280;white-space:nowrap;">${s.tutor_name}</td>
      </tr>`;
    })
    .join("");

  const tableBody =
    rows ||
    `<tr><td colspan="5" style="padding:14px;font-size:12px;color:#9ca3af;font-style:italic;">No sessions scheduled this week.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:white;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
      <tr><td style="background:${BRAND};padding:20px 28px;">
        <p style="margin:0;font-size:18px;font-weight:800;color:white;">${centerName}</p>
        <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.7);">Your Schedule — ${weekLabel}</p>
      </td></tr>
      <tr><td style="padding:28px;">
        <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#111827;">Hi ${studentName},</p>
        <p style="margin:0 0 24px;font-size:13px;color:#6b7280;">
          Here is your confirmed tutoring schedule for the week of <strong>${weekLabel}</strong>.
        </p>
        <div style="overflow-x:auto;">
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:8px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;text-align:left;border-right:1px solid #e5e7eb;">Day</th>
                <th style="padding:8px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;text-align:left;border-right:1px solid #e5e7eb;">Date</th>
                <th style="padding:8px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;text-align:left;border-right:1px solid #e5e7eb;">Time</th>
                <th style="padding:8px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;text-align:left;border-right:1px solid #e5e7eb;">Subject</th>
                <th style="padding:8px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;text-align:left;">Tutor</th>
              </tr>
            </thead>
            <tbody>
              ${tableBody}
            </tbody>
          </table>
        </div>
      </td></tr>
      <tr><td style="padding:16px 28px;background:#f9fafb;border-top:1px solid #f3f4f6;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">— ${centerName}</p>
        ${centerPhone ? `<p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">Please do not reply to this email — call us at <a href="tel:${centerPhone}" style="color:#9ca3af;">${centerPhone}</a>.</p>` : `<p style="margin:4px 0 0;font-size:11px;color:#f59e0b;font-weight:600;">⚠ No phone number set — please add one in center settings.</p>`}
      </td></tr>
    </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentIds, weekStart } = body as { studentIds: unknown; weekStart: unknown };

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ error: "No student IDs provided." }, { status: 400 });
    }
    if (typeof weekStart !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json({ error: "weekStart (YYYY-MM-DD) is required." }, { status: 400 });
    }

    const safeIds = (studentIds as unknown[]).filter(
      (id): id is string => typeof id === "string" && id.length > 0
    );

    const guard = getDeliveryGuard();
    if (guard.mode === "disabled") {
      return NextResponse.json({
        sent: 0, failed: 0, errors: [],
        skipped: true, reason: "Email sending is disabled (EMAIL_SEND_MODE=disabled).",
        mode: "disabled",
      });
    }
    if (guard.mode === "redirect" && !guard.redirectTo) {
      return NextResponse.json(
        { error: "EMAIL_TEST_RECIPIENT or GOOGLE_EMAIL must be set for redirect mode." },
        { status: 500 }
      );
    }

    // Compute week end (6 days after weekStart)
    const weekStartDate = new Date(`${weekStart}T00:00:00`);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = weekEndDate.toISOString().slice(0, 10);
    const weekLabel = fmtWeekRange(weekStart, weekEnd);

    // Load center settings
    const { data: settingsData } = await withCenter(
      supabase.from(DB.centerSettings).select("center_name, center_email, center_phone").limit(1)
    ).maybeSingle();
    const centerName: string = settingsData?.center_name ?? "Tutoring Center";
    const centerEmail: string | null = settingsData?.center_email ?? null;
    const centerPhone: string | null = settingsData?.center_phone ?? null;

    // Load students
    const { data: students, error: studentsError } = await withCenter(
      supabase
        .from(DB.students)
        .select("id, name, email, mom_email, dad_email")
        .in("id", safeIds)
    );
    if (studentsError) {
      return NextResponse.json({ error: studentsError.message }, { status: 500 });
    }

    // Load sessions for the week for the given students
    const { data: sessionStudentRows, error: sessionError } = await withCenter(
      supabase
        .from(DB.sessionStudents)
        .select(`student_id, topic, status, ${DB.sessions}!inner(id, session_date, time, tutor_id)`)
        .in("student_id", safeIds)
        .neq("status", "cancelled")
        .gte(`${DB.sessions}.session_date`, weekStart)
        .lte(`${DB.sessions}.session_date`, weekEnd)
    );
    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }

    // Build tutor name map
    const tutorIds = [
      ...new Set(
        (sessionStudentRows ?? [])
          .map((r: any) => {
            const sess = Array.isArray(r[DB.sessions]) ? r[DB.sessions][0] : r[DB.sessions];
            return sess?.tutor_id as string | undefined;
          })
          .filter(Boolean) as string[]
      ),
    ];
    let tutorMap: Record<string, string> = {};
    if (tutorIds.length > 0) {
      const { data: tutors } = await withCenter(
        supabase.from(DB.tutors).select("id, name").in("id", tutorIds)
      );
      for (const t of tutors ?? []) {
        tutorMap[t.id] = t.name ?? "—";
      }
    }

    const transporter = getTransporter();
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    const redirectedTo = guard.mode === "redirect" ? guard.redirectTo : null;
    const details: { name: string; to: string }[] = [];
    const centerId = getCenterId();
    const logRows: object[] = [];

    for (const student of students ?? []) {
      const emails: string[] = [student.email, student.mom_email, student.dad_email].filter(Boolean) as string[];
      if (emails.length === 0) continue;

      const studentSessions: SessionEntry[] = (sessionStudentRows ?? [])
        .filter((r: any) => r.student_id === student.id)
        .map((r: any) => {
          const sess = Array.isArray(r[DB.sessions]) ? r[DB.sessions][0] : r[DB.sessions];
          return {
            session_date: sess?.session_date ?? "",
            time: sess?.time ?? "",
            topic: r.topic ?? "",
            tutor_name: tutorMap[sess?.tutor_id] ?? "—",
          };
        })
        .filter((s: SessionEntry) => s.session_date);

      if (studentSessions.length === 0) continue;

      const html = buildWeeklyStudentScheduleHtml(
        centerName,
        student.name ?? "Student",
        weekLabel,
        studentSessions,
        centerPhone
      );
      const subject = `Your tutoring schedule for the week of ${weekLabel}`;
      const toAddresses = guard.mode === "live" ? emails : [guard.redirectTo!];

      try {
        await transporter.sendMail({
          from: `"${centerName}" <${process.env.GOOGLE_EMAIL}>`,
          replyTo: centerEmail ?? undefined,
          to: toAddresses.join(", "),
          subject,
          html,
        });
        sent++;
        details.push({ name: student.name ?? student.id, to: toAddresses.join(", ") });
        logRows.push({
          center_id: centerId,
          student_id: student.id,
          student_name: student.name ?? "",
          term_id: null,
          term_name: `Week of ${weekLabel}`,
          emailed_to: toAddresses.join(", "),
          status: "sent",
        });
      } catch (err: any) {
        failed++;
        const errMsg = err?.message ?? "send failed";
        errors.push(`${student.name ?? student.id}: ${errMsg}`);
        logRows.push({
          center_id: centerId,
          student_id: student.id,
          student_name: student.name ?? "",
          term_id: null,
          term_name: `Week of ${weekLabel}`,
          emailed_to: toAddresses.join(", "),
          status: "failed",
          error: errMsg,
        });
      }
    }

    if (logRows.length > 0) {
      await supabase.from(DB.studentScheduleLogs).insert(logRows);
    }

    return NextResponse.json({ sent, failed, errors, mode: guard.mode, redirectedTo, details });
  } catch (err: any) {
    console.error("send-weekly-student-schedule error:", err);
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
  }
}
