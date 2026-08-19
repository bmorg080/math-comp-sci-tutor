import { createFileRoute } from "@tanstack/react-router";
import { createStripeClient } from "@/lib/stripe.server";

export const Route = createFileRoute("/api/migrate-prices")({
  server: {
    handlers: {
      GET: async () => {
        const stripe = createStripeClient("sandbox");

        // 1. List all active prices once, before any mutation.
        const all = await stripe.prices.list({ active: true, limit: 100 });
        const singles = all.data.filter(
          (p) =>
            p.lookup_key?.endsWith("_single") &&
            p.lookup_key !== "trial_lesson_single",
        );
        const oldPack5 = new Map(
          all.data
            .filter((p) => p.lookup_key?.endsWith("_pack5"))
            .map((p) => [p.lookup_key as string, p]),
        );

        const results: Array<{
          slug: string;
          singleCents: number;
          newPack5Cents: number;
          oldPack5Id: string | null;
          newPack5Id: string | null;
        }> = [];

        for (const single of singles) {
          const slug = single.lookup_key!.replace(/_single$/, "");
          const lookupKey = `${slug}_pack5`;
          const singleCents = single.unit_amount ?? 0;
          const newPack5Cents = Math.round(singleCents * 5 * 0.9);

          const old = oldPack5.get(lookupKey) ?? null;

          // Create a new 10%-off pack5 price and transfer the lookup key to it.
          const created = await stripe.prices.create({
            currency: "usd",
            product: single.product as string,
            unit_amount: newPack5Cents,
            lookup_key: lookupKey,
            transfer_lookup_key: true,
            metadata: {
              lovable_managed: "true",
              lovable_external_id: lookupKey,
            },
          });

          // Deactivate the old pack5 price so only the new one is chargeable.
          if (old) {
            await stripe.prices.update(old.id, { active: false });
          }

          results.push({
            slug,
            singleCents,
            newPack5Cents,
            oldPack5Id: old?.id ?? null,
            newPack5Id: created.id,
          });
        }

        return Response.json({ ok: true, results }, { status: 200 });
      },
    },
  },
});
