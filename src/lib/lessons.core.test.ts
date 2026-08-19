import { beforeEach, describe, expect, it } from "vitest";
import { cancelLesson, rescheduleLesson } from "./lessons.core";
import { createBooking } from "./booking.core";
import { createFakeSupabase, resetFakeIds, type Tables } from "@/test/fake-supabase";

const NOW = new Date("2026-01-10T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const at = (h: number) => new Date(NOW.getTime() + h * HOUR).toISOString();

function seed(lessons: Tables["lessons"], over: Partial<Tables> = {}): Tables {
  return {
    account_members: [{ id: "m1", user_id: "user-1", account_id: "acct-1" }],
    settings: [{ id: 1, cancellation_hours: 24 }],
    students: [{ id: "stu-1", account_id: "acct-1", name: "Ava" }],
    subjects: [{ id: "subj-1", price_cents: 7000, active: true }],
    custom_prices: [],
    credits: [
      {
        id: "cred-1",
        account_id: "acct-1",
        expires_at: "2026-09-01T00:00:00.000Z",
        consumed_lesson_id: "les-1",
        refunded_at: null,
      },
    ],
    lessons,
    ...over,
  };
}

const scheduled = (startsAt: string, over: Record<string, unknown> = {}) => ({
  id: "les-1",
  account_id: "acct-1",
  starts_at: startsAt,
  status: "scheduled",
  credit_id: "cred-1",
  google_event_id: null,
  ...over,
});

beforeEach(() => resetFakeIds());

describe("cancelLesson", () => {
  it("refunds the credit when cancelling outside the window", async () => {
    const sb = createFakeSupabase(seed([scheduled(at(48))]));
    const res = await cancelLesson(sb, "user-1", { lessonId: "les-1" }, NOW);

    expect(res.refunded).toBe(true);
    expect(sb.db.lessons[0]!.status).toBe("cancelled");
    expect(sb.db.credits[0]!.consumed_lesson_id).toBeNull();
  });

  it("keeps the credit spent on a late cancellation and flags it", async () => {
    const sb = createFakeSupabase(seed([scheduled(at(5))]));
    const res = await cancelLesson(sb, "user-1", { lessonId: "les-1", reason: "sick" }, NOW);

    expect(res.refunded).toBe(false);
    expect(sb.db.credits[0]!.consumed_lesson_id).toBe("les-1");
    expect(sb.db.lessons[0]!.cancellation_reason).toContain("late cancel");
  });

  it("refuses to cancel a lesson that is not scheduled", async () => {
    const sb = createFakeSupabase(seed([scheduled(at(48), { status: "cancelled" })]));
    await expect(cancelLesson(sb, "user-1", { lessonId: "les-1" }, NOW)).rejects.toThrow(
      /not scheduled/i,
    );
  });

  it("refuses to cancel another account's lesson", async () => {
    const sb = createFakeSupabase(seed([scheduled(at(48), { account_id: "acct-2" })]));
    await expect(cancelLesson(sb, "user-1", { lessonId: "les-1" }, NOW)).rejects.toThrow(
      /lesson not found/i,
    );
  });

  it("frees the credit so it can be spent on a later booking", async () => {
    const sb = createFakeSupabase(seed([scheduled(at(48))]));
    await cancelLesson(sb, "user-1", { lessonId: "les-1" }, NOW);

    const res = await createBooking(
      sb,
      "user-1",
      { subjectId: "subj-1", studentId: "stu-1", startsAtISO: at(96) },
      NOW,
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.creditId).toBe("cred-1");
    expect(sb.db.credits[0]!.consumed_lesson_id).toBe(res.lessonId);
  });
});

describe("rescheduleLesson", () => {
  it("moves a lesson to a free slot", async () => {
    const sb = createFakeSupabase(seed([scheduled(at(48))]));
    const res = await rescheduleLesson(sb, "user-1", { lessonId: "les-1", startsAtISO: at(72) }, NOW);

    expect(res.previousStartsAtISO).toBe(at(48));
    expect(sb.db.lessons[0]!.starts_at).toBe(at(72));
    expect(sb.db.lessons[0]!.reminder_sent_at).toBeNull();
  });

  it("rejects a move onto a taken slot and leaves the lesson untouched", async () => {
    const sb = createFakeSupabase(
      seed([
        scheduled(at(48)),
        { id: "les-2", account_id: "acct-2", starts_at: at(72), status: "scheduled", credit_id: null, google_event_id: null },
      ]),
    );

    await expect(
      rescheduleLesson(sb, "user-1", { lessonId: "les-1", startsAtISO: at(72) }, NOW),
    ).rejects.toThrow(/just booked/i);
    expect(sb.db.lessons[0]!.starts_at).toBe(at(48));
  });

  it("allows keeping the same time (it does not conflict with itself)", async () => {
    const sb = createFakeSupabase(seed([scheduled(at(48))]));
    await expect(
      rescheduleLesson(sb, "user-1", { lessonId: "les-1", startsAtISO: at(48) }, NOW),
    ).resolves.toMatchObject({ newStartsAtISO: at(48) });
  });

  it("blocks a reschedule inside the cancellation window", async () => {
    const sb = createFakeSupabase(seed([scheduled(at(5))]));
    await expect(
      rescheduleLesson(sb, "user-1", { lessonId: "les-1", startsAtISO: at(72) }, NOW),
    ).rejects.toThrow(/24 hours in advance/);
    expect(sb.db.lessons[0]!.starts_at).toBe(at(5));
  });

  it("blocks a new time less than an hour away", async () => {
    const sb = createFakeSupabase(seed([scheduled(at(48))]));
    await expect(
      rescheduleLesson(sb, "user-1", { lessonId: "les-1", startsAtISO: at(0.5) }, NOW),
    ).rejects.toThrow(/at least 1 hour/);
  });
});
