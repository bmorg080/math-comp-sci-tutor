import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { ArrowLeft, Calendar as CalIcon, Clock, LogIn } from "lucide-react";
import { listPublicOpenSlots } from "@/lib/public-booking.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/availability")({
  head: () => ({
    meta: [
      { title: "Open lesson times — Brian Morgan Tutoring" },
      {
        name: "description",
        content:
          "Browse open 1-hour tutoring slots in your local timezone. Create an account to book a lesson.",
      },
      { property: "og:title", content: "Open lesson times — Brian Morgan Tutoring" },
      {
        property: "og:description",
        content: "See when your tutor is available and grab a time that works.",
      },
    ],
  }),
  component: AvailabilityPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">Couldn't load availability: {error.message}</div>
  ),
});

function AvailabilityPage() {
  const fetchSlots = useServerFn(listPublicOpenSlots);

  const viewerTZ = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  const slotsQ = useQuery({
    queryKey: ["public-open-slots"],
    queryFn: () => fetchSlots({ data: { days: 28 } }),
  });

  const groupedSlots = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const iso of slotsQ.data?.slots ?? []) {
      const key = new Date(iso).toLocaleDateString(undefined, {
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <CalIcon className="h-3.5 w-3.5" /> {viewerTZ.replace("_", " ")}
            </Badge>
            <Button asChild size="sm">
              <Link to="/auth" search={{ redirect: "/book" }}>
                <LogIn className="h-3.5 w-3.5" /> Sign in to book
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold sm:text-4xl">Open lesson times</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Times below are 1-hour slots shown in your local timezone. Create an account
          or sign in to reserve one — booking confirms your slot and emails the Zoom
          link.
        </p>

        <section className="mt-8">
          {slotsQ.isLoading ? (
            <p className="text-muted-foreground">Loading available times…</p>
          ) : groupedSlots.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              No open slots in the next 4 weeks. Check back soon.
            </Card>
          ) : (
            <div className="space-y-6">
              {groupedSlots.map(([day, isos]) => (
                <div key={day}>
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {day}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {isos.map((iso) => (
                      <Button
                        key={iso}
                        asChild
                        variant="outline"
                        size="sm"
                        title="Sign in to book this time"
                      >
                        <Link to="/auth" search={{ redirect: "/book" }}>
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(iso).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </Link>
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <Card className="mt-12 flex flex-col items-center gap-3 p-8 text-center">
          <h3 className="text-xl font-semibold">Ready to reserve a time?</h3>
          <p className="max-w-lg text-sm text-muted-foreground">
            Create a family account to book any of the times above. It takes a minute.
          </p>
          <Button asChild size="lg">
            <Link to="/auth" search={{ redirect: "/book" }}>
              Create an account
            </Link>
          </Button>
        </Card>
      </main>
    </div>
  );
}
