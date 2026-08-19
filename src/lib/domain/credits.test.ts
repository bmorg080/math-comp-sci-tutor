import { describe, expect, it } from "vitest";
import { isCreditUsable, pickCreditToConsume, type CreditRecord } from "./credits";

const NOW = new Date("2026-01-10T12:00:00.000Z");

function credit(over: Partial<CreditRecord> & { id: string }): CreditRecord {
  return {
    account_id: "acct-1",
    expires_at: "2026-06-01T00:00:00.000Z",
    consumed_lesson_id: null,
    refunded_at: null,
    ...over,
  };
}

describe("isCreditUsable", () => {
  it("accepts a fresh, unspent credit", () => {
    expect(isCreditUsable(credit({ id: "c1" }), NOW)).toBe(true);
  });

  it("rejects a credit already consumed by a lesson", () => {
    expect(isCreditUsable(credit({ id: "c1", consumed_lesson_id: "l1" }), NOW)).toBe(false);
  });

  it("rejects a refunded credit", () => {
    expect(isCreditUsable(credit({ id: "c1", refunded_at: NOW.toISOString() }), NOW)).toBe(false);
  });

  it("treats expiry as exclusive: expiring exactly now is unusable", () => {
    expect(isCreditUsable(credit({ id: "c1", expires_at: NOW.toISOString() }), NOW)).toBe(false);
    expect(
      isCreditUsable(credit({ id: "c2", expires_at: "2026-01-10T12:00:00.001Z" }), NOW),
    ).toBe(true);
  });

  it("treats an unparseable expiry as unusable, not a crash", () => {
    expect(isCreditUsable(credit({ id: "c1", expires_at: "not-a-date" }), NOW)).toBe(false);
  });
});



describe("pickCreditToConsume", () => {
  it("burns the soonest-expiring usable credit first", () => {
    const chosen = pickCreditToConsume(
      [
        credit({ id: "later", expires_at: "2026-09-01T00:00:00.000Z" }),
        credit({ id: "soonest", expires_at: "2026-02-01T00:00:00.000Z" }),
        credit({ id: "middle", expires_at: "2026-05-01T00:00:00.000Z" }),
      ],
      NOW,
    );
    expect(chosen?.id).toBe("soonest");
  });

  it("skips expired, consumed and refunded credits", () => {
    const chosen = pickCreditToConsume(
      [
        credit({ id: "expired", expires_at: "2025-12-01T00:00:00.000Z" }),
        credit({ id: "spent", consumed_lesson_id: "l1", expires_at: "2026-02-01T00:00:00.000Z" }),
        credit({ id: "refunded", refunded_at: "2026-01-01T00:00:00.000Z", expires_at: "2026-02-02T00:00:00.000Z" }),
        credit({ id: "good", expires_at: "2026-03-01T00:00:00.000Z" }),
      ],
      NOW,
    );
    expect(chosen?.id).toBe("good");
  });

  it("returns null when nothing is usable (caller must charge the customer)", () => {
    expect(
      pickCreditToConsume([credit({ id: "expired", expires_at: "2025-01-01T00:00:00.000Z" })], NOW),
    ).toBeNull();
    expect(pickCreditToConsume([], NOW)).toBeNull();
  });

  it("never uses another account's credit", () => {
    const chosen = pickCreditToConsume(
      [
        credit({ id: "theirs", account_id: "acct-2", expires_at: "2026-02-01T00:00:00.000Z" }),
        credit({ id: "mine", account_id: "acct-1", expires_at: "2026-04-01T00:00:00.000Z" }),
      ],
      NOW,
      "acct-1",
    );
    expect(chosen?.id).toBe("mine");
  });
});
