import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

// 9-month credit expiry
const CREDIT_EXPIRY_MS = 9 * 30 * 24 * 60 * 60 * 1000;

type WebhookOutcome = {
  status: "processed" | "duplicate" | "ignored" | "error";
  creditsInserted: number;
  note?: string;
};

async function handleCheckoutCompleted(session: any): Promise<WebhookOutcome> {
  const meta = session.metadata ?? {};
  const accountId: string | undefined = meta.accountId;
  const subjectName: string | undefined = meta.subjectName;
  const kind: string | undefined = meta.kind;
  const qty = Number(meta.creditQuantity ?? 0);

  if (!accountId || !qty) {
    return { status: "ignored", creditsInserted: 0, note: "missing metadata" };
  }

  const supabase = getSupabase();

  // Secondary idempotency guard — even if the outer event-id guard is bypassed
  // (e.g. Stripe re-signs the same session under a new event id), we never
  // insert a second batch of credits for the same checkout session.
  const { data: existing, error: existingErr } = await supabase
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

  const perCreditCents = Math.round(Number(session.amount_total ?? 0) / qty);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CREDIT_EXPIRY_MS).toISOString();
  const source =
    kind === "trial" ? "purchase_single" : kind === "pack5" ? "purchase_bundle" : "purchase_single";

  const rows = Array.from({ length: qty }, () => ({
    account_id: accountId,
    source,
    price_cents_paid: perCreditCents,
    stripe_payment_id: session.id,
    purchased_at: now.toISOString(),
    expires_at: expiresAt,
    note: subjectName ? `Purchased: ${subjectName}` : null,
  }));

  const { error } = await (supabase.from("credits") as any).insert(rows);
  if (error) throw error;

  // Stamp trial_used_at so the trial offer disappears after one purchase.
  if (kind === "trial") {
    await (supabase.from("accounts") as any)
      .update({ trial_used_at: now.toISOString() })
      .eq("id", accountId);
  }

  return {
    status: "processed",
    creditsInserted: qty,
    note: subjectName ?? undefined,
  };
}

async function processEvent(event: {
  id: string;
  type: string;
  data: { object: any };
}): Promise<WebhookOutcome> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return handleCheckoutCompleted(event.data.object);
    default:
      return { status: "ignored", creditsInserted: 0, note: "unhandled type" };
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  const eventId = (event as any).id as string | undefined;
  const session =
    event.type.startsWith("checkout.session.") ? event.data.object : null;
  const sessionId = session?.id ?? null;

  const supabase = getSupabase();

  // Primary idempotency: insert the event row first. The UNIQUE constraint on
  // event_id makes a duplicate delivery fail here — we short-circuit before
  // touching credits.
  if (eventId) {
    const { error: insertErr } = await (supabase.from("webhook_events") as any).insert({
      event_id: eventId,
      kind: event.type,
      env,
      session_id: sessionId,
    });
    if (insertErr) {
      const code = (insertErr as any).code;
      if (code === "23505") {
        console.log(
          `[stripe-webhook] duplicate event ignored id=${eventId} type=${event.type} env=${env}`,
        );
        return { duplicate: true as const, eventId };
      }
      throw insertErr;
    }
  }

  console.log(
    `[stripe-webhook] received id=${eventId} type=${event.type} env=${env} session=${sessionId ?? "-"}`,
  );

  let outcome: WebhookOutcome;
  try {
    outcome = await processEvent(event as any);
  } catch (err) {
    console.error(
      `[stripe-webhook] processing failed id=${eventId} type=${event.type}:`,
      err,
    );
    if (eventId) {
      await (supabase.from("webhook_events") as any)
        .update({
          notes: `error: ${(err as Error).message ?? String(err)}`,
        })
        .eq("event_id", eventId);
    }
    throw err;
  }

  if (eventId) {
    await (supabase.from("webhook_events") as any)
      .update({
        credits_inserted: outcome.creditsInserted,
        notes: `${outcome.status}${outcome.note ? `: ${outcome.note}` : ""}`,
        processed_at: new Date().toISOString(),
      })
      .eq("event_id", eventId);
  }

  console.log(
    `[stripe-webhook] handled id=${eventId} status=${outcome.status} credits=${outcome.creditsInserted}`,
  );

  return { duplicate: false as const, eventId, outcome };
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("[stripe-webhook] invalid env query param:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          const result = await handleWebhook(request, rawEnv);
          return Response.json({ received: true, ...result });
        } catch (e) {
          console.error("[stripe-webhook] error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
