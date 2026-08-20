import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyBilling } from "@/lib/billing.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt } from "lucide-react";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function date(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BillingCard() {
  const fetchBilling = useServerFn(getMyBilling);
  const { data, isLoading } = useQuery({ queryKey: ["my-billing"], queryFn: () => fetchBilling() });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-4 w-4" /> Purchase history
        </CardTitle>
        {data?.nextExpiry && (
          <span className="text-xs text-muted-foreground">
            Next credit expires {date(data.nextExpiry)}
          </span>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Loading…</p>
        ) : !data?.purchases.length ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            No purchases yet. Buy credits to book your first lesson.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Credits</th>
                <th className="px-4 py-3">Expires</th>
              </tr>
            </thead>
            <tbody>
              {data.purchases.map((p, i) => (
                <tr key={p.payment_id ?? i} className="border-b last:border-b-0">
                  <td className="px-4 py-3 whitespace-nowrap">{date(p.purchased_at)}</td>
                  <td className="px-4 py-3">{p.description}</td>
                  <td className="px-4 py-3">{p.total_cents > 0 ? money(p.total_cents) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{p.remaining}</span>
                    <span className="text-muted-foreground"> of {p.quantity} left</span>
                    {p.refunded > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {p.refunded} refunded
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {date(p.expires_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
