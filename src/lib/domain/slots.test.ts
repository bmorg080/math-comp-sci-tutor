import { describe, expect, it } from "vitest";
import { generateSlots } from "./slots";
import { toZonedTime, format } from "date-fns-tz";

const TZ = "America/New_York";
const localTime = (iso: string) => format(toZonedTime(new Date(iso), TZ), "yyyy-MM-dd HH:mm");

describe("generateSlots", () => {
  // Wednesday 2026-01-07, 09:00 New York.
  const NOW = new Date("2026-01-07T14:00:00.000Z");

  it("produces hourly starts inside a shift", () => {
    const slots = generateSlots({
      rules: [{ day: 3, start: "16:00", end: "20:00" }],
      timeZone: TZ,
      now: NOW,
      days: 1,
    });
    expect(slots.map(localTime)).toEqual([
      "2026-01-07 16:00",
      "2026-01-07 17:00",
      "2026-01-07 18:00",
      "2026-01-07 19:00",
    ]);
  });

  it("keeps split shifts on the same day separate, with no bleed between them", () => {
    const slots = generateSlots({
      rules: [
        { day: 3, start: "10:00", end: "12:00" },
        { day: 3, start: "16:00", end: "18:00" },
      ],
      timeZone: TZ,
      now: new Date("2026-01-07T12:00:00.000Z"), // 07:00 local
      days: 1,
    });
    expect(slots.map(localTime)).toEqual([
      "2026-01-07 10:00",
      "2026-01-07 11:00",
      "2026-01-07 16:00",
      "2026-01-07 17:00",
    ]);
  });

  it("never offers a partial hour at the end of a shift", () => {
    const slots = generateSlots({
      rules: [{ day: 3, start: "16:00", end: "17:30" }],
      timeZone: TZ,
      now: NOW,
      days: 1,
    });
    expect(slots.map(localTime)).toEqual(["2026-01-07 16:00"]);
  });

  it("drops slots inside the lead-time buffer", () => {
    const slots = generateSlots({
      rules: [{ day: 3, start: "09:00", end: "13:00" }],
      timeZone: TZ,
      now: NOW, // 09:00 local, 1h buffer -> first bookable is 10:00
      days: 1,
    });
    expect(slots.map(localTime)).toEqual([
      "2026-01-07 10:00",
      "2026-01-07 11:00",
      "2026-01-07 12:00",
    ]);
  });

  it("drops slots beyond the horizon", () => {
    const withinTwoDays = generateSlots({
      rules: [{ day: 5, start: "16:00", end: "18:00" }], // Friday, 2 days out
      timeZone: TZ,
      now: NOW,
      days: 1,
    });
    expect(withinTwoDays).toEqual([]);
  });

  it("subtracts already-booked times", () => {
    const all = generateSlots({
      rules: [{ day: 3, start: "16:00", end: "19:00" }],
      timeZone: TZ,
      now: NOW,
      days: 1,
    });
    const remaining = generateSlots({
      rules: [{ day: 3, start: "16:00", end: "19:00" }],
      timeZone: TZ,
      now: NOW,
      days: 1,
      booked: [all[1]!],
    });
    expect(remaining).toEqual([all[0], all[2]]);
  });

  it("keeps local start times correct across a daylight-saving transition", () => {
    // DST starts Sunday 2026-03-08 in New York.
    const slots = generateSlots({
      rules: [{ day: 0, start: "18:00", end: "20:00" }],
      timeZone: TZ,
      now: new Date("2026-03-07T15:00:00.000Z"),
      days: 2,
    });
    expect(slots.map(localTime)).toEqual(["2026-03-08 18:00", "2026-03-08 19:00"]);
    // 18:00 EDT == 22:00 UTC (not 23:00, which would mean the offset was stale).
    expect(slots[0]).toBe("2026-03-08T22:00:00.000Z");
  });
});
