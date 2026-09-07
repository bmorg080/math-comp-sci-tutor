# Security Audit and Hardening

I ran the automated scanners and then checked the real database rules and page
protections by hand. Here is what I found and what I would change.

## What is already safe (verified, not assumed)

- **Logged-out visitors cannot read any private data.** I queried the live
  database as an anonymous visitor for families, students, lessons, credits,
  payments, email history, and roles — every one came back empty or refused.
  Only the public information (tutor bio, availability, subject prices) is
  readable, through a dedicated read-only function.
- **Every admin action is checked on the server.** All ten admin operations
  (settings, granting credits, cancelling/rescheduling anyone's lesson, adding
  or removing subjects, availability) verify the signed-in person actually has
  the tutor role before doing anything. Faking it from the browser fails.
- **Roles are stored in a separate table**, not on the user or family record,
  and only a tutor-role check can write to it — no self-promotion path.
- **Payment webhook verifies Stripe's signature** before granting credits, and
  records each event so a replay can't grant credits twice.
- **No keys leaked to the browser**, and no known high/critical vulnerable
  packages.

## Issues to fix

### 1. The reminder-email endpoint can be triggered by anyone (main issue)
The nightly reminder endpoint accepts the site's public key as its password —
but that key is published in every visitor's browser. Anyone who finds the
address could repeatedly fire reminder emails to your families.

Fix: generate a private token, require it on that endpoint, and update the
scheduled job to send it.

### 2. Logged-out visitors hold write permissions they should never have
The privacy rules currently block them, so nothing is exposed today, but at the
database level anonymous visitors are still granted insert/update/delete rights
on families, students, lessons, credits, email history and the roles table.
That is one mistaken rule away from a real problem.

Fix: a migration that removes all anonymous write permissions (and unused
signed-in write permissions on payment-event bookkeeping), keeping only what
the site actually uses.

### 3. The admin page briefly renders before kicking out a non-tutor
A signed-in customer who types /admin loads the page shell for a moment before
being redirected. No private data is shown (the server refuses to send it), but
it looks wrong and invites poking.

Fix: check the tutor role before the page renders, so a non-tutor goes straight
to their dashboard and never sees the admin shell.

### 4. Sign-in "return to" address isn't validated
The sign-in page accepts a destination from the web address. Restrict it to
paths inside this site so it can never be used to bounce someone to an
outside page.

### 5. Scanner notes I will leave alone (with reason)
- Public availability lookup is intentionally open to logged-out visitors; it
  reveals only which hours are busy, no names or details.
- Public subject/pricing list is intentionally public, and only safe columns
  are readable.
- The scanner's warning that the settings table lacks a separate read rule is
  a false alarm: I confirmed logged-out and non-tutor users are refused
  entirely, so your Zoom link and email stay private.

### Also noticed (not security)
The scheduled reminder job points at the preview address rather than your live
site. I'll repoint it while touching that endpoint.

## Technical detail

- New migration: `REVOKE INSERT/UPDATE/DELETE ON public.{accounts,
  account_members, students, lessons, credits, custom_prices, email_log,
  user_roles, webhook_events, settings, subjects} FROM anon;` plus
  `REVOKE ALL ON public.webhook_events FROM anon, authenticated;`
  Keeps `SELECT` grants and all existing RLS policies untouched.
- New secret `REMINDER_CRON_SECRET`; `src/routes/api/public/hooks/lesson-reminders.ts`
  compares an `x-cron-secret` header with a timing-safe compare; migration updates
  the `pg_cron` job to send it and to call the production URL.
- `src/routes/_authenticated/admin.tsx`: add `beforeLoad` that calls
  `getMyAccountOverview` and `throw redirect({ to: "/dashboard" })` when
  `isAdmin` is false; keep the existing server-side `assertAdmin` checks.
- `src/routes/auth.tsx`: `validateSearch` accepts `redirect` only when it
  matches `/^\/(?!\/)[A-Za-z0-9\-._~/?#[\]@!$&'()*+,;=%]*$/`.
- Re-run the security scan and the test suite afterward and report results.
