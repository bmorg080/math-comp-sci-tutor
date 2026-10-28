import { Quote } from "lucide-react";

export type Review = {
  quote: string;
  author: string;
  source: string;
};

/**
 * Reviews displayed on the public site. Add entries here as new testimonials
 * arrive — the same list renders on the About Me page and the full homepage.
 */
export const REVIEWS: Review[] = [
  {
    quote:
      "As an educator, I quickly recognized that Brian continually adapted his teaching style to match learning needs. Anyone fortunate enough to work and/or know him personally will recognize and appreciate Brian's rare patience and talents.",
    author: "E.W., M.Ed.",
    source: "Fellow educator",
  },
  {
    quote:
      "Brian was able to establish rapport within the first couple of online sessions, which allowed my daughter to begin learning right away.",
    author: "K.F.",
    source: "Parent",
  },
];

export function Reviews({ className = "" }: { className?: string }) {
  if (REVIEWS.length === 0) return null;

  return (
    <section className={className} aria-labelledby="reviews-heading">
      <h2
        id="reviews-heading"
        className="font-display text-sm font-medium uppercase tracking-wide text-muted-foreground"
      >
        Reviews
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {REVIEWS.map((r) => (
          <figure
            key={`${r.author}-${r.quote.slice(0, 12)}`}
            className="flex flex-col rounded-2xl border bg-surface p-6"
          >
            <Quote className="h-5 w-5 text-accent" aria-hidden="true" />
            <blockquote className="mt-3 leading-relaxed text-foreground">
              &ldquo;{r.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-4 text-sm pt-2 mt-auto">
              <span className="font-medium text-foreground">{r.author}</span>
              <span className="text-muted-foreground"> · {r.source}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
