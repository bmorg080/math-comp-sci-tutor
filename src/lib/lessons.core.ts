/**
 * Database-touching cancel / reschedule logic, extracted from the server
 * functions so it can be tested against a fake Supabase client.
 * Side effects (calendar, email) stay in the server functions.
 */
import { canReschedule, isRefundEligible } from "@/lib/domain/policy";

type Sb = any;

export type CancelResult = {
  lesson: { id: string; starts_at: string; credit_id: string | null; google_event_id: string | null };
  refunded: boolean;
};

async function loadOwnedLesson(supabase: Sb, userId: string, lessonId: string, columns: string) {
  const { data: member } = await supabase
    .from("account_members")
    .select("account_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!member?.account_id) throw new Error("No account found");

  const { data: lesson } = await supabase
    .from("lessons")
    .select(columns)
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson || lesson.account_id !== member.account_id) throw new Error("Lesson not found");
  return lesson;
}

async function getCancellationHours(supabase: Sb): Promise<number> {
  const { data: settings } = await supabase
    .from("settings")
    .select("cancellation_hours")
    .eq("id", 1)
    .maybeSingle();
  return settings?.cancellation_hours ?? 24;
}

export async function cancelLesson(
  supabase: Sb,
  userId: string,
  data: { lessonId: string; reason?: string },
  now: Date = new Date(),
): Promise<CancelResult> {
  const lesson = await loadOwnedLesson(
    supabase,
    userId,
    data.lessonId,
    "id, account_id, starts_at, status, credit_id, google_event_id",
  );
  if (lesson.status !== "scheduled") throw new Error("Lesson is not scheduled");

  const cancellationHours = await getCancellationHours(supabase);
  const refundEligible = isRefundEligible(lesson.starts_at, now, cancellationHours);
  const reasonSuffix = refundEligible ? "" : " [late cancel — no refund]";

  const { error: updErr } = await supabase
    .from("lessons")
    .update({
      status: "cancelled",
      cancelled_at: now.toISOString(),
      cancelled_by: userId,
      cancellation_reason: (data.reason ?? "") + reasonSuffix || null,
    })
    .eq("id", lesson.id);
  if (updErr) throw new Error(updErr.message);

  if (refundEligible && lesson.credit_id) {
    await supabase
      .from("credits")
      .update({ consumed_lesson_id: null })
      .eq("id", lesson.credit_id);
  }

  return { lesson, refunded: refundEligible };
}

export type RescheduleResult = {
  lesson: { id: string; starts_at: string; google_event_id: string | null };
  previousStartsAtISO: string;
  newStartsAtISO: string;
};

export async function rescheduleLesson(
  supabase: Sb,
  userId: string,
  data: { lessonId: string; startsAtISO: string },
  now: Date = new Date(),
): Promise<RescheduleResult> {
  const lesson = await loadOwnedLesson(
    supabase,
    userId,
    data.lessonId,
    "id, account_id, starts_at, status, google_event_id",
  );
  if (lesson.status !== "scheduled") throw new Error("Only scheduled lessons can be rescheduled");

  const cancellationHours = await getCancellationHours(supabase);
  const check = canReschedule({
    currentStartsAt: lesson.starts_at,
    newStartsAt: data.startsAtISO,
    now,
    cancellationHours,
  });
  if (!check.ok) throw new Error(check.reason);

  const newStart = new Date(data.startsAtISO);

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

  return { lesson, previousStartsAtISO, newStartsAtISO: newStart.toISOString() };
}
