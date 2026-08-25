import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getMyAccountOverview, ensureMyAccount } from "@/lib/account.functions";
import { getPublicHomeData } from "@/lib/public-data.functions";
import { syncMyPurchases } from "@/lib/billing.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Coins, LogOut, ShieldCheck, Users, BookOpen, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { BuyLessonsDialog } from "@/components/BuyLessonsDialog";
import { StudentsCard } from "@/components/StudentsCard";
import { BillingCard } from "@/components/BillingCard";
import { AccountSettingsDialog } from "@/components/AccountSettingsDialog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">Couldn't load dashboard: {error.message}</div>
  ),
});

function Dashboard() {
  const fetchOverview = useServerFn(getMyAccountOverview);
  const provisionAccount = useServerFn(ensureMyAccount);
  
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [buyOpen, setBuyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const reconcile = useServerFn(syncMyPurchases);

  // Refresh on return from Stripe checkout, then reconcile against Stripe in
  // case the webhook is delayed or never arrives.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("purchase") !== "success") return;
    toast.success("Payment received! Adding your credits…");
    url.searchParams.delete("purchase");
    window.history.replaceState({}, "", url.toString());

    const refresh = () => {
      qc.invalidateQueries({ queryKey: ["account-overview"] });
      qc.invalidateQueries({ queryKey: ["my-billing"] });
    };
    const timers = [1000, 3000].map((ms) => setTimeout(refresh, ms));

    // Safety net: pull paid sessions straight from Stripe and grant anything missing.
    const fallback = setTimeout(async () => {
      try {
        const res = await reconcile({ data: { environment: getStripeEnvironment() } });
        if (res.granted > 0) toast.success(`${res.granted} credit(s) added to your account.`);
      } catch {
        /* silent — the webhook may still land */
      } finally {
        refresh();
      }
    }, 5000);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(fallback);
    };
  }, [qc, reconcile]);

  const { data, isLoading } = useQuery({
    queryKey: ["account-overview"],
    queryFn: () => fetchOverview(),
  });

  const fetchHome = useServerFn(getPublicHomeData);
  const { data: home } = useQuery({ queryKey: ["public-home"], queryFn: () => fetchHome() });
  const bundleSize = home?.settings?.bundle_size ?? 5;
  const bundleDiscountPct = home?.settings?.bundle_discount_pct ?? 10;
  const creditExpiryMonths = home?.settings?.credit_expiry_months ?? 9;

  // Backfill for users whose signup happened before ensureMyAccount ran (e.g. email-confirmation flow).
  useEffect(() => {
    if (!data || data.account) return;
    supabase.auth.getUser().then(async ({ data: u }) => {
      const user = u.user;
      if (!user) return;
      const tz =
        (user.user_metadata?.timezone as string | undefined) ??
        Intl.DateTimeFormat().resolvedOptions().timeZone ??
        "America/New_York";
      const displayName =
        (user.user_metadata?.parent_name as string | undefined) ??
        user.email?.split("@")[0] ??
        "Family";
      try {
        await provisionAccount({ data: { displayName, timezone: tz } });
        qc.invalidateQueries({ queryKey: ["account-overview"] });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Setup failed");
      }
    });
  }, [data, provisionAccount, qc]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { redirect: undefined }, replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-display text-xl font-semibold text-primary">
            Brian Morgan Tutoring
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/lessons">My lessons</Link>
            </Button>
            {data?.isAdmin && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin">
                  <ShieldCheck className="h-4 w-4" /> Admin
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !data?.account ? (
          <Card className="p-8 text-center">
            <p>Setting up your account…</p>
          </Card>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-semibold">Welcome, {data.account.display_name}</h1>
              <p className="mt-1 text-muted-foreground">
                Times shown in <span className="font-medium text-foreground">{data.account.timezone.replace("_", " ")}</span>.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={<Coins className="h-5 w-5" />} label="Available credits" value={data.credits.toString()} />
              <StatCard icon={<Users className="h-5 w-5" />} label="Students" value={data.students.length.toString()} />
              <StatCard
                icon={<CalendarDays className="h-5 w-5" />}
                label="Upcoming lessons"
                value={(data.upcomingLessons ?? 0).toString()}
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/book">
                  <CalendarDays className="h-4 w-4" /> Book a lesson
                </Link>
              </Button>
              <Button size="lg" variant="outline" onClick={() => setBuyOpen(true)}>
                <BookOpen className="h-4 w-4" /> Buy credits
              </Button>
              <Button size="lg" variant="ghost" onClick={() => setSettingsOpen(true)}>
                <Settings className="h-4 w-4" /> Account settings
              </Button>
            </div>
            {data.nextCreditExpiry && (
              <p className="mt-3 text-sm text-muted-foreground">
                Your next credit expires on{" "}
                {new Date(data.nextCreditExpiry).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
                .
              </p>
            )}

            <section className="mt-10">
              <StudentsCard students={data.students} />
            </section>

            <section className="mt-10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Subjects &amp; pricing</h2>
                <Button variant="outline" size="sm" onClick={() => setBuyOpen(true)}>
                  <BookOpen className="h-4 w-4" /> Buy credits
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Subject</th>
                        <th className="px-4 py-3">Price per hour</th>
                        <th className="px-4 py-3">
                          Pack of {bundleSize} ({bundleDiscountPct}% off)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.subjects.map((s) => {
                        const bundle = Math.round(
                          s.effective_price_cents * bundleSize * (1 - bundleDiscountPct / 100),
                        );
                        return (
                          <tr key={s.id} className="border-b last:border-b-0">
                            <td className="px-4 py-3 font-medium">
                              {s.name}
                              {s.has_custom_price && (
                                <Badge variant="secondary" className="ml-2">
                                  Your price
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">{formatMoney(s.effective_price_cents)}</td>
                            <td className="px-4 py-3">{formatMoney(bundle)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </section>

            <section className="mt-10">
              <BillingCard />
            </section>
          </>
        )}
      </main>

      {data?.account && (
        <>
          <BuyLessonsDialog
            open={buyOpen}
            onOpenChange={setBuyOpen}
            subjects={data.subjects}
            trialSubject={data.trialSubject}
            bundleSize={bundleSize}
            bundleDiscountPct={bundleDiscountPct}
            creditExpiryMonths={creditExpiryMonths}
          />
          <AccountSettingsDialog
            key={`${data.account.display_name}-${data.account.timezone}`}
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            displayName={data.account.display_name}
            timezone={data.account.timezone}
          />
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
