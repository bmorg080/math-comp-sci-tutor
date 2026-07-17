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

async function handleCheckoutCompleted(session: any) {
  const meta = session.metadata ?? {};
  const accountId: string | undefined = meta.accountId;
  const subjectName: string | undefined = meta.subjectName;
  const qty = Number(meta.creditQuantity ?? 0);
  if (!accountId || !qty) {
    console.error("Missing metadata on session", session.id);
    return;
  }

  const supabase = getSupabase();

  // Idempotency: skip if we've already recorded credits for this session
  const { data: existing } = await supabase
    .from("credits")
    .select("id")
    .eq("stripe_payment_id", session.id)
    .limit(1);
  if (existing && existing.length > 0) return;

  const perCreditCents = Math.round(Number(session.amount_total ?? 0) / qty);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CREDIT_EXPIRY_MS).toISOString();

  const rows = Array.from({ length: qty }, () => ({
    account_id: accountId,
    source: "purchase" as const,
    price_cents_paid: perCreditCents,
    stripe_payment_id: session.id,
    purchased_at: now.toISOString(),
    expires_at: expiresAt,
    note: subjectName ? `Purchased: ${subjectName}` : null,
  }));

  const { error } = await supabase.from("credits").insert(rows);
  if (error) {
    console.error("Failed to insert credits", error);
    throw error;
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await handleCheckoutCompleted(event.data.object);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook missing/invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
