import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Brian Morgan Tutoring" },
      {
        name: "description",
        content:
          "How Brian Morgan Tutoring collects, uses, and protects family and student information for online math and computer science lessons.",
      },
      { property: "og:title", content: "Privacy Policy — Brian Morgan Tutoring" },
      {
        property: "og:description",
        content: "How Brian Morgan Tutoring handles family and student information.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://brianmorgantutor.com/privacy" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://brianmorgantutor.com/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>
        Brian Morgan Tutoring ("we", "I") provides online math and computer science tutoring. This
        policy explains what information is collected when you use this site and how it is used.
      </p>

      <h2>Information collected</h2>
      <ul>
        <li>
          <strong>Account information:</strong> the parent or guardian's name and email address,
          your timezone, and the first name (and optional email) of each student on the account.
        </li>
        <li>
          <strong>Lesson information:</strong> the subject, date, and time of lessons you book, plus
          lesson credits and their expiration dates.
        </li>
        <li>
          <strong>Payment information:</strong> payments are processed by Stripe. Card numbers are
          never sent to or stored on this site — only a record of the purchase (amount, subject,
          date) is kept.
        </li>
      </ul>

      <h2>How information is used</h2>
      <ul>
        <li>To create and manage your account and lesson credits.</li>
        <li>To schedule lessons and send calendar invitations containing the meeting link.</li>
        <li>
          To send transactional email such as booking confirmations, reminders, cancellations, and
          password resets.
        </li>
      </ul>
      <p>
        Information is never sold, rented, or used for advertising, and marketing email is not sent
        unless you ask for it.
      </p>

      <h2>Service providers</h2>
      <p>
        A small number of providers process data on our behalf: Stripe (payments), Google Calendar
        (lesson invitations), and our email and hosting providers. Each receives only what is needed
        to perform its function.
      </p>

      <h2>Students and minors</h2>
      <p>
        Accounts are created and controlled by a parent or guardian. Only a student's first name and
        an optional email address (used to send the calendar invitation) are stored. No student
        coursework or assessment data is collected through this site.
      </p>

      <h2>Retention and your choices</h2>
      <p>
        Account and lesson records are kept while your account is active and for as long as needed
        for tax and accounting purposes. You can update your account details from your dashboard,
        and you can request a copy or deletion of your data at any time by emailing{" "}
        <a href="mailto:brian@brianmorgantutor.com">brian@brianmorgantutor.com</a>. Deletion
        requests are honored except where records must be retained by law.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy? Email{" "}
        <a href="mailto:brian@brianmorgantutor.com">brian@brianmorgantutor.com</a>.
      </p>
      <p className="text-sm">
        Return to the <Link to="/">home page</Link>.
      </p>
    </LegalLayout>
  );
}

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
        <div className="prose-legal mt-8 space-y-4 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
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
