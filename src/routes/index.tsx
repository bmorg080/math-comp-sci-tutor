import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicHomeData } from "@/lib/public-data.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CalendarDays, GraduationCap, Mail, Sparkles, ShieldCheck } from "lucide-react";

const TUTOR_EMAIL = "brian@brianmorgantutor.com";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Math & Computer Science Tutor | Brian Morgan Tutoring" },
      {
        name: "description",
        content:
          "Private online math and computer science tutoring with Brian Morgan. Book a 1-hour Zoom lesson, buy 5-lesson bundles, or start with a $35 trial lesson.",
      },
      { property: "og:title", content: "Math & Computer Science Tutor | Brian Morgan Tutoring" },
      {
        property: "og:description",
        content:
          "Private online math and computer science tutoring. Pick a time that works, pay online, and get a Zoom link by calendar invite.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://brianmorgantutor.com/" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://brianmorgantutor.com/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "EducationalOrganization",
          name: "Brian Morgan Tutoring",
          url: "https://brianmorgantutor.com/",
          email: "brian@brianmorgantutor.com",
          description:
            "Private online math and computer science tutoring: pre-algebra through calculus, SAT math prep, and AP Computer Science A.",
          makesOffer: [
            {
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                name: "Trial tutoring lesson",
                serviceType: "Online math or computer science tutoring",
              },
              price: "35.00",
              priceCurrency: "USD",
            },
            {
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                name: "AP Computer Science A tutoring",
                serviceType: "Online computer science tutoring",
              },
              priceCurrency: "USD",
            },
            {
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                name: "Math tutoring (pre-algebra through calculus)",
                serviceType: "Online math tutoring",
              },
              priceCurrency: "USD",
            },
          ],
        }),
      },
    ],
  }),

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
            <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 text-primary" />
              Questions before you book? Email{" "}
              <a
                href={`mailto:${TUTOR_EMAIL}`}
                className="font-medium text-primary underline underline-offset-2"
              >
                {TUTOR_EMAIL}
              </a>
              — I usually reply within a day.
            </p>
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

        {/* How it works & policies */}
        <section id="policies" className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="text-3xl font-semibold text-foreground">How booking works</h2>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <p className="font-medium">1. Buy lesson credits</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Pay securely by card for a single lesson or a bundle of{" "}
                {settings?.bundle_size ?? 5} at {settings?.bundle_discount_pct ?? 10}% off. Credits
                stay on your account until you use them.
              </p>
            </Card>
            <Card className="p-5">
              <p className="font-medium">2. Pick a time</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Open times are shown in your own timezone. Choose any 1-hour slot that works for
                your student.
              </p>
            </Card>
            <Card className="p-5">
              <p className="font-medium">3. Join on Zoom</p>
              <p className="mt-2 text-sm text-muted-foreground">
                You and your student get a calendar invitation with the Zoom link, plus a reminder
                before the lesson.
              </p>
            </Card>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <p className="font-medium">Cancellation policy</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Cancel or reschedule up to {settings?.cancellation_hours ?? 24} hours before a
                lesson and your credit comes back automatically. Inside that window the credit is
                used, since the time was reserved.
              </p>
            </Card>
            <Card className="p-5">
              <p className="font-medium">Credit expiration</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Credits are good for {settings?.credit_expiry_months ?? 9} months from purchase, and
                your dashboard always shows what expires when.
              </p>
            </Card>
            <Card className="p-5">
              <p className="font-medium">Refunds</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Unused, unexpired credits can be refunded on request — just email{" "}
                <a
                  href={`mailto:${TUTOR_EMAIL}`}
                  className="text-primary underline underline-offset-2"
                >
                  {TUTOR_EMAIL}
                </a>
                . Full details are in the{" "}
                <Link to="/terms" className="text-primary underline underline-offset-2">
                  terms
                </Link>
                .
              </p>
            </Card>
          </div>
        </section>

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
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Brian Morgan Tutoring. All rights reserved.</span>
          <nav className="flex flex-wrap items-center gap-4">
            <a href={`mailto:${TUTOR_EMAIL}`} className="hover:text-primary">
              {TUTOR_EMAIL}
            </a>
            <Link to="/privacy" className="hover:text-primary">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-primary">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
