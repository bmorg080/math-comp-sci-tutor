import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, createStripeClient, verifyWebhook } from "@/lib/stripe.server";
import {
  grantCreditsForSession,
  voidCreditsForSession,
  type GrantOutcome,
} from "@/lib/credits.server";

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

type WebhookOutcome = GrantOutcome | { status: "error"; creditsInserted: number; note?: string };

/**
 * A refund or dispute on a charge voids the unused credits from the checkout
 * session that produced them. Credits already spent on a delivered lesson stay
 * put and are flagged in the webhook log for manual follow-up.
 */
async function handleRefund(
  charge: any,
  env: StripeEnv,
  kindLabel: string,
): Promise<WebhookOutcome> {
  const paymentIntent =
    typeof charge?.payment_intent === "string"
      ? charge.payment_intent
      : charge?.payment_intent?.id;
  if (!paymentIntent) {
    return { status: "ignored", creditsInserted: 0, note: "no payment_intent on charge" };
  }

  const stripe = createStripeClient(env);
  const sessions = await stripe.checkout.sessions.list({
    payment_intent: paymentIntent,
    limit: 5,
  } as any);
  if (!sessions.data.length) {
    return { status: "ignored", creditsInserted: 0, note: `no session for ${paymentIntent}` };
  }

  const supabase = getSupabase();
  let voided = 0;
  let alreadyUsed = 0;
  for (const session of sessions.data) {
    const res = await voidCreditsForSession(
      supabase as any,
      session.id,
      `${kindLabel} — credit voided`,
    );
    voided += res.voided;
    alreadyUsed += res.alreadyUsed;
  }

  return {
    status: "processed",
    creditsInserted: 0,
    note: `${kindLabel}: voided ${voided} unused credit(s)${alreadyUsed ? `, ${alreadyUsed} already used on a lesson — review manually` : ""}`,
  };
}

async function processEvent(
  event: { id: string; type: string; data: { object: any } },
  env: StripeEnv,
): Promise<WebhookOutcome> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return grantCreditsForSession(getSupabase() as any, event.data.object);
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      return {
        status: "ignored",
        creditsInserted: 0,
        note: `${event.type} — no credits granted`,
      };
    case "charge.refunded":
      return handleRefund(event.data.object, env, "Refunded in Stripe");
    case "charge.dispute.created":
      return handleRefund(event.data.object, env, "Payment disputed");
    default:
      return { status: "ignored", creditsInserted: 0, note: "unhandled type" };
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  const eventId = (event as any).id as string | undefined;
  const session = event.type.startsWith("checkout.session.") ? event.data.object : null;
  const sessionId = session?.id ?? null;

  const supabase = getSupabase();

  // Primary idempotency: claim the event id first. A duplicate delivery of an
  // event we ALREADY finished (processed_at set) short-circuits here. A row
  // without processed_at means a previous attempt died mid-flight, so we let
  // the retry run again — grantCreditsForSession is itself idempotent.
  if (eventId) {
    const { error: insertErr } = await (supabase.from("webhook_events") as any).insert({
      event_id: eventId,
      kind: event.type,
      env,
      session_id: sessionId,
    });
    if (insertErr) {
      if ((insertErr as any).code === "23505") {
        const { data: prior } = await supabase
          .from("webhook_events")
          .select("processed_at")
          .eq("event_id", eventId)
          .maybeSingle();
        if ((prior as any)?.processed_at) {
          console.log(
            `[stripe-webhook] duplicate event ignored id=${eventId} type=${event.type} env=${env}`,
          );
          return { duplicate: true as const, eventId };
        }
        console.log(
          `[stripe-webhook] retrying previously failed event id=${eventId} type=${event.type}`,
        );
      } else {
        throw insertErr;
      }
    }
  }

  console.log(
    `[stripe-webhook] received id=${eventId} type=${event.type} env=${env} session=${sessionId ?? "-"}`,
  );

  let outcome: WebhookOutcome;
  try {
    outcome = await processEvent(event as any, env);
  } catch (err) {
    console.error(`[stripe-webhook] processing failed id=${eventId} type=${event.type}:`, err);
    if (eventId) {
      // Leave processed_at NULL so Stripe's retry is allowed to run again.
      await (supabase.from("webhook_events") as any)
        .update({ notes: `error: ${(err as Error).message ?? String(err)}` })
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
