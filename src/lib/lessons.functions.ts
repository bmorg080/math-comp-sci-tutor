import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyLessons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
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

    const { data: settings } = await supabase
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

    const { data: member } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!member?.account_id) throw new Error("No account found");

    const { data: lesson } = await supabase
      .from("lessons")
      .select("id, account_id, starts_at, status, credit_id, google_event_id")
      .eq("id", data.lessonId)
      .maybeSingle();
    if (!lesson || lesson.account_id !== member.account_id) throw new Error("Lesson not found");
    if (lesson.status !== "scheduled") throw new Error("Lesson is not scheduled");

    const { data: settings } = await supabase
      .from("settings")
      .select("cancellation_hours")
      .eq("id", 1)
      .maybeSingle();
    const cancellationHours = settings?.cancellation_hours ?? 24;

    const hoursUntil = (new Date(lesson.starts_at).getTime() - Date.now()) / (1000 * 60 * 60);
    const refundEligible = hoursUntil >= cancellationHours;
    const reasonSuffix = refundEligible ? "" : " [late cancel — no refund]";

    const { error: updErr } = await supabase
      .from("lessons")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
        cancellation_reason: (data.reason ?? "") + reasonSuffix || null,
      })
      .eq("id", lesson.id);
    if (updErr) throw new Error(updErr.message);

    // Refund credit only when eligible
    if (refundEligible && lesson.credit_id) {
      await supabase
        .from("credits")
        .update({ consumed_lesson_id: null })
        .eq("id", lesson.credit_id);
    }

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
          supabaseAdmin: supabase as any,
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

    const { data: member } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!member?.account_id) throw new Error("No account found");

    const { data: lesson } = await supabase
      .from("lessons")
      .select("id, account_id, starts_at, status, google_event_id")
      .eq("id", data.lessonId)
      .maybeSingle();
    if (!lesson || lesson.account_id !== member.account_id) throw new Error("Lesson not found");
    if (lesson.status !== "scheduled") throw new Error("Only scheduled lessons can be rescheduled");

    const { data: settings } = await supabase
      .from("settings")
      .select("cancellation_hours")
      .eq("id", 1)
      .maybeSingle();
    const cancellationHours = settings?.cancellation_hours ?? 24;
    const hoursUntil = (new Date(lesson.starts_at).getTime() - Date.now()) / 3600000;
    if (hoursUntil < cancellationHours) {
      throw new Error(
        `Lessons can only be rescheduled at least ${cancellationHours} hours in advance. Please contact your tutor.`,
      );
    }

    const newStart = new Date(data.startsAtISO);
    if (isNaN(newStart.getTime())) throw new Error("Invalid time");
    if (newStart.getTime() < Date.now() + 3600000) {
      throw new Error("New time must be at least 1 hour from now");
    }

    // Conflict check
    const { data: conflict } = await supabase
      .from("lessons")
      .select("id")
      .in("status", ["scheduled", "completed"])
      .eq("starts_at", newStart.toISOString())
      .neq("id", lesson.id)
      .maybeSingle();
    if (conflict) throw new Error("That time was just booked. Please pick another.");

    const previousStartsAtISO = lesson.starts_at;
    const { error } = await supabase
      .from("lessons")
      .update({ starts_at: newStart.toISOString(), reminder_sent_at: null })
      .eq("id", lesson.id);
    if (error) throw new Error(error.message);

    // Update Google Calendar event; Google notifies attendees. If it succeeds,
    // skip the Lovable reschedule email.
    let googleUpdated = false;
    if (lesson.google_event_id) {
      try {
        const { updateCalendarEvent, loadLessonForCalendar } = await import(
          "@/lib/calendar.server"
        );
        const payload = await loadLessonForCalendar(supabase as any, lesson.id);
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
          supabaseAdmin: supabase as any,
          lessonId: lesson.id,
          kind: "rescheduled",
          startsAtISO: newStart.toISOString(),
          previousStartsAtISO,
        });
      } catch (e) {
        console.error("[rescheduleMyLesson] email dispatch error:", e);
      }
    }

    return { ok: true };
  });
