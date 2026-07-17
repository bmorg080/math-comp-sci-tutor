
# Tutoring Booking App — Build Plan

A full-stack booking site for your tutoring business. Students/parents sign up, pick a subject, buy single lessons or 5-packs, and book open time slots. You get an admin dashboard to manage everything.

## Scope of v1

**Public site**
- Landing page: your bio ("high school CS teacher and math tutor…"), subject/price table, "Sign up / Log in" CTAs.

**Customer area (after login)**
- Subjects & pricing table (shows any custom pricing that applies to their account, clearly labeled).
- Buy: single lesson or 5-pack (10% off) — Stripe checkout.
- Calendar view of open 1-hour slots in the customer's timezone. Availability: Mon–Thu 4–8pm, Sun 6–8pm (your local time).
- Book a slot → uses a credit if available, otherwise prompts checkout for that subject's single-lesson price.
- Lesson history: past + upcoming lessons, with cancel button (24h+ = free refund/credit; <24h = forfeit).
- Account: add/edit students (siblings), optional student email, timezone.

**Admin area (your login, gated by admin role)**
- Customer list + drill-in to view profile, students, lesson history, credit balance.
- Lesson manager: create/cancel any lesson (admin cancel auto-refunds/credits).
- Subject & price editor; per-customer custom prices.
- Refunds: refund a paid lesson or unused credits on request.

**Automation**
- On booking: both parties emailed lesson time + your static Zoom link.
- 24h before lesson: reminder email to both parties (cron job).

## Key decisions locked in

- **Auth**: email/password. One account per family; parent email required, optional student email attached as a second login on the same account. Timezone captured at signup.
- **Payments**: Stripe (Lovable-managed, seamless). Handles tax/compliance automatically for eligible sales.
- **Zoom**: single static link stored in admin settings; reused for every lesson.
- **Credits**: 9-month expiry from purchase date, shared across students on the account.
- **Refund policy**: enforced in code — customer cancel ≥24h returns credit; <24h forfeits; admin cancel always refunds.
- **Emails**: Lovable Emails (branded confirmation + reminder templates).

## Technical section

**Stack**: TanStack Start + Lovable Cloud (Postgres + Auth), Stripe payments, Lovable Emails, pg_cron for reminders.

**Data model** (Lovable Cloud tables, all RLS-protected):
- `accounts` (family unit; timezone, custom_price_multiplier or ref to custom prices)
- `account_members` (auth.users ↔ accounts, role: parent/student)
- `user_roles` (separate table, app_role enum: admin/customer)
- `students` (name, account_id, notes)
- `subjects` (name, base_price_cents, active)
- `custom_prices` (account_id, subject_id, price_cents)
- `credits` (account_id, remaining, purchased_at, expires_at, source: purchase/admin/refund)
- `lessons` (account_id, student_id, subject_id, starts_at, duration=60, status: scheduled/completed/cancelled/no_show, credit_id, stripe_payment_id, cancelled_by, cancelled_at)
- `settings` (singleton: zoom_link, availability rules)
- `email_log` (for idempotency)

**Server functions**: `listOpenSlots`, `bookLesson`, `cancelLesson`, `purchasePackage`, `purchaseSingleLesson`, admin variants for CRUD. Stripe checkout via managed integration; webhook credits the account on successful payment.

**Cron**: pg_cron job hits `/api/public/cron/send-reminders` hourly with a shared secret; sends reminder emails for lessons 24–25h out.

**Availability logic**: generate slots from weekly rule, subtract booked lessons, convert to viewer's timezone client-side.

## Build order

1. Enable Lovable Cloud + email domain setup dialog.
2. Enable Stripe payments.
3. Schema + RLS + seed subjects/prices/availability/your admin role.
4. Auth (signup with timezone + parent/optional student email, login).
5. Landing page with your bio.
6. Customer dashboard: subjects table, purchase flow (Stripe), lesson history.
7. Calendar + booking flow with credit-or-pay logic.
8. Admin dashboard.
9. Email templates + booking confirmation trigger.
10. Reminder cron.

## Confirm before I start

This is a big build. I'll deliver it in stages, showing progress after each. The full v1 will span several messages. Sound good?
