import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { DB, withCenter, withCenterPayload } from '@/lib/db';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const EMAIL_SEND_MODE = (process.env.EMAIL_SEND_MODE ?? 'redirect').toLowerCase();
const TEST_RECIPIENT = process.env.EMAIL_TEST_RECIPIENT?.trim() || process.env.GOOGLE_EMAIL?.trim() || null;

type DeliveryMode = 'live' | 'redirect' | 'disabled';

function getDeliveryGuard(): { mode: DeliveryMode; redirectTo: string | null } {
  if (EMAIL_SEND_MODE === 'live') return { mode: 'live', redirectTo: null };
  if (EMAIL_SEND_MODE === 'disabled') return { mode: 'disabled', redirectTo: null };
  return { mode: 'redirect', redirectTo: TEST_RECIPIENT };
}

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GOOGLE_EMAIL, pass: process.env.GOOGLE_APP_PASSWORD },
  });
}

function applyTemplate(template: string, tokens: Record<string, string>): string {
  return template.replace(/{{\s*(name|link|term|center)\s*}}/gi, (_, key: string) => tokens[key.toLowerCase()] ?? '');
}

function buildAnnouncementHtml(
  centerName: string,
  recipientName: string,
  bodyText: string,
  availabilityLink: string,
  centerPhone?: string | null
): string {
  const BRAND = '#0f172a';
  const safeBody = bodyText.replace(/\n/g, '<br>').trim();
  const linkSection = availabilityLink
    ? `<table cellpadding="0" cellspacing="0" style="margin:24px 0 0;"><tr>
        <td style="border-radius:8px;background:${BRAND};">
          <a href="${availabilityLink}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;color:white;text-decoration:none;border-radius:8px;">Submit Availability →</a>
        </td>
      </tr></table>
      <p style="margin:14px 0 0;font-size:11px;color:#9ca3af;">If the button doesn't work: <a href="${availabilityLink}" style="color:${BRAND};">${availabilityLink}</a></p>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:ui-sans-serif,system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
  <tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:white;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <tr><td style="background:${BRAND};padding:20px 28px;">
      <p style="margin:0;font-size:18px;font-weight:800;color:white;">${centerName}</p>
      <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.75);">Announcement</p>
    </td></tr>
    <tr><td style="padding:28px;">
      <p style="margin:0 0 16px;font-size:15px;color:#111827;line-height:1.65;">${safeBody}</p>
      ${linkSection}
    </td></tr>
    <tr><td style="padding:16px 28px;background:#f9fafb;border-top:1px solid #f3f4f6;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">— ${centerName}</p>
      ${centerPhone ? `<p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">Please do not reply to this email — call us at <a href="tel:${centerPhone}" style="color:#9ca3af;">${centerPhone}</a>.</p>` : `<p style="margin:4px 0 0;font-size:11px;color:#f59e0b;font-weight:600;">⚠ No phone number set — please add one in center settings.</p>`}
    </td></tr>
  </table>
  </td></tr>
</table>
</body></html>`;
}

export async function POST(req: NextRequest) {
  try {
    const { studentIds, termId, subject, body, baseUrl } = await req.json();

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ error: 'No student IDs provided.' }, { status: 400 });
    }
    if (!subject || !body) {
      return NextResponse.json({ error: 'subject and body are required.' }, { status: 400 });
    }

    // Load center settings for center name
    const { data: settingsData } = await withCenter(
      supabase.from(DB.centerSettings).select('center_name, center_email, center_phone').limit(1)
    ).maybeSingle();
    const centerName: string = settingsData?.center_name ?? 'Tutoring Center';
    const centerEmail: string | null = settingsData?.center_email ?? null;
    const centerPhone: string | null = settingsData?.center_phone ?? null;

    // Load term name (optional)
    let termName = '';
    if (termId) {
      const { data: termData } = await supabase
        .from(DB.terms)
        .select('name')
        .eq('id', termId)
        .maybeSingle();
      termName = termData?.name ?? '';
    }

    // Load students
    const { data: students, error: studentsError } = await withCenter(
      supabase.from(DB.students).select('id, name, email, mom_email, dad_email').in('id', studentIds)
    );
    if (studentsError) {
      return NextResponse.json({ error: studentsError.message }, { status: 500 });
    }

    const bodyBaseUrl = typeof baseUrl === 'string' ? baseUrl.trim() : '';
    const requestOrigin = req.nextUrl?.origin?.trim() ?? '';
    const appBaseUrl = bodyBaseUrl || requestOrigin || (process.env.NEXT_PUBLIC_BASE_URL ?? '').trim();

    if (termId && !appBaseUrl) {
      return NextResponse.json({ error: 'Could not determine app base URL for enrollment links.' }, { status: 500 });
    }

    const guard = getDeliveryGuard();

    if (guard.mode === 'disabled') {
      return NextResponse.json({ sent: 0, failed: 0, errors: [], skipped: true, reason: 'Email sending is disabled (EMAIL_SEND_MODE=disabled).', mode: 'disabled' });
    }

    if (guard.mode === 'redirect' && !guard.redirectTo) {
      return NextResponse.json({ error: 'EMAIL_TEST_RECIPIENT or GOOGLE_EMAIL must be set for redirect mode.' }, { status: 500 });
    }

    const transporter = getTransporter();
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    const details: { name: string; to: string }[] = [];
    const failedDetails: { name: string; to: string; error: string }[] = [];

    for (const student of students ?? []) {
      const recipientName: string = student.name ?? 'Student';
      const emails: string[] = [student.email, student.mom_email, student.dad_email].filter(Boolean) as string[];

      if (emails.length === 0) continue;

      let availabilityLink = '';

      if (termId) {
        const token = crypto.randomUUID();
        const { data: existingEnrollment, error: existingError } = await withCenter(
          supabase.from(DB.termEnrollments).select('id').eq('student_id', student.id).eq('term_id', termId).maybeSingle()
        );
        if (existingError) {
          failed++;
          if (errors.length < 5) errors.push(`${recipientName}: failed to prepare enrollment token (${existingError.message})`);
          continue;
        }

        if (existingEnrollment?.id) {
          const { error: updateError } = await withCenter(
            supabase.from(DB.termEnrollments).update({ form_token: token }).eq('id', existingEnrollment.id)
          );
          if (updateError) {
            failed++;
            if (errors.length < 5) errors.push(`${recipientName}: failed to update enrollment token (${updateError.message})`);
            continue;
          }
        } else {
          const { error: insertError } = await supabase.from(DB.termEnrollments).insert(withCenterPayload({
            student_id: student.id,
            term_id: termId,
            subjects: [],
            availability_blocks: [],
            hours_purchased: 0,
            form_token: token,
          }));
          if (insertError) {
            failed++;
            if (errors.length < 5) errors.push(`${recipientName}: failed to create enrollment row (${insertError.message})`);
            continue;
          }
        }

        availabilityLink = `${appBaseUrl}/enroll?token=${token}`;
      }

      const resolvedSubject = applyTemplate(subject, {
        name: recipientName,
        link: availabilityLink,
        term: termName,
        center: centerName,
      });
      const resolvedBody = applyTemplate(body, {
        name: recipientName,
        link: availabilityLink,
        term: termName,
        center: centerName,
      });
      const html = buildAnnouncementHtml(centerName, recipientName, resolvedBody, availabilityLink, centerPhone);

      const to = guard.mode === 'live' ? emails.join(', ') : guard.redirectTo!;

      try {
        await transporter.sendMail({
          from: `"${centerName}" <${process.env.GOOGLE_EMAIL}>`,
          replyTo: centerEmail ?? undefined,
          to,
          subject: resolvedSubject,
          text: resolvedBody,
          html,
        });
        sent++;
        details.push({ name: recipientName, to });
      } catch (e: any) {
        failed++;
        const msg: string = e?.message ?? 'Unknown error';
        if (errors.length < 5) errors.push(`${recipientName}: ${msg}`);
        failedDetails.push({ name: recipientName, to, error: msg });
      }
    }

    return NextResponse.json({
      sent,
      failed,
      errors,
      failedDetails,
      mode: guard.mode,
      redirectedTo: guard.mode === 'redirect' ? guard.redirectTo : null,
      details,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Internal server error.' }, { status: 500 });
  }
}
