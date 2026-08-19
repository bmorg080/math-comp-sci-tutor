/**
 * Pure availability-slot generation. Given the tutor's weekly rules and a
 * clock, produce the bookable 1-hour starts as UTC ISO strings.
 */
import { fromZonedTime } from "date-fns-tz";

export type AvailabilityRule = { day: number; start: string; end: string };

export function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map((n) => Number(n));
  return { h, m: m ?? 0 };
}

/** Format a Date as YYYY-MM-DD in a given timezone. */
export function ymdInTZ(date: Date, timeZone: string): string {
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

export function weekdayInTZ(date: Date, timeZone: string): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

export function generateSlots(opts: {
  rules: AvailabilityRule[];
  timeZone: string;
  now: Date;
  days: number;
  /** Minimum lead time before the first bookable slot, in ms. Default 1 hour. */
  leadMs?: number;
  /** Slot length in minutes. Default 60. */
  slotMinutes?: number;
  /** Already-taken starts (UTC ISO strings) to subtract. */
  booked?: string[];
}): string[] {
  const { rules, timeZone, now, days } = opts;
  const leadMs = opts.leadMs ?? 60 * 60 * 1000;
  const slotMinutes = opts.slotMinutes ?? 60;

  const earliest = new Date(now.getTime() + leadMs);
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const slots: string[] = [];
  for (let i = 0; i < days + 1; i++) {
    const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const wd = weekdayInTZ(d, timeZone);
    const ymd = ymdInTZ(d, timeZone);
    for (const r of rules.filter((rule) => rule.day === wd)) {
      const { h: sh, m: sm } = parseHHMM(r.start);
      const { h: eh, m: em } = parseHHMM(r.end);
      const startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;
      for (let mins = startMinutes; mins + slotMinutes <= endMinutes; mins += slotMinutes) {
        const hh = String(Math.floor(mins / 60)).padStart(2, "0");
        const mm = String(mins % 60).padStart(2, "0");
        const utc = fromZonedTime(`${ymd}T${hh}:${mm}:00`, timeZone);
        if (utc < earliest || utc > horizon) continue;
        slots.push(utc.toISOString());
      }
    }
  }

  const taken = new Set((opts.booked ?? []).map((b) => new Date(b).toISOString()));
  return Array.from(new Set(slots.filter((s) => !taken.has(s)))).sort();
}
