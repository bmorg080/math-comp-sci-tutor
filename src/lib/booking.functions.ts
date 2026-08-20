import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateSlots, type AvailabilityRule } from "@/lib/domain/slots";
import { createBooking } from "@/lib/booking.core";

export const listOpenSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number }) =>
    z.object({ days: z.number().int().min(1).max(60).default(21) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Settings holds the tutor's email/zoom link, so read it through the
    // service role (lets us drop the authenticated settings-read policy).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("tutor_timezone, weekly_availability")
      .eq("id", 1)
      .maybeSingle();
    if (!settings) throw new Error("Settings not configured");

    const tz = settings.tutor_timezone;
    const rules = (settings.weekly_availability ?? []) as AvailabilityRule[];

    const now = new Date();
    const horizon = new Date(now.getTime() + data.days * 24 * 60 * 60 * 1000);

    // Read booked lessons globally so availability reflects every account's
    // bookings (matches the public browse route and the unique index on
    // scheduled starts_at), not just this customer's own lessons.
    const { data: booked } = await supabaseAdmin
      .from("lessons")
      .select("starts_at")
      .in("status", ["scheduled", "completed"])
      .gte("starts_at", now.toISOString())
      .lte("starts_at", horizon.toISOString());

    const available = generateSlots({
      rules,
      timeZone: tz,
      now,
      days: data.days,
      booked: (booked ?? []).map((b) => b.starts_at),
    });

    return { slots: available, tutorTimezone: tz };
  });

export const bookLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { subjectId: string; studentId: string; startsAtISO: string }) =>
    z
      .object({
        subjectId: z.string().uuid(),
        studentId: z.string().uuid(),
        startsAtISO: z.string().datetime(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Sensitive writes (lesson insert + credit consume) run through the service
    // role so user-side RLS write policies can stay admin-only. This blocks
    // direct Data API tampering with price/status/credits. createBooking still
    // validates account + student ownership internally.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await createBooking(supabaseAdmin as any, userId, data);
    if (!result.ok) {
      return { ok: false as const, needsPayment: true, priceCents: result.priceCents };
    }
    const { accountId, lessonId } = result;
    const lesson = { id: lessonId };
    const startsAt = new Date(data.startsAtISO).toISOString();


    // Try Google Calendar first; if it succeeds, Google emails the invite
    // (with the Zoom link) to the tutor and every attendee, and we skip
    // the Lovable confirmation emails to avoid double-sending.
    let googleSynced = false;
    try {
      const { createCalendarEvent, loadLessonForCalendar } = await import(
        "@/lib/calendar.server"
      );
      const payload = await loadLessonForCalendar(supabase as any, lesson.id);
      if (payload) {
        const eventId = await createCalendarEvent(payload);
        if (eventId) {
          await supabaseAdmin
            .from("lessons")
            .update({ google_event_id: eventId })
            .eq("id", lesson.id);
          googleSynced = true;
        }
      }
    } catch (e) {
      console.error("[booking] calendar sync error:", e);
    }

    // Fallback: send Lovable confirmation emails only when Google Calendar
    // did not send an invite for us.
    if (!googleSynced) {
      try {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        const [{ data: settings }, { data: studentRow }, { data: subjectRow }, { data: accountRow }, { data: authUser }] =
          await Promise.all([
            supabaseAdmin
              .from("settings")
              .select("zoom_link, tutor_name, tutor_email, tutor_timezone")
              .eq("id", 1)
              .maybeSingle(),
            supabase.from("students").select("name, email").eq("id", data.studentId).maybeSingle(),
            supabase.from("subjects").select("name").eq("id", data.subjectId).maybeSingle(),
            supabase.from("accounts").select("timezone, display_name").eq("id", accountId).maybeSingle(),
            supabase.auth.getUser(),
          ]);

        const studentName = studentRow?.name ?? "Student";
        const studentEmail = studentRow?.email ?? null;
        const subjectName = subjectRow?.name ?? "Lesson";
        const zoomLink = settings?.zoom_link ?? "";
        const tutorTZ = settings?.tutor_timezone ?? "UTC";
        const tutorEmail = settings?.tutor_email;
        const tutorName = settings?.tutor_name ?? "Tutor";
        const customerTZ = accountRow?.timezone ?? tutorTZ;
        const parentEmail = authUser?.user?.email;
        const parentName =
          (authUser?.user?.user_metadata as { full_name?: string } | undefined)?.full_name ??
          accountRow?.display_name ??
          "there";

        const fmt = (tz: string) =>
          new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            weekday: "long",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          }).format(new Date(startsAt));

        const customerTemplateData = {
          studentName,
          subjectName,
          whenForOther: fmt(tutorTZ),
          otherLabel: "Tutor's time",
          zoomLink,
          isTutor: false,
          whenForRecipient: fmt(customerTZ),
        };

        if (parentEmail) {
          await sendTemplateEmail("lesson-confirmation", parentEmail, {
            idempotencyKey: `lesson-confirm-parent-${lesson.id}`,
            templateData: { ...customerTemplateData, recipientName: parentName },
          }).catch((e) => console.error("[booking] parent email failed:", e));
        }

        if (studentEmail && studentEmail !== parentEmail) {
          await sendTemplateEmail("lesson-confirmation", studentEmail, {
            idempotencyKey: `lesson-confirm-student-${lesson.id}`,
            templateData: { ...customerTemplateData, recipientName: studentName },
          }).catch((e) => console.error("[booking] student email failed:", e));
        }

        if (tutorEmail) {
          await sendTemplateEmail("lesson-confirmation", tutorEmail, {
            idempotencyKey: `lesson-confirm-tutor-${lesson.id}`,
            templateData: {
              recipientName: tutorName,
              studentName,
              subjectName,
              whenForRecipient: fmt(tutorTZ),
              whenForOther: fmt(customerTZ),
              otherLabel: "Student's time",
              zoomLink,
              isTutor: true,
            },
          }).catch((e) => console.error("[booking] tutor email failed:", e));
        }
      } catch (e) {
        console.error("[booking] email dispatch error:", e);
      }
    }

    return { ok: true as const, lessonId: lesson.id, googleSynced };
  });
