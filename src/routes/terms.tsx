import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Brian Morgan Tutoring" },
      {
        name: "description",
        content:
          "Booking, payment, cancellation, and lesson credit terms for online math and computer science tutoring with Brian Morgan.",
      },
      { property: "og:title", content: "Terms of Service — Brian Morgan Tutoring" },
      {
        property: "og:description",
        content: "Booking, payment, cancellation, and credit terms for lessons.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://brianmorgantutor.com/terms" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://brianmorgantutor.com/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p>
        These terms cover tutoring lessons booked through this site with Brian Morgan Tutoring. By
        creating an account or purchasing a lesson, you agree to them.
      </p>

      <h2>Accounts</h2>
      <p>
        Accounts are created and managed by a parent or guardian, who is responsible for the
        information on the account and for keeping login details secure. You may add students to
        your account and optionally provide a student email so calendar invitations reach them too.
      </p>

      <h2>Lessons and credits</h2>
      <ul>
        <li>Lessons are one hour long and delivered online over Zoom.</li>
        <li>
          Purchases are made in lesson credits. One credit books one lesson of the subject it was
          purchased for.
        </li>
        <li>
          Credits expire nine months after purchase. Expiration dates are shown on your dashboard.
        </li>
        <li>
          The introductory trial lesson may be purchased once per family and is not available after
          any other purchase.
        </li>
      </ul>

      <h2>Payment</h2>
      <p>
        Payments are processed securely by Stripe at the price shown at checkout. Bundles of five
        lessons are discounted. Prices may change, but a change never affects credits you already
        own.
      </p>

      <h2>Cancellation and rescheduling</h2>
      <p>
        Lessons may be cancelled or rescheduled up to <strong>24 hours</strong> before the start
        time; the credit returns to your account and can be used for another lesson. Inside the
        24-hour window the credit is used, because the time has been reserved for your student. If
        I ever need to cancel, your credit is returned in full and we will find a replacement time.
      </p>
      <p>
        No-shows are treated as a late cancellation. If a student is running late, join as soon as
        you can — the session still ends at the scheduled time.
      </p>

      <h2>Refunds</h2>
      <p>
        Unused, unexpired credits can be refunded on request by emailing{" "}
        <a href="mailto:brian@brianmorgantutor.com">brian@brianmorgantutor.com</a>. Lessons that
        have already been delivered are not refundable.
      </p>

      <h2>Conduct and limits</h2>
      <p>
        Tutoring supports a student's own learning. I will not complete graded work, tests, or
        assignments on a student's behalf. Sessions may end early if a student is disruptive or
        unsafe; the credit is still used in that case.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email{" "}
        <a href="mailto:brian@brianmorgantutor.com">brian@brianmorgantutor.com</a>.
      </p>
      <p className="text-sm">
        Return to the <Link to="/">home page</Link>.
      </p>
    </LegalLayout>
  );
}
