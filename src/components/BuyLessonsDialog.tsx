import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createLessonCheckout } from "@/lib/checkout.functions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Subject = {
  id: string;
  name: string;
  effective_price_cents: number;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: Subject[];
  defaultSubjectId?: string;
}

export function BuyLessonsDialog({ open, onOpenChange, subjects, defaultSubjectId }: Props) {
  const doCheckout = useServerFn(createLessonCheckout);
  const [subjectId, setSubjectId] = useState(defaultSubjectId ?? subjects[0]?.id ?? "");
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const subject = subjects.find((s) => s.id === subjectId);
  const singleCents = subject?.effective_price_cents ?? 0;
  const pack5Cents = Math.round(singleCents * 5 * 0.95);

  const buyMut = useMutation({
    mutationFn: async (kind: "single" | "pack5") => {
      const res = await doCheckout({
        data: {
          subjectId,
          kind,
          returnUrl: `${window.location.origin}/dashboard?purchase=success`,
          environment: getStripeEnvironment(),
        },
      });
      if ("error" in res) throw new Error(res.error);
      if (!res.clientSecret) throw new Error("Checkout unavailable");
      return res.clientSecret;
    },
    onSuccess: (secret) => setClientSecret(secret),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Checkout failed"),
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      setClientSecret(null);
      buyMut.reset();
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Buy lesson credits</DialogTitle>
          <DialogDescription>
            Credits expire 9 months after purchase. A pack of 5 saves 5% vs. single lessons.
          </DialogDescription>
        </DialogHeader>

        {clientSecret ? (
          <div className="max-h-[70vh] overflow-y-auto">
            <PaymentTestModeBanner />
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Subject</label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — ${(s.effective_price_cents / 100).toFixed(0)}/hr
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => buyMut.mutate("single")}
                disabled={!subjectId || buyMut.isPending}
                className="rounded-lg border bg-card p-4 text-left transition hover:border-primary hover:shadow-sm disabled:opacity-50"
              >
                <div className="text-sm text-muted-foreground">Single lesson</div>
                <div className="mt-1 text-2xl font-semibold">
                  ${(singleCents / 100).toFixed(2)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">1 credit • 1 hour</div>
              </button>

              <button
                type="button"
                onClick={() => buyMut.mutate("pack5")}
                disabled={!subjectId || buyMut.isPending}
                className="relative rounded-lg border-2 border-primary bg-card p-4 text-left transition hover:shadow-sm disabled:opacity-50"
              >
                <div className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  Save 5%
                </div>
                <div className="text-sm text-muted-foreground">Pack of 5</div>
                <div className="mt-1 text-2xl font-semibold">
                  ${(pack5Cents / 100).toFixed(2)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  5 credits • ${(pack5Cents / 5 / 100).toFixed(2)}/hr
                </div>
              </button>
            </div>

            {buyMut.isPending && (
              <p className="text-center text-sm text-muted-foreground">Preparing checkout…</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
