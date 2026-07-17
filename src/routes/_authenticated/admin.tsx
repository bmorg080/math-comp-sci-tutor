import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Save, Video, UserPlus, X } from "lucide-react";
import {
  getAdminOverview,
  updateSettings,
  grantCredits,
  cancelLessonAsAdmin,
} from "@/lib/admin.functions";
import { getMyAccountOverview } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

function AdminPage() {
  const fetchOverview = useServerFn(getMyAccountOverview);
  const fetchAdmin = useServerFn(getAdminOverview);
  const doUpdate = useServerFn(updateSettings);
  const doGrant = useServerFn(grantCredits);
  const doCancel = useServerFn(cancelLessonAsAdmin);
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

  const cancelMut = useMutation({
    mutationFn: (lessonId: string) => doCancel({ data: { lessonId, refund: true } }),
    onSuccess: () => {
      toast.success("Lesson cancelled and credit refunded.");
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

        {/* Upcoming lessons */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming lessons</CardTitle>
            <CardDescription>All scheduled lessons across every student.</CardDescription>
          </CardHeader>
          <CardContent>
            {!data ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : data.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming lessons.</p>
            ) : (
              <div className="space-y-2">
                {data.upcoming.map((l) => (
                  <div
                    key={l.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/50 px-4 py-3 text-sm"
                  >
                    <div>
                      <div className="font-medium">{fmt(l.starts_at)}</div>
                      <div className="text-muted-foreground">
                        {l.subject?.name} · {l.student?.name} · {l.account?.display_name}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelMut.mutate(l.id)}
                      disabled={cancelMut.isPending}
                    >
                      <X className="mr-1 h-4 w-4" /> Cancel + refund
                    </Button>
                  </div>
                ))}
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
          </CardHeader>
          <CardContent>
            {(data?.recent ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No history yet.</p>
            ) : (
              <div className="space-y-1.5">
                {data!.recent.map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-md bg-card/50 px-3 py-2 text-sm">
                    <span>
                      {fmt(l.starts_at)} · {l.subject?.name} · {l.student?.name}
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
    </div>
  );
}
