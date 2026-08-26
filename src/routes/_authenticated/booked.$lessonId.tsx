import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarPlus, CheckCircle2, Clock, Video } from "lucide-react";
import { getLessonConfirmation } from "@/lib/lessons.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/booked/$lessonId")({
  component: BookedPage,
  head: () => ({
    meta: [
      { title: "Lesson confirmed — Brian Morgan Tutoring" },
      {
        name: "description",
        content: "Your tutoring lesson is confirmed. View the details, join link, and calendar invite.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function BookedPage() {
  const { lessonId } = Route.useParams();
  const fetchConfirmation = useServerFn(getLessonConfirmation);

  const { data, isLoading, error } = useQuery({
    queryKey: ["lesson-confirmation", lessonId],
    queryFn: () => fetchConfirmation({ data: { lessonId } }),
  });

  function downloadIcs() {
    if (!data) return;
    const blob = new Blob([data.ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lesson-${data.lesson.id.slice(0, 8)}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return <div className="mx-auto max-w-2xl p-8 text-sm text-muted-foreground">Loading your confirmation…</div>;
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <p className="text-sm text-destructive">We couldn't load this lesson.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  const { lesson, zoomLink, tutorName, cancellationHours } = data;
  const start = new Date(lesson.startsAt);
  const when = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(start);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex flex-col items-center text-center">
        <CheckCircle2 className="h-12 w-12 text-primary" aria-hidden="true" />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">You're booked</h1>
        <p className="mt-2 text-muted-foreground">
          {lesson.googleSynced
            ? "A calendar invite with the join link is on its way to your inbox."
            : "A confirmation email with the join link is on its way to your inbox."}
        </p>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{lesson.subjectName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium">{when}</p>
              <p className="text-muted-foreground">
                {lesson.durationMinutes} minutes with {tutorName} · Student: {lesson.studentName}
              </p>
            </div>
          </div>

          {zoomLink ? (
            <div className="flex items-start gap-3">
              <Video className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium">Zoom link</p>
                <a
                  href={zoomLink}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-primary underline underline-offset-4"
                >
                  {zoomLink}
                </a>
              </div>
            </div>
          ) : null}

          <p className="text-muted-foreground">
            Need to change plans? You can cancel or reschedule up to {cancellationHours} hours before
            the lesson and keep your credit.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={downloadIcs}>
              <CalendarPlus className="mr-2 h-4 w-4" aria-hidden="true" />
              Download calendar invite
            </Button>
            <Button asChild variant="outline">
              <Link to="/lessons">View my lessons</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
