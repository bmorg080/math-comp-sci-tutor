import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicHomeData } from "@/lib/public-data.functions";
import { Mail } from "lucide-react";

const TUTOR_EMAIL = "brian@brianmorgantutor.com";

const FALLBACK_BIO =
  "I am a high school computer science teacher and math tutor. I have a background in computer science, and I enjoy working through tough problems with students.";

/**
 * The stored bio is written for the full site, so it ends with an invitation to
 * book and a repeated contact line. This page has no booking and its own email
 * block, so those sentences are dropped here — the stored text is untouched and
 * still appears in full on the normal landing page.
 */
function displayBio(raw: string): string {
  const out = raw
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/\s*(?:contact\s+me|email\s+me)\s*[:\-–]?\s*[^\s@]+@[^\s]*[^\s,;.]/gi, "")
        .split(/(?<=[.!?])\s+/)
        .filter((s) => !/\b(book|booking|trial|schedul\w*|reserv\w*|sign ?up|zoom)\b/i.test(s))
        .join(" ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n\n")
    .trim();
  return out.length > 20 ? out : FALLBACK_BIO;
}

export function HoldingPage() {
  const fetchHome = useServerFn(getPublicHomeData);
  const { data } = useQuery({
    queryKey: ["public-home"],
    queryFn: () => fetchHome(),
  });

  const bio = displayBio(data?.settings?.tutor_bio?.trim() || FALLBACK_BIO);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center px-6 py-5">
          <span className="font-display text-xl font-semibold text-primary">
            Brian Morgan Tutoring
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">About Brian Morgan</h1>

        <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-muted-foreground">
          {bio}
        </p>

        <div className="mt-10 border-t pt-8">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Get in touch
          </p>
          <a
            href={`mailto:${TUTOR_EMAIL}`}
            className="mt-3 inline-flex items-center gap-2 text-lg font-medium text-primary underline underline-offset-4"
          >
            <Mail className="h-5 w-5" />
            {TUTOR_EMAIL}
          </a>
        </div>
      </main>

      <footer className="border-t bg-surface/50">
        <div className="mx-auto max-w-2xl px-6 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Brian Morgan Tutoring.
        </div>
      </footer>
    </div>
  );
}
