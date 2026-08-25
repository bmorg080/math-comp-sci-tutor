import { Link } from "@tanstack/react-router";

export function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-display text-xl font-semibold text-primary">
            Brian Morgan Tutoring
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-4xl font-semibold">{title}</h1>
        <div className="mt-8 space-y-4 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
          {children}
        </div>
      </main>
      <footer className="border-t bg-surface/50">
        <div className="mx-auto max-w-3xl px-6 py-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Brian Morgan Tutoring.
        </div>
      </footer>
    </div>
  );
}
