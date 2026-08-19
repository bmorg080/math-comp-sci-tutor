import { describe, expect, it } from "vitest";
import { canReschedule, hoursUntil, isRefundEligible } from "./policy";

const NOW = new Date("2026-01-10T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const at = (hoursFromNow: number) => new Date(NOW.getTime() + hoursFromNow * HOUR).toISOString();

describe("isRefundEligible (24h policy)", () => {
  it("refunds a cancellation well outside the window", () => {
    expect(isRefundEligible(at(25), NOW, 24)).toBe(true);
  });

  it("does not refund a late cancellation inside the window", () => {
    expect(isRefundEligible(at(23), NOW, 24)).toBe(false);
  });

  it("treats exactly 24 hours out as refundable (boundary pinned)", () => {
    expect(isRefundEligible(at(24), NOW, 24)).toBe(true);
    expect(isRefundEligible(new Date(NOW.getTime() + 24 * HOUR - 1), NOW, 24)).toBe(false);
  });

  it("does not refund a lesson already in the past", () => {
    expect(isRefundEligible(at(-2), NOW, 24)).toBe(false);
  });

  it("honours a custom cancellation window", () => {
    expect(isRefundEligible(at(5), NOW, 4)).toBe(true);
    expect(isRefundEligible(at(3), NOW, 4)).toBe(false);
  });

  it("hoursUntil goes negative once the lesson has started", () => {
    expect(hoursUntil(at(-3), NOW)).toBe(-3);
  });
});

describe("canReschedule", () => {
  it("allows moving a lesson that is outside the window to a valid future slot", () => {
    expect(
      canReschedule({ currentStartsAt: at(48), newStartsAt: at(72), now: NOW, cancellationHours: 24 }),
    ).toEqual({ ok: true });
  });

  it("blocks a reschedule inside the cancellation window", () => {
    const res = canReschedule({
      currentStartsAt: at(5),
      newStartsAt: at(72),
      now: NOW,
      cancellationHours: 24,
    });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toContain("24 hours in advance");
  });

  it("blocks a new time that is less than an hour away", () => {
    const res = canReschedule({
      currentStartsAt: at(48),
      newStartsAt: at(0.5),
      now: NOW,
      cancellationHours: 24,
    });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toContain("at least 1 hour");
  });

  it("rejects an unparseable new time", () => {
    const res = canReschedule({
      currentStartsAt: at(48),
      newStartsAt: "not-a-date",
      now: NOW,
      cancellationHours: 24,
    });
    expect(res).toEqual({ ok: false, reason: "Invalid time" });
  });
});
