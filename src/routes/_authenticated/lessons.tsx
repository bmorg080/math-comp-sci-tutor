import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Video, X, Calendar, Clock, ExternalLink, CalendarClock } from "lucide-react";
import { listMyLessons, cancelMyLesson, rescheduleMyLesson } from "@/lib/lessons.functions";
import { listOpenSlots } from "@/lib/booking.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/lessons")({
  component: LessonsPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">Couldn't load lessons: {error.message}</div>
  ),
});

function LessonsPage() {
  const fetchLessons = useServerFn(listMyLessons);
  const doCancel = useServerFn(cancelMyLesson);
  const doReschedule = useServerFn(rescheduleMyLesson);
  const fetchSlots = useServerFn(listOpenSlots);
  const qc = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);

  const viewerTZ = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  const q = useQuery({ queryKey: ["my-lessons"], queryFn: () => fetchLessons() });
  const slotsQ = useQuery({
    queryKey: ["open-slots"],
    queryFn: () => fetchSlots({ data: { days: 21 } }),
    enabled: !!rescheduleId,
  });

  const cancelMut = useMutation({
    mutationFn: (lessonId: string) => doCancel({ data: { lessonId } }),
    onSuccess: (res) => {
      toast.success(
        res.refunded ? "Lesson cancelled — credit refunded." : "Lesson cancelled (past cancellation window — no refund).",
      );
      setConfirmId(null);
      qc.invalidateQueries({ queryKey: ["my-lessons"] });
      qc.invalidateQueries({ queryKey: ["account-overview"] });
      qc.invalidateQueries({ queryKey: ["open-slots"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rescheduleMut = useMutation({
    mutationFn: (v: { lessonId: string; startsAtISO: string }) =>
      doReschedule({ data: v }),
    onSuccess: () => {
      toast.success("Lesson rescheduled — confirmation email sent.");
      setRescheduleId(null);
      qc.invalidateQueries({ queryKey: ["my-lessons"] });
      qc.invalidateQueries({ queryKey: ["open-slots"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    }).format(new Date(iso));

  const upcoming = q.data?.upcoming ?? [];
  const past = q.data?.past ?? [];
  const cancellationHours = q.data?.cancellationHours ?? 24;
  const zoomLink = q.data?.zoomLink ?? "";
  const pendingLesson = upcoming.find((l) => l.id === confirmId);
  const pendingRefundable = pendingLesson
    ? (new Date(pendingLesson.starts_at).getTime() - Date.now()) / 3600000 >= cancellationHours
    : false;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <h1 className="text-lg font-semibold">My lessons</h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-10">
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Upcoming</h2>
            <p className="text-xs text-muted-foreground">Times shown in {viewerTZ}</p>
          </div>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : upcoming.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No upcoming lessons.{" "}
                <Link to="/book" className="text-primary underline underline-offset-2">
                  Book one
                </Link>
                .
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcoming.map((l) => (
                <Card key={l.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Calendar className="h-4 w-4 text-primary" />
                        {fmt(l.starts_at)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{l.subject?.name}</span>
                        {" · "}
                        {l.student?.name}
                        {" · "}
                        {l.duration_minutes} min
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {zoomLink ? (
                        <Button asChild variant="secondary" size="sm">
                          <a href={zoomLink} target="_blank" rel="noreferrer">
                            <Video className="mr-1.5 h-4 w-4" /> Join Zoom
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </Button>
                      ) : null}
                      {(new Date(l.starts_at).getTime() - Date.now()) / 3600000 >= cancellationHours ? (
                        <Button variant="ghost" size="sm" onClick={() => setRescheduleId(l.id)}>
                          <CalendarClock className="mr-1 h-4 w-4" /> Reschedule
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="sm" onClick={() => setConfirmId(l.id)}>
                        <X className="mr-1 h-4 w-4" /> Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold">History</h2>
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">No past lessons yet.</p>
          ) : (
            <div className="space-y-2">
              {past.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/50 bg-card/50 px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{fmt(l.starts_at)}</span>
                    <span className="text-muted-foreground">
                      {l.subject?.name} · {l.student?.name}
                    </span>
                  </div>
                  <Badge variant={l.status === "completed" ? "default" : "secondary"}>{l.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this lesson?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRefundable
                ? `You're within the ${cancellationHours}-hour cancellation window — your credit will be refunded and you can book another time.`
                : `This lesson starts in less than ${cancellationHours} hours. Per the cancellation policy, the credit will NOT be refunded.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep lesson</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmId && cancelMut.mutate(confirmId)}
              disabled={cancelMut.isPending}
            >
              {cancelMut.isPending ? "Cancelling…" : "Cancel lesson"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!rescheduleId} onOpenChange={(o) => !o && setRescheduleId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reschedule lesson</DialogTitle>
            <DialogDescription>
              Pick a new open time. Times are shown in {viewerTZ}. Rescheduling is available up to {cancellationHours} hours before the lesson.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-4 pr-1">
            {slotsQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading available times…</p>
            ) : (slotsQ.data?.slots ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No open times in the next 3 weeks.</p>
            ) : (
              Object.entries(
                (slotsQ.data?.slots ?? []).reduce<Record<string, string[]>>((acc, iso) => {
                  const key = new Intl.DateTimeFormat("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  }).format(new Date(iso));
                  (acc[key] ||= []).push(iso);
                  return acc;
                }, {}),
              ).map(([day, isos]) => (
                <div key={day}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{day}</p>
                  <div className="flex flex-wrap gap-2">
                    {isos.map((iso) => (
                      <Button
                        key={iso}
                        variant="outline"
                        size="sm"
                        disabled={rescheduleMut.isPending}
                        onClick={() =>
                          rescheduleId &&
                          rescheduleMut.mutate({ lessonId: rescheduleId, startsAtISO: iso })
                        }
                      >
                        {new Intl.DateTimeFormat("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        }).format(new Date(iso))}
                      </Button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRescheduleId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
