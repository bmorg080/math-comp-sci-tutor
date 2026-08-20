import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StripeEnv } from "@/lib/stripe.server";

export type PurchaseRow = {
  payment_id: string | null;
  purchased_at: string;
  description: string;
  quantity: number;
  total_cents: number;
  expires_at: string;
  used: number;
  refunded: number;
  remaining: number;
};

async function accountIdFor(supabase: any, userId: string): Promise<string> {
  const { data: member } = await supabase
    .from("account_members")
    .select("account_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!member?.account_id) throw new Error("No account");
  return member.account_id as string;
}

/** Purchase history + per-credit status for the signed-in family. */
export const getMyBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const accountId = await accountIdFor(supabase, userId);

    const { data: credits, error } = await supabase
      .from("credits")
      .select(
        "id, source, price_cents_paid, stripe_payment_id, purchased_at, expires_at, consumed_lesson_id, refunded_at, note",
      )
      .eq("account_id", accountId)
      .order("purchased_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = credits ?? [];
    const groups = new Map<string, PurchaseRow>();
    for (const c of rows) {
      const key = c.stripe_payment_id ?? `${c.source}-${c.purchased_at}`;
      const label =
        c.note ??
        (c.source === "admin_grant"
          ? "Credit granted by your tutor"
          : c.source === "purchase_bundle"
            ? "Lesson pack"
            : "Single lesson");
      const g =
        groups.get(key) ??
        ({
          payment_id: c.stripe_payment_id,
          purchased_at: c.purchased_at,
          description: label,
          quantity: 0,
          total_cents: 0,
          expires_at: c.expires_at,
          used: 0,
          refunded: 0,
          remaining: 0,
        } satisfies PurchaseRow);
      g.quantity += 1;
      g.total_cents += c.price_cents_paid ?? 0;
      if (c.consumed_lesson_id) g.used += 1;
      else if (c.refunded_at) g.refunded += 1;
      else g.remaining += 1;
      groups.set(key, g);
    }

    const now = Date.now();
    const activeCredits = rows
      .filter(
        (c) =>
          !c.consumed_lesson_id && !c.refunded_at && new Date(c.expires_at).getTime() > now,
      )
      .map((c) => ({ id: c.id, expires_at: c.expires_at }))
      .sort((a, b) => a.expires_at.localeCompare(b.expires_at));

    return {
      purchases: [...groups.values()],
      activeCredits,
      nextExpiry: activeCredits[0]?.expires_at ?? null,
    };
  });

/**
 * Safety net for a delayed or missed Stripe webhook. Re-reads the family's
 * recent paid checkout sessions straight from Stripe and grants anything the
 * webhook hasn't already fulfilled. Idempotent — shares the webhook's logic.
 */
export const syncMyPurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { environment: StripeEnv }) =>
    z.object({ environment: z.enum(["sandbox", "live"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const accountId = await accountIdFor(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: account } = await supabaseAdmin
      .from("accounts")
      .select("stripe_customer_id")
      .eq("id", accountId)
      .maybeSingle();
    if (!account?.stripe_customer_id) return { granted: 0, checked: 0 };

    const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
    const { grantCreditsForSession } = await import("@/lib/credits.server");

    try {
      const stripe = createStripeClient(data.environment);
      const sessions = await stripe.checkout.sessions.list({
        customer: account.stripe_customer_id,
        limit: 10,
      });

      let granted = 0;
      for (const s of sessions.data) {
        if (s.payment_status !== "paid") continue;
        // Never fulfil a session that belongs to another family.
        if (s.metadata?.accountId !== accountId) continue;
        const outcome = await grantCreditsForSession(supabaseAdmin as any, s as any);
        if (outcome.status === "processed") {
          granted += outcome.creditsInserted;
          console.log(
            `[reconcile] recovered ${outcome.creditsInserted} credit(s) for session ${s.id}`,
          );
        }
      }
      return { granted, checked: sessions.data.length };
    } catch (error) {
      console.error("[reconcile] failed:", error);
      return { granted: 0, checked: 0, error: getStripeErrorMessage(error) };
    }
  });
