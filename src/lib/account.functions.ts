import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Ensure the signed-in user has an account. Called right after sign-up.
export const ensureMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { displayName: string; timezone: string; studentName?: string }) =>
    z
      .object({
        displayName: z.string().trim().min(1).max(120),
        timezone: z.string().trim().min(1).max(80),
        studentName: z.string().trim().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    // Already a member?
    const { data: existing } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing?.account_id) return { accountId: existing.account_id, created: false };

    // Create account + membership via service role (RLS trust boundary)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: acct, error: acctErr } = await supabaseAdmin
      .from("accounts")
      .insert({ display_name: data.displayName, timezone: data.timezone })
      .select("id")
      .single();
    if (acctErr || !acct) throw new Error(acctErr?.message ?? "Failed to create account");

    const email = (claims.email as string | undefined) ?? "";
    const { error: memErr } = await supabaseAdmin.from("account_members").insert({
      account_id: acct.id,
      user_id: userId,
      member_role: "parent",
      email,
    });
    if (memErr) throw new Error(memErr.message);

    if (data.studentName) {
      await supabaseAdmin.from("students").insert({ account_id: acct.id, name: data.studentName });
    }

    // Default role = customer
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "customer" }).select();

    return { accountId: acct.id, created: true };
  });

export const getMyAccountOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: member } = await supabase
      .from("account_members")
      .select("account_id, member_role, email, account:accounts(id, display_name, timezone)")
      .eq("user_id", userId)
      .maybeSingle();

    if (!member?.account_id) {
      return { account: null, students: [], subjects: [], credits: 0, isAdmin: false };
    }

    const [studentsRes, subjectsRes, customPricesRes, creditsRes, roleRes, acctRes, upcomingRes] = await Promise.all([
      supabase.from("students").select("id, name, grade_level, email").eq("account_id", member.account_id),
      supabase
        .from("subjects")
        .select("id, name, price_cents, description, sort_order, is_trial")
        .eq("active", true)
        .order("sort_order"),
      supabase.from("custom_prices").select("subject_id, price_cents").eq("account_id", member.account_id),
      supabase
        .from("credits")
        .select("id, expires_at, consumed_lesson_id, refunded_at")
        .eq("account_id", member.account_id)
        .is("consumed_lesson_id", null)
        .is("refunded_at", null)
        .gt("expires_at", new Date().toISOString()),
      supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      supabase.from("accounts").select("trial_used_at").eq("id", member.account_id).maybeSingle(),
    ]);

    // Trial eligibility: never used trial AND account has never purchased any credits.
    const { count: everCredits } = await supabase
      .from("credits")
      .select("*", { count: "exact", head: true })
      .eq("account_id", member.account_id);
    const trialEligible = !acctRes.data?.trial_used_at && (everCredits ?? 0) === 0;

    const customMap = new Map((customPricesRes.data ?? []).map((c) => [c.subject_id, c.price_cents]));
    const allSubjects = (subjectsRes.data ?? []).map((s) => ({
      ...s,
      effective_price_cents: customMap.get(s.id) ?? s.price_cents,
      has_custom_price: customMap.has(s.id),
    }));
    const subjects = allSubjects.filter((s) => !s.is_trial);
    const trialSubject = trialEligible ? allSubjects.find((s) => s.is_trial) ?? null : null;

    return {
      account: member.account,
      memberRole: member.member_role,
      email: member.email,
      students: studentsRes.data ?? [],
      subjects,
      trialSubject,
      trialEligible,
      credits: creditsRes.data?.length ?? 0,
      isAdmin: !!roleRes.data,
    };
  });
