/**
 * Pure cancellation / reschedule policy rules.
 */

const HOUR_MS = 60 * 60 * 1000;

/** Hours between `now` and the lesson start (negative once it has begun). */
export function hoursUntil(startsAt: Date | string, now: Date): number {
  return (new Date(startsAt).getTime() - now.getTime()) / HOUR_MS;
}

/**
 * A cancellation earns the credit back only when it happens at or before the
 * cutoff. Exactly at the cutoff counts as eligible.
 */
export function isRefundEligible(
  startsAt: Date | string,
  now: Date,
  cancellationHours: number,
): boolean {
  return hoursUntil(startsAt, now) >= cancellationHours;
}

export type RescheduleCheck = { ok: true } | { ok: false; reason: string };

/**
 * Students may move a lesson only outside the cancellation window, and the new
 * time must be at least `minLeadHours` away.
 */
export function canReschedule(opts: {
  currentStartsAt: Date | string;
  newStartsAt: Date | string;
  now: Date;
  cancellationHours: number;
  minLeadHours?: number;
}): RescheduleCheck {
  const { currentStartsAt, newStartsAt, now, cancellationHours } = opts;
  const minLeadHours = opts.minLeadHours ?? 1;

  if (hoursUntil(currentStartsAt, now) < cancellationHours) {
    return {
      ok: false,
      reason: `Lessons can only be rescheduled at least ${cancellationHours} hours in advance. Please contact your tutor.`,
    };
  }

  const next = new Date(newStartsAt);
  if (Number.isNaN(next.getTime())) return { ok: false, reason: "Invalid time" };

  if (hoursUntil(next, now) < minLeadHours) {
    return {
      ok: false,
      reason: `New time must be at least ${minLeadHours} hour${minLeadHours === 1 ? "" : "s"} from now`,
    };
  }

  return { ok: true };
}
