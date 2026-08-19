import { beforeEach, describe, expect, it } from "vitest";
import { createBooking } from "./booking.core";
import { createFakeSupabase, resetFakeIds, type Tables } from "@/test/fake-supabase";

const NOW = new Date("2026-01-10T12:00:00.000Z");
const SLOT = "2026-01-15T21:00:00.000Z";

function seed(over: Partial<Tables> = {}): Tables {
  return {
    account_members: [{ id: "m1", user_id: "user-1", account_id: "acct-1" }],
    students: [{ id: "stu-1", account_id: "acct-1", name: "Ava" }],
    subjects: [{ id: "subj-1", price_cents: 7000, active: true }],
    custom_prices: [],
    credits: [
      {
        id: "cred-1",
        account_id: "acct-1",
        expires_at: "2026-09-01T00:00:00.000Z",
        consumed_lesson_id: null,
        refunded_at: null,
      },
    ],
    lessons: [],
    ...over,
  };
}

const input = { subjectId: "subj-1", studentId: "stu-1", startsAtISO: SLOT };

beforeEach(() => resetFakeIds());

describe("createBooking", () => {
  it("consumes exactly one credit and links it to the new lesson", async () => {
    const sb = createFakeSupabase(
      seed({
        credits: [
          { id: "old", account_id: "acct-1", expires_at: "2026-03-01T00:00:00.000Z", consumed_lesson_id: null, refunded_at: null },
          { id: "new", account_id: "acct-1", expires_at: "2026-09-01T00:00:00.000Z", consumed_lesson_id: null, refunded_at: null },
        ],
      }),
    );

    const res = await createBooking(sb, "user-1", input, NOW);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.creditId).toBe("old"); // soonest-expiring credit burned first
    expect(sb.db.lessons).toHaveLength(1);
    expect(sb.db.lessons[0]).toMatchObject({ starts_at: SLOT, status: "scheduled", credit_id: "old" });
    expect(sb.db.credits.find((c) => c.id === "old")!.consumed_lesson_id).toBe(res.lessonId);
    expect(sb.db.credits.find((c) => c.id === "new")!.consumed_lesson_id).toBeNull();
  });

  it("asks for payment (and books nothing) when no usable credit exists", async () => {
    const sb = createFakeSupabase(
      seed({
        credits: [
          { id: "expired", account_id: "acct-1", expires_at: "2025-12-01T00:00:00.000Z", consumed_lesson_id: null, refunded_at: null },
        ],
      }),
    );

    const res = await createBooking(sb, "user-1", input, NOW);

    expect(res).toEqual({ ok: false, needsPayment: true, priceCents: 7000 });
    expect(sb.db.lessons).toHaveLength(0);
  });

  it("quotes the account's custom price when one exists", async () => {
    const sb = createFakeSupabase(
      seed({
        credits: [],
        custom_prices: [{ id: "cp1", account_id: "acct-1", subject_id: "subj-1", price_cents: 5500 }],
      }),
    );

    const res = await createBooking(sb, "user-1", input, NOW);
    expect(res).toMatchObject({ needsPayment: true, priceCents: 5500 });
  });

  it("rejects a slot another account just took, without consuming a credit", async () => {
    const sb = createFakeSupabase(
      seed({
        lessons: [{ id: "other", account_id: "acct-2", starts_at: SLOT, status: "scheduled" }],
      }),
    );

    await expect(createBooking(sb, "user-1", input, NOW)).rejects.toThrow(/just booked/i);
    expect(sb.db.lessons).toHaveLength(1);
    expect(sb.db.credits[0]!.consumed_lesson_id).toBeNull();
  });

  it("allows booking a time whose previous lesson was cancelled", async () => {
    const sb = createFakeSupabase(
      seed({
        lessons: [{ id: "old", account_id: "acct-2", starts_at: SLOT, status: "cancelled" }],
      }),
    );

    const res = await createBooking(sb, "user-1", input, NOW);
    expect(res.ok).toBe(true);
    expect(sb.db.lessons).toHaveLength(2);
  });

  it("treats a completed lesson at that time as a conflict", async () => {
    const sb = createFakeSupabase(
      seed({ lessons: [{ id: "done", account_id: "acct-2", starts_at: SLOT, status: "completed" }] }),
    );
    await expect(createBooking(sb, "user-1", input, NOW)).rejects.toThrow(/just booked/i);
  });

  it("refuses a student that belongs to another account", async () => {
    const sb = createFakeSupabase(seed({ students: [{ id: "stu-9", account_id: "acct-2", name: "Not mine" }] }));
    await expect(
      createBooking(sb, "user-1", { ...input, studentId: "stu-9" }, NOW),
    ).rejects.toThrow(/invalid student/i);
  });

  it("refuses an inactive subject", async () => {
    const sb = createFakeSupabase(seed({ subjects: [{ id: "subj-1", price_cents: 7000, active: false }] }));
    await expect(createBooking(sb, "user-1", input, NOW)).rejects.toThrow(/invalid subject/i);
  });

  it("does not spend a credit belonging to a different account", async () => {
    const sb = createFakeSupabase(
      seed({
        credits: [
          { id: "theirs", account_id: "acct-2", expires_at: "2026-09-01T00:00:00.000Z", consumed_lesson_id: null, refunded_at: null },
        ],
      }),
    );
    const res = await createBooking(sb, "user-1", input, NOW);
    expect(res).toMatchObject({ needsPayment: true });
    expect(sb.db.credits[0]!.consumed_lesson_id).toBeNull();
  });
});
