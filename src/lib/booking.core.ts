/**
 * Database-touching booking logic, extracted from the server function so it
 * can be exercised in tests against a fake Supabase client.
 * Side effects (calendar, email) stay in the server function.
 */
import { pickCreditToConsume, type CreditRecord } from "@/lib/domain/credits";
import { BOOKING_LEAD_MS } from "@/lib/domain/slots";

// The fake client used in tests implements the same narrow surface.
type Sb = any;

export type CreateBookingInput = {
  subjectId: string;
  studentId: string;
  startsAtISO: string;
};

export type CreateBookingResult =
  | { ok: false; needsPayment: true; priceCents: number }
  | { ok: true; lessonId: string; accountId: string; creditId: string; priceCents: number };

export async function createBooking(
  supabase: Sb,
  userId: string,
  data: CreateBookingInput,
  now: Date = new Date(),
): Promise<CreateBookingResult> {
  const { data: member } = await supabase
    .from("account_members")
    .select("account_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!member?.account_id) throw new Error("No account found");
  const accountId = member.account_id as string;

  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", data.studentId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (!student) throw new Error("Invalid student");

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
  const priceCents: number = customPrice?.price_cents ?? subject.price_cents;

  const startsAtDate = new Date(data.startsAtISO);
  if (startsAtDate.getTime() - now.getTime() < BOOKING_LEAD_MS) {
    throw new Error("Lessons must be booked at least 5 hours in advance. Please pick a later time.");
  }
  const startsAt = startsAtDate.toISOString();
  const { data: conflict } = await supabase
    .from("lessons")
    .select("id")
    .eq("starts_at", startsAt)
    .in("status", ["scheduled", "completed"])
    .maybeSingle();
  if (conflict) throw new Error("That time was just booked. Please pick another.");

  const { data: candidates } = await supabase
    .from("credits")
    .select("id, account_id, expires_at, consumed_lesson_id, refunded_at")
    .eq("account_id", accountId)
    .is("consumed_lesson_id", null)
    .is("refunded_at", null);

  const credit = pickCreditToConsume((candidates ?? []) as CreditRecord[], now, accountId);
  if (!credit) {
    return { ok: false as const, needsPayment: true, priceCents };
  }

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

  await supabase.from("credits").update({ consumed_lesson_id: lesson.id }).eq("id", credit.id);

  return {
    ok: true as const,
    lessonId: lesson.id as string,
    accountId,
    creditId: credit.id,
    priceCents,
  };
}
