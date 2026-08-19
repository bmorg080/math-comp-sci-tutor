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
    const { data: settings } = await supabase
      .from("settings")
      .select("tutor_timezone, weekly_availability")
      .eq("id", 1)
      .maybeSingle();
    if (!settings) throw new Error("Settings not configured");

    const tz = settings.tutor_timezone;
    const rules = (settings.weekly_availability ?? []) as AvailabilityRule[];

    const now = new Date();
    const horizon = new Date(now.getTime() + data.days * 24 * 60 * 60 * 1000);

    const { data: booked } = await supabase
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

    // All the account / conflict / credit rules live in booking.core.ts so they
    // can be unit tested; only the side effects below stay here.
    const result = await createBooking(supabase, userId, data);
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
          await supabase
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
            supabase
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
