import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicHomeData } from "@/lib/public-data.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CalendarDays, GraduationCap, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Landing() {
  const fetchHome = useServerFn(getPublicHomeData);
  const { data } = useQuery({
    queryKey: ["public-home"],
    queryFn: () => fetchHome(),
  });

  const subjects = data?.subjects ?? [];
  const trialSubject = data?.trialSubject ?? null;
  const settings = data?.settings;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-display text-xl font-semibold text-primary">
            Brian Morgan Tutoring
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth" search={{ redirect: undefined }}>Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth" search={{ redirect: "/dashboard" }}>
                Get started
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pt-16 pb-12 sm:pt-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Private online tutoring
            </span>
            <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-6xl">
              Math &amp; computer science tutoring.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              {settings?.tutor_bio ||
                "I am a high school computer science teacher and math tutor. I have a background in computer science, and I enjoy working through tough problems with students."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/availability">See available times</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/auth" search={{ redirect: "/dashboard" }}>
                  Create an account
                </Link>
              </Button>
            </div>
          </div>
        </section>


        {/* Subjects */}
        <section id="subjects" className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-semibold">Subjects &amp; pricing</h2>
              <p className="mt-2 text-muted-foreground">
                Single 1-hour lessons or bundles of {settings?.bundle_size ?? 5} for a{" "}
                {settings?.bundle_discount_pct ?? 5}% discount.
              </p>
            </div>
          </div>
          {trialSubject && (
            <Card className="mb-4 flex items-center justify-between border-2 border-accent bg-accent/10 p-5">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <p className="font-medium">{trialSubject.name}</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  New families: try a full 1-hour lesson, available once per family.
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-semibold text-primary">
                  ${(trialSubject.price_cents / 100).toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground">one time</p>
              </div>
            </Card>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {subjects.map((s) => (
              <Card key={s.id} className="flex items-center justify-between p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <p className="font-medium">{s.name}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">1-hour lesson</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-semibold text-primary">
                    ${(s.price_cents / 100).toFixed(0)}
                  </p>
                  <p className="text-xs text-muted-foreground">per hour</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Availability */}
        {settings && (
          <section className="mx-auto max-w-6xl px-6 py-12">
            <div className="grid gap-6 rounded-2xl border bg-surface p-8 sm:grid-cols-2">
              <div>
                <div className="flex items-center gap-2 text-primary">
                  <CalendarDays className="h-5 w-5" />
                  <h3 className="text-xl font-semibold">Weekly availability</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Times shown in {settings.tutor_timezone.replace("_", " ")}.{" "}
                  <Link to="/availability" className="text-primary underline underline-offset-2">
                    Browse open slots in your timezone →
                  </Link>
                </p>

              </div>
              <ul className="space-y-2 text-sm">
                {(settings.weekly_availability ?? [])
                  .slice()
                  .sort((a, b) => a.day - b.day)
                  .map((w, i) => (
                    <li key={i} className="flex justify-between border-b pb-2 last:border-b-0">
                      <span className="font-medium">{DAY_NAMES[w.day]}</span>
                      <span className="text-muted-foreground">
                        {w.start} – {w.end}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </section>
        )}

        <section className="mx-auto max-w-6xl px-6 py-16">
          <Card className="flex flex-col items-center gap-4 p-10 text-center">
            <h3 className="text-2xl font-semibold">Ready to book your first lesson?</h3>
            <p className="max-w-xl text-muted-foreground">
              Create a family account, pick a subject, and grab a time. Confirmation emails and Zoom link included.
            </p>
            <Button asChild size="lg">
              <Link to="/auth" search={{ redirect: "/dashboard" }}>
                Create an account
              </Link>
            </Button>
          </Card>
        </section>
      </main>

      <footer className="border-t bg-surface/50">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Brian Morgan Tutoring. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
