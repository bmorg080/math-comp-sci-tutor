import { createServerFn } from "@tanstack/react-start";
import { BOOKING_LEAD_MS } from "@/lib/domain/slots";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";

type AvailabilityRule = { day: number; start: string; end: string };

export const listPublicOpenSlots = createServerFn({ method: "GET" })
  .inputValidator((input: { days?: number }) =>
    z.object({ days: z.number().int().min(1).max(60).default(28) }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { createPublicClient, parseHHMM, ymdInTZ, weekdayInTZ } = await import("./public-booking.server");
    const sb = createPublicClient();
    // Read settings through the SECURITY DEFINER RPC so anon never touches the
    // settings table (which holds tutor_email/zoom_link).
    const { data: settings } = await (
      sb as unknown as {
        rpc: (name: string) => {
          maybeSingle: () => Promise<{
            data: {
              tutor_timezone: string;
              weekly_availability: AvailabilityRule[] | null;
            } | null;
          }>;
        };
      }
    )
      .rpc("get_public_settings")
      .maybeSingle();
    if (!settings) return { slots: [] as string[], tutorTimezone: "UTC" };

    const tz = settings.tutor_timezone;
    const rules = (settings.weekly_availability ?? []) as AvailabilityRule[];

    const now = new Date();
    const bufferMs = BOOKING_LEAD_MS;
    const earliest = new Date(now.getTime() + bufferMs);
    const horizon = new Date(now.getTime() + data.days * 24 * 60 * 60 * 1000);

    const slots: string[] = [];
    for (let i = 0; i < data.days + 1; i++) {
      const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const wd = weekdayInTZ(d, tz);
      const ymd = ymdInTZ(d, tz);
      for (const r of rules.filter((r) => r.day === wd)) {
        const { h: sh, m: sm } = parseHHMM(r.start);
        const { h: eh, m: em } = parseHHMM(r.end);
        const startMinutes = sh * 60 + sm;
        const endMinutes = eh * 60 + em;
        for (let mins = startMinutes; mins + 60 <= endMinutes; mins += 60) {
          const hh = String(Math.floor(mins / 60)).padStart(2, "0");
          const mm = String(mins % 60).padStart(2, "0");
          const utc = fromZonedTime(`${ymd}T${hh}:${mm}:00`, tz);
          if (utc < earliest || utc > horizon) continue;
          slots.push(utc.toISOString());
        }
      }
    }

    const { data: busy } = await sb.rpc("public_busy_slots", {
      _from: now.toISOString(),
      _to: horizon.toISOString(),
    });
    const taken = new Set((busy ?? []).map((b: { starts_at: string }) => new Date(b.starts_at).toISOString()));
    const available = slots.filter((s) => !taken.has(s)).sort();

    return { slots: available, tutorTimezone: tz };
  });
