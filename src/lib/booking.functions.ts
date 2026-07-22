import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AvailabilityRule = { day: number; start: string; end: string };

function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map((n) => Number(n));
  return { h, m: m ?? 0 };
}

// Format a Date as YYYY-MM-DD in a given timezone.
function ymdInTZ(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const mo = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${mo}-${d}`;
}

function weekdayInTZ(date: Date, timeZone: string): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

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
    const bufferMs = 60 * 60 * 1000; // 1h min lead time
    const earliest = new Date(now.getTime() + bufferMs);
    const horizon = new Date(now.getTime() + data.days * 24 * 60 * 60 * 1000);

    const slots: string[] = [];
    // Iterate day by day starting today in tutor TZ
    for (let i = 0; i < data.days + 1; i++) {
      const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const wd = weekdayInTZ(d, tz);
      const ymd = ymdInTZ(d, tz);
      const rulesForDay = rules.filter((r) => r.day === wd);
      for (const r of rulesForDay) {
        const { h: sh, m: sm } = parseHHMM(r.start);
        const { h: eh, m: em } = parseHHMM(r.end);
        const startMinutes = sh * 60 + sm;
        const endMinutes = eh * 60 + em;
        for (let mins = startMinutes; mins + 60 <= endMinutes; mins += 60) {
          const hh = String(Math.floor(mins / 60)).padStart(2, "0");
          const mm = String(mins % 60).padStart(2, "0");
          const localISO = `${ymd}T${hh}:${mm}:00`;
          const utc = fromZonedTime(localISO, tz);
          if (utc < earliest || utc > horizon) continue;
          slots.push(utc.toISOString());
        }
      }
    }

    // Remove slots already booked
    const { data: booked } = await supabase
      .from("lessons")
      .select("starts_at")
      .in("status", ["scheduled", "completed"])
      .gte("starts_at", now.toISOString())
      .lte("starts_at", horizon.toISOString());
    const taken = new Set((booked ?? []).map((b) => new Date(b.starts_at).toISOString()));
    const available = slots.filter((s) => !taken.has(s)).sort();

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

    // Find caller's account
    const { data: member } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!member?.account_id) throw new Error("No account found");
    const accountId = member.account_id;

    // Verify student is on this account
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("id", data.studentId)
      .eq("account_id", accountId)
      .maybeSingle();
    if (!student) throw new Error("Invalid student");

    // Verify subject exists + get price
    const { data: subject } = await supabase
      .from("subjects")
      .select("id, price_cents, active")
      .eq("id", data.subjectId)
      .maybeSingle();
    if (!subject || !subject.active) throw new Error("Invalid subject");

    const { data: customPrice } = await supabase
      .from("custom_prices")
      .select("price_cents")
      .eq("account_id", accountId)
      .eq("subject_id", data.subjectId)
      .maybeSingle();
    const priceCents = customPrice?.price_cents ?? subject.price_cents;

    // Ensure slot not already taken
    const startsAt = new Date(data.startsAtISO).toISOString();
    const { data: conflict } = await supabase
      .from("lessons")
      .select("id")
      .eq("starts_at", startsAt)
      .in("status", ["scheduled", "completed"])
      .maybeSingle();
    if (conflict) throw new Error("That time was just booked. Please pick another.");

    // Try to consume oldest unexpired unused credit
    const { data: credit } = await supabase
      .from("credits")
      .select("id")
      .eq("account_id", accountId)
      .is("consumed_lesson_id", null)
      .is("refunded_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!credit) {
      return { ok: false as const, needsPayment: true, priceCents };
    }

    // Insert the lesson using the credit
    const { data: lesson, error: lessonErr } = await supabase
      .from("lessons")
      .insert({
        account_id: accountId,
        student_id: data.studentId,
        subject_id: data.subjectId,
        starts_at: startsAt,
        duration_minutes: 60,
        status: "scheduled",
        credit_id: credit.id,
      })
      .select("id")
      .single();
    if (lessonErr || !lesson) throw new Error(lessonErr?.message ?? "Failed to book lesson");

    // Mark credit consumed
    await supabase
      .from("credits")
      .update({ consumed_lesson_id: lesson.id })
      .eq("id", credit.id);

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
