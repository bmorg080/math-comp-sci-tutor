import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import type { Database } from "@/integrations/supabase/types";

type AvailabilityRule = { day: number; start: string; end: string };

function createPublicClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map((n) => Number(n));
  return { h, m: m ?? 0 };
}

function ymdInTZ(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const mo = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${mo}-${d}`;
}

function weekdayInTZ(date: Date, timeZone: string): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

export const listPublicOpenSlots = createServerFn({ method: "GET" })
  .inputValidator((input: { days?: number }) =>
    z.object({ days: z.number().int().min(1).max(60).default(28) }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const sb = createPublicClient();
    const { data: settings } = await sb
      .from("settings")
      .select("tutor_timezone, weekly_availability")
      .eq("id", 1)
      .maybeSingle();
    if (!settings) return { slots: [] as string[], tutorTimezone: "UTC" };

    const tz = settings.tutor_timezone;
    const rules = (settings.weekly_availability ?? []) as AvailabilityRule[];

    const now = new Date();
    const bufferMs = 60 * 60 * 1000;
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
