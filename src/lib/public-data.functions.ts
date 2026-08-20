import { createServerFn } from "@tanstack/react-start";

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
  const { createPublicClient } = await import("./public-data.server");
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
