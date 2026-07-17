import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

type CheckoutResult = { clientSecret: string } | { error: string };

export const createLessonCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      subjectId: string;
      kind: "single" | "pack5";
      returnUrl: string;
      environment: StripeEnv;
    }) =>
      z
        .object({
          subjectId: z.string().uuid(),
          kind: z.enum(["single", "pack5"]),
          returnUrl: z.string().url(),
          environment: z.enum(["sandbox", "live"]),
        })
        .parse(input),
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { supabase, userId, claims } = context;

    // Find caller's account
    const { data: member } = await supabase
      .from("account_members")
      .select("account_id, account:accounts(id, display_name, stripe_customer_id)")
      .eq("user_id", userId)
      .maybeSingle();
    if (!member?.account_id) throw new Error("No account found");
    const account = member.account as unknown as {
      id: string;
      display_name: string;
      stripe_customer_id: string | null;
    };

    // Look up subject + slug
    const { data: subject } = await supabase
      .from("subjects")
      .select("id, name, stripe_product_slug, active")
      .eq("id", data.subjectId)
      .maybeSingle();
    if (!subject || !subject.active || !subject.stripe_product_slug) {
      throw new Error("Invalid subject");
    }

    const quantity = data.kind === "pack5" ? 5 : 1;
    const priceLookupKey = `${subject.stripe_product_slug}_${data.kind === "pack5" ? "pack5" : "single"}`;

    try {
      const stripe = createStripeClient(data.environment);

      // Resolve/create customer, store on account
      let customerId = account.stripe_customer_id;
      const email = (claims.email as string | undefined) ?? undefined;
      if (!customerId) {
        const found = email
          ? await stripe.customers.list({ email, limit: 1 })
          : { data: [] as { id: string }[] };
        if (found.data.length) {
          customerId = found.data[0].id;
        } else {
          const created = await stripe.customers.create({
            ...(email && { email }),
            name: account.display_name,
            metadata: { accountId: account.id },
          });
          customerId = created.id;
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("accounts")
          .update({ stripe_customer_id: customerId })
          .eq("id", account.id);
      }

      // Resolve price via lookup_key
      const prices = await stripe.prices.list({ lookup_keys: [priceLookupKey] });
      if (!prices.data.length) throw new Error(`Price not found: ${priceLookupKey}`);
      const stripePrice = prices.data[0];

      const productId =
        typeof stripePrice.product === "string"
          ? stripePrice.product
          : stripePrice.product.id;
      const product = await stripe.products.retrieve(productId);

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        payment_intent_data: { description: product.name },
        metadata: {
          accountId: account.id,
          subjectId: subject.id,
          subjectName: subject.name,
          creditQuantity: String(quantity),
          kind: data.kind,
        },
      } as any);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
