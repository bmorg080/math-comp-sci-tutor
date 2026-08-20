import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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

export type PublicSettings = {
  tutor_name: string;
  tutor_bio: string;
  tutor_timezone: string;
  bundle_size: number;
  bundle_discount_pct: number;
  credit_expiry_months: number;
  cancellation_hours: number;
  weekly_availability: Array<{ day: number; start: string; end: string }>;
};

export type PublicSubject = {
  id: string;
  name: string;
  price_cents: number;
  description: string | null;
  sort_order: number;
  is_trial: boolean;
};

export const getPublicHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const sb = createPublicClient();
  const [subjectsRes, settingsRes] = await Promise.all([
    sb
      .from("subjects")
      .select("id, name, price_cents, description, sort_order, is_trial")
      .eq("active", true)
      .order("sort_order"),
    // Public settings are read through the SECURITY DEFINER RPC so anonymous
    // users never touch the settings table (which holds tutor_email/zoom_link).
    (sb as unknown as { rpc: (name: string) => { maybeSingle: () => Promise<{ data: PublicSettings | null }> } })
      .rpc("get_public_settings")
      .maybeSingle(),
  ]);
  const all = (subjectsRes.data ?? []) as PublicSubject[];
  return {
    subjects: all.filter((s) => !s.is_trial),
    trialSubject: all.find((s) => s.is_trial) ?? null,
    settings: (settingsRes.data ?? null) as PublicSettings | null,
  };
});
