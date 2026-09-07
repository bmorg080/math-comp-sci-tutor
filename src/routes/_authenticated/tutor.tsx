import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, DollarSign, Users } from "lucide-react";
import { getMyAccountOverview } from "@/lib/account.functions";
import { getTutorDashboard } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/tutor")({
  beforeLoad: async () => {
    const overview = await getMyAccountOverview();
    if (!overview?.isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: TutorDashboard,
  head: () => ({
    meta: [
      { title: "Tutor Dashboard | Brian Morgan Tutoring" },
      {
        name: "description",
        content:
          "Private tutor view of booked lessons, payments received and a calendar of upcoming sessions.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Tutor Dashboard | Brian Morgan Tutoring" },
      {
        property: "og:description",
        content: "Booked lessons, payments received and upcoming sessions at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">Tutor dashboard: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Page not found.</div>,
});

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

type Lesson = {
  id: string;
  starts_at: string;
  status: string;
  student: { name: string } | null;
  subject: { name: string } | null;
  account: { display_name: string } | null;
};

function TutorDashboard() {
  const fetchDash = useServerFn(getTutorDashboard);
  const q = useQuery({ queryKey: ["tutor-dashboard"], queryFn: () => fetchDash() });

  const [monthOffset, setMonthOffset] = useState(0);
  const today = new Date();
  const viewMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);

  const lessons = (q.data?.lessons ?? []) as Lesson[];

  const byDay = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    for (const l of lessons) {
      const d = new Date(l.starts_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, [...(map.get(key) ?? []), l]);
    }
    return map;
  }, [lessons]);

  const grid = useMemo(() => {
    const first = new Date(viewMonth);
    const startPad = first.getDay();
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const cells: Array<Date | null> = Array.from({ length: startPad }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);

  const [selected, setSelected] = useState<string | null>(null);
  const selectedLessons = selected ? (byDay.get(selected) ?? []) : [];

  const stats = q.data?.stats;
  const revenue = q.data?.revenue;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tutor dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Booked lessons, payments received and your upcoming schedule.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="mr-1 h-4 w-4" /> My dashboard
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin">Admin tools</Link>
            </Button>
          </div>
        </div>

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={<CalendarDays className="h-4 w-4" />}
                label="Upcoming lessons"
                value={String(stats?.upcomingCount ?? 0)}
                hint={`${stats?.thisWeekCount ?? 0} in the next 7 days`}
              />
              <StatCard
                icon={<DollarSign className="h-4 w-4" />}
                label="Received this month"
                value={money(revenue?.thisMonthCents ?? 0)}
                hint={`${money(revenue?.last30Cents ?? 0)} in the last 30 days`}
              />
              <StatCard
                icon={<DollarSign className="h-4 w-4" />}
                label="Total received"
                value={money(revenue?.allTimeCents ?? 0)}
                hint="All recorded payments"
              />
              <StatCard
                icon={<Users className="h-4 w-4" />}
                label="Completed lessons"
                value={String(stats?.completedCount ?? 0)}
                hint={`${stats?.cancelledCount ?? 0} cancelled recently`}
              />
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Calendar</CardTitle>
                  <CardDescription>
                    {viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" onClick={() => setMonthOffset((m) => m - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setMonthOffset(0)}>
                    Today
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setMonthOffset((m) => m + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {grid.map((date, i) => {
                    if (!date) return <div key={i} className="min-h-20 rounded-md" />;
                    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                    const items = (byDay.get(key) ?? []).filter((l) => l.status !== "cancelled");
                    const isToday = date.toDateString() === today.toDateString();
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelected(items.length ? key : null)}
                        className={`min-h-20 rounded-md border p-1 text-left align-top transition-colors ${
                          isToday ? "border-primary" : "border-border"
                        } ${items.length ? "bg-muted/50 hover:bg-muted" : "hover:bg-muted/30"}`}
                      >
                        <span className={`text-xs ${isToday ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                          {date.getDate()}
                        </span>
                        <div className="mt-1 space-y-0.5">
                          {items.slice(0, 2).map((l) => (
                            <div
                              key={l.id}
                              className="truncate rounded bg-primary/10 px-1 py-0.5 text-[10px] text-primary"
                            >
                              {timeLabel(l.starts_at)} {l.student?.name ?? "Student"}
                            </div>
                          ))}
                          {items.length > 2 && (
                            <div className="px-1 text-[10px] text-muted-foreground">
                              +{items.length - 2} more
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selected && selectedLessons.length > 0 && (
                  <div className="rounded-md border p-3">
                    <p className="mb-2 text-sm font-medium">
                      {dayLabel(selectedLessons[0]!.starts_at)}
                    </p>
                    <ul className="space-y-1 text-sm">
                      {selectedLessons.map((l) => (
                        <li key={l.id} className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{timeLabel(l.starts_at)}</span>
                          <span>{l.subject?.name ?? "Lesson"}</span>
                          <span className="text-muted-foreground">
                            {l.student?.name ?? "Student"} · {l.account?.display_name ?? "Family"}
                          </span>
                          <Badge variant={l.status === "scheduled" ? "secondary" : "outline"}>
                            {l.status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Booked lessons</CardTitle>
                  <CardDescription>Upcoming scheduled sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  {(q.data?.upcoming ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No upcoming lessons.</p>
                  ) : (
                    <ul className="divide-y">
                      {(q.data!.upcoming as Lesson[]).map((l) => (
                        <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                          <div>
                            <p className="text-sm font-medium">
                              {dayLabel(l.starts_at)} · {timeLabel(l.starts_at)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {l.subject?.name ?? "Lesson"} · {l.student?.name ?? "Student"} (
                              {l.account?.display_name ?? "Family"})
                            </p>
                          </div>
                          <Badge variant="secondary">scheduled</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Payments received</CardTitle>
                  <CardDescription>Most recent purchases</CardDescription>
                </CardHeader>
                <CardContent>
                  {(q.data?.payments ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No payments yet.</p>
                  ) : (
                    <ul className="divide-y">
                      {q.data!.payments.map((p) => (
                        <li key={p.key} className="flex items-center justify-between gap-3 py-2">
                          <div>
                            <p className="text-sm font-medium">{p.account_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {dayLabel(p.purchased_at)} · {p.description} ×{p.quantity}
                              {p.refunded > 0 ? ` · ${p.refunded} refunded` : ""}
                            </p>
                          </div>
                          <span className="text-sm font-semibold">{money(p.total_cents)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
