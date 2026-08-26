import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cancelLesson, rescheduleLesson } from "@/lib/lessons.core";

export const listMyLessons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Settings holds tutor email/zoom link — read via the service role so the
    // authenticated settings-read policy can be dropped.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!member?.account_id) return { upcoming: [], past: [], zoomLink: "", cancellationHours: 24 };

    const { data: lessons } = await supabase
      .from("lessons")
      .select(
        "id, starts_at, duration_minutes, status, cancelled_at, cancellation_reason, student:students(id, name), subject:subjects(id, name)",
      )
      .eq("account_id", member.account_id)
      .order("starts_at", { ascending: false });

    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("zoom_link, cancellation_hours")
      .eq("id", 1)
      .maybeSingle();

    const now = Date.now();
    const rows = lessons ?? [];
    const upcoming = rows
      .filter((l) => l.status === "scheduled" && new Date(l.starts_at).getTime() > now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    const past = rows.filter((l) => !(l.status === "scheduled" && new Date(l.starts_at).getTime() > now));

    return {
      upcoming,
      past,
      zoomLink: settings?.zoom_link ?? "",
      cancellationHours: settings?.cancellation_hours ?? 24,
    };
  });

export const cancelMyLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string; reason?: string }) =>
    z.object({ lessonId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // DB writes (cancel lesson + refund credit) run through the service role so
    // user-side RLS write policies can stay admin-only, blocking direct Data API
    // tampering. cancelLesson validates ownership internally.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { lesson, refunded: refundEligible } = await cancelLesson(
      supabaseAdmin as any,
      userId,
      data,
    );

    // Google Calendar sends the cancellation notice; suppress Lovable email if it succeeds.
    let googleCancelled = false;
    if (lesson.google_event_id) {
      try {
        const { deleteCalendarEvent } = await import("@/lib/calendar.server");
        googleCancelled = await deleteCalendarEvent(lesson.google_event_id);
      } catch (e) {
        console.error("[cancelMyLesson] calendar delete error:", e);
      }
    }

    if (!googleCancelled) {
      try {
        const { sendLessonUpdateEmails } = await import("@/lib/lesson-emails.server");
        await sendLessonUpdateEmails({
          supabaseAdmin: supabaseAdmin as any,
          lessonId: lesson.id,
          kind: "cancelled",
          startsAtISO: lesson.starts_at,
          refunded: refundEligible,
          lateCancel: !refundEligible,
          reason: data.reason,
        });
      } catch (e) {
        console.error("[cancelMyLesson] email dispatch error:", e);
      }
    }

    return { ok: true, refunded: refundEligible };
  });

export const rescheduleMyLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string; startsAtISO: string }) =>
    z
      .object({
        lessonId: z.string().uuid(),
        startsAtISO: z.string().datetime(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // DB writes (update starts_at) run through the service role so user-side
    // RLS write policies can stay admin-only. rescheduleLesson validates ownership.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { lesson, previousStartsAtISO, newStartsAtISO } = await rescheduleLesson(
      supabaseAdmin as any,
      userId,
      data,
    );

    // Update Google Calendar event; Google notifies attendees. If it succeeds,
    // skip the Lovable reschedule email.
    let googleUpdated = false;
    if (lesson.google_event_id) {
      try {
        const { updateCalendarEvent, loadLessonForCalendar } = await import(
          "@/lib/calendar.server"
        );
        // Must use the service role: the settings table (zoom link, tutor name)
        // is not readable by the customer-scoped client after RLS hardening.
        const payload = await loadLessonForCalendar(supabaseAdmin as any, lesson.id);
        if (payload) {
          googleUpdated = await updateCalendarEvent(lesson.google_event_id, payload);
        }
      } catch (e) {
        console.error("[rescheduleMyLesson] calendar update error:", e);
      }
    }

    if (!googleUpdated) {
      try {
        const { sendLessonUpdateEmails } = await import("@/lib/lesson-emails.server");
        await sendLessonUpdateEmails({
          supabaseAdmin: supabaseAdmin as any,
          lessonId: lesson.id,
          kind: "rescheduled",
          startsAtISO: newStartsAtISO,
          previousStartsAtISO,
        });
      } catch (e) {
        console.error("[rescheduleMyLesson] email dispatch error:", e);
      }
    }

    return { ok: true };
  });

export const getLessonConfirmation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string }) =>
    z.object({ lessonId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // RLS scopes this select to the caller's account.
    const { data: lesson } = await supabase
      .from("lessons")
      .select(
        "id, starts_at, duration_minutes, status, google_event_id, student:students(name), subject:subjects(name)",
      )
      .eq("id", data.lessonId)
      .maybeSingle();
    if (!lesson) throw new Error("Lesson not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("zoom_link, tutor_name, tutor_email, cancellation_hours")
      .eq("id", 1)
      .maybeSingle();

    const zoomLink = settings?.zoom_link ?? "";
    const subjectName = (lesson.subject as { name?: string } | null)?.name ?? "Lesson";
    const studentName = (lesson.student as { name?: string } | null)?.name ?? "Student";

    const { buildIcs } = await import("@/lib/ics");
    const ics = buildIcs({
      uid: `lesson-${lesson.id}@brianmorgantutor.com`,
      startsAtISO: new Date(lesson.starts_at).toISOString(),
      durationMinutes: lesson.duration_minutes,
      title: `${subjectName} — ${studentName}`,
      description: `Tutoring session with ${settings?.tutor_name ?? "your tutor"}.${
        zoomLink ? `\nJoin here: ${zoomLink}` : ""
      }`,
      location: zoomLink || undefined,
      organizerEmail: settings?.tutor_email ?? null,
      organizerName: settings?.tutor_name ?? null,
    });

    return {
      lesson: {
        id: lesson.id,
        startsAt: lesson.starts_at,
        durationMinutes: lesson.duration_minutes,
        status: lesson.status,
        subjectName,
        studentName,
        googleSynced: !!lesson.google_event_id,
      },
      zoomLink,
      tutorName: settings?.tutor_name ?? "Your tutor",
      cancellationHours: settings?.cancellation_hours ?? 24,
      ics,
    };
  });
