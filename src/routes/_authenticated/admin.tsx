import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Save, Video, UserPlus, X, Users, CalendarClock, Pencil } from "lucide-react";
import {
  getAdminOverview,
  updateSettings,
  grantCredits,
  cancelLessonAsAdmin,
  rescheduleLessonAsAdmin,
} from "@/lib/admin.functions";
import { SubjectsEditor } from "@/components/admin/SubjectsEditor";
import { AvailabilityEditor } from "@/components/admin/AvailabilityEditor";
// keep original import terminator below
import { getMyAccountOverview as _keep } from "@/lib/account.functions";
void _keep;
import { getMyAccountOverview } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">Admin: {error.message}</div>
  ),
});

type UpcomingLesson = {
  id: string;
  starts_at: string;
  credit_id: string | null;
  student: { name: string } | null;
  subject: { name: string } | null;
  account: { display_name: string } | null;
};

function AdminPage() {
  const fetchOverview = useServerFn(getMyAccountOverview);
  const fetchAdmin = useServerFn(getAdminOverview);
  const doUpdate = useServerFn(updateSettings);
  const doGrant = useServerFn(grantCredits);
  const doCancel = useServerFn(cancelLessonAsAdmin);
  const doReschedule = useServerFn(rescheduleLessonAsAdmin);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const meQ = useQuery({ queryKey: ["account-overview"], queryFn: () => fetchOverview() });
  const isAdmin = meQ.data?.isAdmin === true;

  useEffect(() => {
    if (meQ.data && !isAdmin) {
      toast.error("Admin access required.");
      navigate({ to: "/dashboard" });
    }
  }, [meQ.data, isAdmin, navigate]);

  const adminQ = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchAdmin(),
    enabled: isAdmin,
  });

  const [form, setForm] = useState({
    zoom_link: "",
    tutor_name: "",
    tutor_email: "",
    tutor_bio: "",
    cancellation_hours: 24,
  });

  useEffect(() => {
    const s = adminQ.data?.settings;
    if (s) {
      setForm({
        zoom_link: s.zoom_link ?? "",
        tutor_name: s.tutor_name ?? "",
        tutor_email: s.tutor_email ?? "",
        tutor_bio: s.tutor_bio ?? "",
        cancellation_hours: s.cancellation_hours ?? 24,
      });
    }
  }, [adminQ.data?.settings]);

  const saveMut = useMutation({
    mutationFn: () => doUpdate({ data: form }),
    onSuccess: () => {
      toast.success("Settings saved.");
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [grantAccount, setGrantAccount] = useState<string>("");
  const [grantQty, setGrantQty] = useState<number>(1);
  const [grantNote, setGrantNote] = useState<string>("");

  const grantMut = useMutation({
    mutationFn: () => doGrant({ data: { accountId: grantAccount, quantity: grantQty, note: grantNote || undefined } }),
    onSuccess: (r) => {
      toast.success(`Granted ${r.inserted} credit(s).`);
      setGrantQty(1);
      setGrantNote("");
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Cancel dialog state (policy-aware refund)
  const [cancelTarget, setCancelTarget] = useState<UpcomingLesson | null>(null);
  const [cancelRefund, setCancelRefund] = useState(true);
  const [cancelReason, setCancelReason] = useState("");

  const cancellationHours = adminQ.data?.settings?.cancellation_hours ?? 24;
  const cancelHoursUntil = cancelTarget
    ? (new Date(cancelTarget.starts_at).getTime() - Date.now()) / 3_600_000
    : 0;
  const cancelWithinPolicy = cancelHoursUntil >= cancellationHours;

  useEffect(() => {
    if (cancelTarget) {
      setCancelRefund(true); // admin default: always refund; policy is informational
      setCancelReason("");
    }
  }, [cancelTarget]);

  const cancelMut = useMutation({
    mutationFn: () =>
      doCancel({
        data: {
          lessonId: cancelTarget!.id,
          refund: cancelRefund,
          reason: cancelReason || undefined,
        },
      }),
    onSuccess: () => {
      toast.success(cancelRefund ? "Lesson cancelled and credit refunded." : "Lesson cancelled (no refund).");
      setCancelTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Reschedule dialog
  const [rescheduleTarget, setRescheduleTarget] = useState<UpcomingLesson | null>(null);
  const [rescheduleLocal, setRescheduleLocal] = useState("");

  useEffect(() => {
    if (rescheduleTarget) {
      // Convert UTC to local datetime-local format
      const d = new Date(rescheduleTarget.starts_at);
      const pad = (n: number) => String(n).padStart(2, "0");
      setRescheduleLocal(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
      );
    }
  }, [rescheduleTarget]);

  const rescheduleMut = useMutation({
    mutationFn: () =>
      doReschedule({
        data: {
          lessonId: rescheduleTarget!.id,
          startsAt: new Date(rescheduleLocal).toISOString(),
        },
      }),
    onSuccess: () => {
      toast.success("Lesson rescheduled.");
      setRescheduleTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));

  const [customerFilter, setCustomerFilter] = useState("");
  const filteredAccounts = useMemo(() => {
    const q = customerFilter.trim().toLowerCase();
    const list = adminQ.data?.accounts ?? [];
    if (!q) return list;
    return list.filter((a) => a.display_name?.toLowerCase().includes(q));
  }, [adminQ.data?.accounts, customerFilter]);

  if (!isAdmin) return <div className="p-8 text-sm text-muted-foreground">Checking access…</div>;

  const data = adminQ.data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <h1 className="text-lg font-semibold">Admin</h1>
          <Badge variant="secondary">Tutor</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-6 py-10">
        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" /> Tutor settings
            </CardTitle>
            <CardDescription>
              Zoom link is shared with students for every scheduled lesson.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="zoom">Zoom link</Label>
              <Input
                id="zoom"
                placeholder="https://zoom.us/j/..."
                value={form.zoom_link}
                onChange={(e) => setForm({ ...form, zoom_link: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="tname">Tutor name</Label>
              <Input
                id="tname"
                value={form.tutor_name}
                onChange={(e) => setForm({ ...form, tutor_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="temail">Tutor email (for notifications)</Label>
              <Input
                id="temail"
                type="email"
                value={form.tutor_email}
                onChange={(e) => setForm({ ...form, tutor_email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="chours">Cancellation window (hours)</Label>
              <Input
                id="chours"
                type="number"
                min={0}
                max={168}
                value={form.cancellation_hours}
                onChange={(e) =>
                  setForm({ ...form, cancellation_hours: Number(e.target.value || 0) })
                }
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="bio">Tutor bio</Label>
              <Textarea
                id="bio"
                rows={4}
                value={form.tutor_bio}
                onChange={(e) => setForm({ ...form, tutor_bio: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                <Save className="mr-1.5 h-4 w-4" /> {saveMut.isPending ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Customers
            </CardTitle>
            <CardDescription>
              {data ? `${data.accounts.length} total` : "Loading…"} · credit balance and lesson counts per family.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search by name…"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="max-w-sm"
            />
            {!data ? null : filteredAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No customers match.</p>
            ) : (
              <div className="overflow-hidden rounded-md border border-border/50">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Family</th>
                      <th className="px-3 py-2">Timezone</th>
                      <th className="px-3 py-2 text-right">Credits</th>
                      <th className="px-3 py-2 text-right">Upcoming</th>
                      <th className="px-3 py-2 text-right">Completed</th>
                      <th className="px-3 py-2 text-right">Cancelled</th>
                      <th className="px-3 py-2">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredAccounts.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{a.display_name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{a.timezone}</td>
                        <td className="px-3 py-2 text-right">{a.credits}</td>
                        <td className="px-3 py-2 text-right">{a.lessons.upcoming}</td>
                        <td className="px-3 py-2 text-right">{a.lessons.completed}</td>
                        <td className="px-3 py-2 text-right">{a.lessons.cancelled}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(a.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming lessons */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" /> Upcoming lessons
            </CardTitle>
            <CardDescription>Reschedule or cancel any scheduled lesson.</CardDescription>
          </CardHeader>
          <CardContent>
            {!data ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : data.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming lessons.</p>
            ) : (
              <div className="space-y-2">
                {data.upcoming.map((l) => {
                  const hoursUntil = (new Date(l.starts_at).getTime() - Date.now()) / 3_600_000;
                  const withinPolicy = hoursUntil >= cancellationHours;
                  return (
                    <div
                      key={l.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/50 px-4 py-3 text-sm"
                    >
                      <div>
                        <div className="font-medium">{fmt(l.starts_at)}</div>
                        <div className="text-muted-foreground">
                          {l.subject?.name} · {l.student?.name} · {l.account?.display_name}
                        </div>
                        <div className="mt-0.5 text-xs">
                          {withinPolicy ? (
                            <span className="text-muted-foreground">
                              {Math.round(hoursUntil)}h away · within {cancellationHours}h policy
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">
                              {Math.round(hoursUntil)}h away · late cancel (policy: {cancellationHours}h)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRescheduleTarget(l as UpcomingLesson)}
                        >
                          <Pencil className="mr-1 h-4 w-4" /> Reschedule
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCancelTarget(l as UpcomingLesson)}
                        >
                          <X className="mr-1 h-4 w-4" /> Cancel
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grant credits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" /> Grant credits
            </CardTitle>
            <CardDescription>Manually add credits to a family (e.g. make-goods).</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label>Account</Label>
              <Select value={grantAccount} onValueChange={setGrantAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a family…" />
                </SelectTrigger>
                <SelectContent>
                  {(data?.accounts ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={grantQty}
                onChange={(e) => setGrantQty(Number(e.target.value || 1))}
              />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                onClick={() => grantMut.mutate()}
                disabled={!grantAccount || grantMut.isPending}
              >
                {grantMut.isPending ? "Granting…" : "Grant"}
              </Button>
            </div>
            <div className="md:col-span-4">
              <Label>Internal note (optional)</Label>
              <Input value={grantNote} onChange={(e) => setGrantNote(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Recent lessons */}
        <Card>
          <CardHeader>
            <CardTitle>Recent history</CardTitle>
            <CardDescription>Last 50 past lessons across all customers.</CardDescription>
          </CardHeader>
          <CardContent>
            {(data?.recent ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No history yet.</p>
            ) : (
              <div className="space-y-1.5">
                {data!.recent.map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-md bg-card/50 px-3 py-2 text-sm">
                    <span>
                      {fmt(l.starts_at)} · {l.subject?.name} · {l.student?.name} · {l.account?.display_name}
                    </span>
                    <Badge variant={l.status === "completed" ? "default" : "secondary"}>
                      {l.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Cancel dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel lesson</DialogTitle>
            <DialogDescription>
              {cancelTarget && (
                <>
                  {fmt(cancelTarget.starts_at)} · {cancelTarget.subject?.name} ·{" "}
                  {cancelTarget.student?.name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div
              className={`rounded-md border px-3 py-2 ${
                cancelWithinPolicy
                  ? "border-border/50 text-muted-foreground"
                  : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300"
              }`}
            >
              {cancelWithinPolicy
                ? `Within the ${cancellationHours}h policy — refund is standard.`
                : `Outside the ${cancellationHours}h policy (${Math.max(
                    0,
                    Math.round(cancelHoursUntil),
                  )}h away). Student would normally NOT be refunded.`}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="refund"
                checked={cancelRefund}
                onCheckedChange={(v) => setCancelRefund(v === true)}
              />
              <Label htmlFor="refund" className="cursor-pointer">
                Refund credit to student
              </Label>
            </div>
            <div>
              <Label htmlFor="reason">Reason (optional, shared internally)</Label>
              <Textarea
                id="reason"
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelTarget(null)}>
              Never mind
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMut.mutate()}
              disabled={cancelMut.isPending}
            >
              {cancelMut.isPending ? "Cancelling…" : "Cancel lesson"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog */}
      <Dialog open={!!rescheduleTarget} onOpenChange={(o) => !o && setRescheduleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule lesson</DialogTitle>
            <DialogDescription>
              {rescheduleTarget && (
                <>
                  Currently {fmt(rescheduleTarget.starts_at)} · {rescheduleTarget.subject?.name} ·{" "}
                  {rescheduleTarget.student?.name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <Label htmlFor="newtime">New date &amp; time (your local timezone)</Label>
              <Input
                id="newtime"
                type="datetime-local"
                value={rescheduleLocal}
                onChange={(e) => setRescheduleLocal(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Credit stays with the lesson; both parties will receive an updated notification if configured.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRescheduleTarget(null)}>
              Never mind
            </Button>
            <Button
              onClick={() => rescheduleMut.mutate()}
              disabled={!rescheduleLocal || rescheduleMut.isPending}
            >
              {rescheduleMut.isPending ? "Saving…" : "Save new time"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
