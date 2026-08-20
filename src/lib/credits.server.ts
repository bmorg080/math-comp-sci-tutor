// Shared, idempotent credit fulfilment used by BOTH the Stripe webhook and the
// post-checkout reconciliation server function. Keeping one implementation means
// a delayed/missed webhook can always be recovered without double-granting.

const DEFAULT_EXPIRY_MONTHS = 9;

type AnyClient = {
  from: (table: string) => any;
};

export type CheckoutSessionLike = {
  id: string;
  amount_total?: number | null;
  payment_status?: string | null;
  status?: string | null;
  metadata?: Record<string, string> | null;
};

export type GrantOutcome = {
  status: "processed" | "duplicate" | "ignored";
  creditsInserted: number;
  note?: string;
};

export async function getCreditExpiryMonths(supabaseAdmin: AnyClient): Promise<number> {
  const { data } = await supabaseAdmin
    .from("settings")
    .select("credit_expiry_months")
    .eq("id", 1)
    .maybeSingle();
  return data?.credit_expiry_months ?? DEFAULT_EXPIRY_MONTHS;
}

export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Grants the credits bought in a paid Checkout Session.
 * Idempotent: a session that already produced credits never produces more.
 */
export async function grantCreditsForSession(
  supabaseAdmin: AnyClient,
  session: CheckoutSessionLike,
): Promise<GrantOutcome> {
  const meta = session.metadata ?? {};
  const accountId = meta.accountId;
  const subjectName = meta.subjectName;
  const kind = meta.kind;
  const qty = Number(meta.creditQuantity ?? 0);

  if (!accountId || !qty) {
    return { status: "ignored", creditsInserted: 0, note: "missing metadata" };
  }
  if (session.payment_status && session.payment_status !== "paid") {
    return { status: "ignored", creditsInserted: 0, note: `payment_status=${session.payment_status}` };
  }

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("credits")
    .select("id")
    .eq("stripe_payment_id", session.id)
    .limit(1);
  if (existingErr) throw existingErr;
  if (existing && existing.length > 0) {
    return {
      status: "duplicate",
      creditsInserted: 0,
      note: `session ${session.id} already granted credits`,
    };
  }

  const months = await getCreditExpiryMonths(supabaseAdmin);
  const now = new Date();
  const expiresAt = addMonths(now, months).toISOString();
  const perCreditCents = Math.round(Number(session.amount_total ?? 0) / qty);
  const source = kind === "pack5" ? "purchase_bundle" : "purchase_single";

  const rows = Array.from({ length: qty }, () => ({
    account_id: accountId,
    source,
    price_cents_paid: perCreditCents,
    stripe_payment_id: session.id,
    purchased_at: now.toISOString(),
    expires_at: expiresAt,
    note: subjectName ? `Purchased: ${subjectName}` : null,
  }));

  const { error } = await supabaseAdmin.from("credits").insert(rows);
  if (error) throw error;

  if (kind === "trial") {
    await supabaseAdmin
      .from("accounts")
      .update({ trial_used_at: now.toISOString() })
      .eq("id", accountId);
  }

  return { status: "processed", creditsInserted: qty, note: subjectName ?? undefined };
}

/**
 * Voids the still-unused credits from a refunded/disputed checkout session.
 * Credits already spent on a lesson are left alone (the lesson happened) and
 * reported back so the tutor can follow up.
 */
export async function voidCreditsForSession(
  supabaseAdmin: AnyClient,
  sessionId: string,
  reason: string,
): Promise<{ voided: number; alreadyUsed: number }> {
  const { data: rows, error } = await supabaseAdmin
    .from("credits")
    .select("id, consumed_lesson_id, refunded_at")
    .eq("stripe_payment_id", sessionId);
  if (error) throw error;

  const all = rows ?? [];
  const voidable = all.filter(
    (c: any) => !c.consumed_lesson_id && !c.refunded_at,
  );
  const alreadyUsed = all.filter((c: any) => c.consumed_lesson_id).length;

  if (voidable.length > 0) {
    const { error: updErr } = await supabaseAdmin
      .from("credits")
      .update({ refunded_at: new Date().toISOString(), note: reason })
      .in(
        "id",
        voidable.map((c: any) => c.id),
      );
    if (updErr) throw updErr;
  }

  return { voided: voidable.length, alreadyUsed };
}
