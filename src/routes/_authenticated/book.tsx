import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Calendar as CalIcon, Clock } from "lucide-react";
import { listOpenSlots, bookLesson } from "@/lib/booking.functions";
import { getMyAccountOverview } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BuyLessonsDialog } from "@/components/BuyLessonsDialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/book")({
  component: BookPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">Couldn't load booking: {error.message}</div>
  ),
});

function BookPage() {
  const fetchSlots = useServerFn(listOpenSlots);
  const fetchOverview = useServerFn(getMyAccountOverview);
  const doBook = useServerFn(bookLesson);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [studentId, setStudentId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [shortNotice, setShortNotice] = useState(false);
  useEffect(() => {
    setShortNotice(window.localStorage.getItem("admin-short-notice") === "1");
  }, []);

  const viewerTZ = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  const overviewQ = useQuery({
    queryKey: ["account-overview"],
    queryFn: () => fetchOverview(),
  });

  const slotsQ = useQuery({
    queryKey: ["open-slots", shortNotice],
    queryFn: () => fetchSlots({ data: { days: 21, allowShortNotice: shortNotice } }),
  });

  // Auto-select defaults
  const account = overviewQ.data;
  if (account && !studentId && account.students[0]) setStudentId(account.students[0].id);
  if (account && !subjectId && account.subjects[0]) setSubjectId(account.subjects[0].id);

  const bookMut = useMutation({
    mutationFn: (startsAtISO: string) =>
      doBook({ data: { subjectId, studentId, startsAtISO, allowShortNotice: shortNotice } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(
          `No credits available. This lesson costs $${(res.priceCents / 100).toFixed(2)}. Buy credits to continue.`,
        );
        setPendingSlot(null);
        setBuyOpen(true);
        return;
      }
      toast.success("Lesson booked! Confirmation email coming shortly.");
      setPendingSlot(null);
      qc.invalidateQueries({ queryKey: ["open-slots"] });
      qc.invalidateQueries({ queryKey: ["account-overview"] });
      navigate({ to: "/booked/$lessonId", params: { lessonId: res.lessonId } });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Booking failed");
    },
  });

  // Group slots by local date
  const groupedSlots = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const iso of slotsQ.data?.slots ?? []) {
      const key = new Date(iso).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      const arr = map.get(key) ?? [];
      arr.push(iso);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [slotsQ.data]);

  const selectedSubject = account?.subjects.find((s) => s.id === subjectId);
  const selectedStudent = account?.students.find((s) => s.id === studentId);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
          <Badge variant="secondary" className="gap-1">
            <CalIcon className="h-3.5 w-3.5" /> Times in {viewerTZ.replace("_", " ")}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Book a lesson</h1>
        <p className="mt-1 text-muted-foreground">
          Pick a subject, student, and open time. Times shown are in your local timezone.
        </p>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Lesson details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Student</label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue placeholder="Select a student" /></SelectTrigger>
                <SelectContent>
                  {account?.students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Subject</label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue placeholder="Select a subject" /></SelectTrigger>
                <SelectContent>
                  {account?.subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — ${(s.effective_price_cents / 100).toFixed(0)}/hr
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Credits available</label>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                {account ? `${account.credits} credit${account.credits === 1 ? "" : "s"}` : "—"}
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Available times</h2>
            {account?.isAdmin && shortNotice && (
              <Badge variant="secondary">Short-notice times included</Badge>
            )}
          </div>
          {slotsQ.isLoading ? (
            <p className="text-muted-foreground">Loading slots…</p>
          ) : groupedSlots.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              No open slots in the next 3 weeks. Check back soon.
            </Card>
          ) : (
            <div className="space-y-6">
              {groupedSlots.map(([day, isos]) => (
                <div key={day}>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {day}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {isos.map((iso) => (
                      <Button
                        key={iso}
                        variant="outline"
                        size="sm"
                        disabled={!studentId || !subjectId}
                        onClick={() => setPendingSlot(iso)}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(iso).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Dialog open={!!pendingSlot} onOpenChange={(o) => !o && setPendingSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm your lesson</DialogTitle>
            <DialogDescription>
              Review the details below. Booking will use one of your credits.
            </DialogDescription>
          </DialogHeader>
          {pendingSlot && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Student</span><span className="font-medium">{selectedStudent?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Subject</span><span className="font-medium">{selectedSubject?.name}</span></div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">When</span>
                <span className="font-medium">
                  {new Date(pendingSlot).toLocaleString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                    timeZoneName: "short",
                  })}
                </span>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span className="font-medium">1 hour</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Cost</span><span className="font-medium">1 credit</span></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingSlot(null)}>Cancel</Button>
            <Button
              disabled={bookMut.isPending || !pendingSlot}
              onClick={() => pendingSlot && bookMut.mutate(pendingSlot)}
            >
              {bookMut.isPending ? "Booking…" : "Confirm booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {account && (
        <BuyLessonsDialog
          open={buyOpen}
          onOpenChange={setBuyOpen}
          subjects={account.subjects}
          defaultSubjectId={subjectId || undefined}
        />
      )}
    </div>
  );
}
