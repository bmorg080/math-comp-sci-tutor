// Shared helper for sending cancel/reschedule notifications to both parties.
// Called best-effort — failures are logged and swallowed by callers.
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

interface SupabaseLike {
  from: (table: string) => any;
  auth: { admin: { getUserById: (id: string) => Promise<any> } };
}

function fmt(tz: string, iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(new Date(iso));
}

export async function sendLessonUpdateEmails(opts: {
  supabaseAdmin: SupabaseLike;
  lessonId: string;
  kind: "cancelled" | "rescheduled";
  // For cancel: former starts_at. For reschedule: the NEW starts_at.
  startsAtISO: string;
  // Reschedule-only: the previous starts_at (in UTC ISO).
  previousStartsAtISO?: string;
  refunded?: boolean;
  lateCancel?: boolean;
  reason?: string;
}) {
  const { supabaseAdmin, lessonId, kind } = opts;

  try {
    const { data: lesson } = await supabaseAdmin
      .from("lessons")
      .select(
        "id, account_id, student_id, subject_id, student:students(name, email), subject:subjects(name), account:accounts(id, display_name, timezone)",
      )
      .eq("id", lessonId)
      .maybeSingle();
    if (!lesson) return;

    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("zoom_link, tutor_name, tutor_email, tutor_timezone")
      .eq("id", 1)
      .maybeSingle();

    // Find the primary account member (parent) email
    const { data: member } = await supabaseAdmin
      .from("account_members")
      .select("email")
      .eq("account_id", lesson.account_id)
      .limit(1)
      .maybeSingle();

    const studentName = lesson.student?.name ?? "Student";
    const studentEmail: string | undefined = lesson.student?.email ?? undefined;
    const subjectName = lesson.subject?.name ?? "Lesson";
    const customerTZ = lesson.account?.timezone ?? settings?.tutor_timezone ?? "UTC";
    const tutorTZ = settings?.tutor_timezone ?? "UTC";
    const tutorEmail = settings?.tutor_email;
    const tutorName = settings?.tutor_name ?? "Tutor";
    const parentEmail = member?.email;
    const parentName = lesson.account?.display_name ?? "there";
    const zoomLink = settings?.zoom_link ?? "";

    const whenCustomer = fmt(customerTZ, opts.startsAtISO);
    const whenTutor = fmt(tutorTZ, opts.startsAtISO);
    const prevCustomer = opts.previousStartsAtISO ? fmt(customerTZ, opts.previousStartsAtISO) : undefined;
    const prevTutor = opts.previousStartsAtISO ? fmt(tutorTZ, opts.previousStartsAtISO) : undefined;

    const baseKey = `lesson-${kind}-${lessonId}${opts.previousStartsAtISO ? `-${new Date(opts.startsAtISO).getTime()}` : ""}`;

    const customerTemplateData = {
      kind,
      studentName,
      subjectName,
      whenForRecipient: whenCustomer,
      whenForOther: whenTutor,
      otherLabel: "Tutor's time",
      previousWhenForRecipient: prevCustomer,
      refunded: opts.refunded,
      lateCancel: opts.lateCancel,
      reason: opts.reason,
      zoomLink,
      isTutor: false,
    };

    if (parentEmail) {
      await sendTemplateEmail("lesson-update", parentEmail, {
        idempotencyKey: `${baseKey}-parent`,
        templateData: { ...customerTemplateData, recipientName: parentName },
      }).catch((e) => console.error("[lesson-update] parent email failed:", e));
    }

    if (studentEmail && studentEmail !== parentEmail) {
      await sendTemplateEmail("lesson-update", studentEmail, {
        idempotencyKey: `${baseKey}-student`,
        templateData: { ...customerTemplateData, recipientName: studentName },
      }).catch((e) => console.error("[lesson-update] student email failed:", e));
    }

    if (tutorEmail) {
      await sendTemplateEmail("lesson-update", tutorEmail, {
        idempotencyKey: `${baseKey}-tutor`,
        templateData: {
          kind,
          recipientName: tutorName,
          studentName,
          subjectName,
          whenForRecipient: whenTutor,
          whenForOther: whenCustomer,
          otherLabel: "Student's time",
          previousWhenForRecipient: prevTutor,
          refunded: opts.refunded,
          lateCancel: opts.lateCancel,
          reason: opts.reason,
          zoomLink,
          isTutor: true,
        },
      }).catch((e) => console.error("[lesson-update] tutor email failed:", e));
    }
  } catch (e) {
    console.error("[lesson-update] dispatch error:", e);
  }
}
