## Goal

Let a parent save an email address on each student profile. When that email is set, every lesson email (confirmation, 24h reminder, cancellation, reschedule) that currently goes to the parent also goes to the student's address.

## Current state (verified)

- `public.students` has `id, account_id, name, grade_level, notes` — no email column.
- Lesson emails today have two recipients: the tutor, and the parent (the account owner's auth email). The "student" label in `lesson-emails.server.ts` / `booking.functions.ts` refers to that parent-side message.
- Emails are sent from `src/lib/booking.functions.ts` (confirmation), `src/routes/api/public/hooks/lesson-reminders.ts` (reminder), and `src/lib/lesson-emails.server.ts` (cancel/reschedule). All three already load the student row via `students(name)` — we'll extend that projection.

## Changes

### 1. Schema
Migration adding a nullable `email text` column to `public.students`. Existing RLS/GRANTs already cover it (`st_own` policy scoped to `current_account_id()`).

### 2. Manage student email in the UI
On the customer dashboard, add a small **Students** card listing each student on the account with an inline "Edit email" action (dialog with name + email fields, email optional, basic email validation). Uses a new `updateStudent` server function with `requireSupabaseAuth`, scoped to the caller's account. If the account has no students yet, show an "Add student" button (already needed for booking anyway — currently students are created elsewhere; if none exist we surface an "Add student" form here too).

### 3. Include the student email on outbound lesson emails
In all three send sites, extend the `students(...)` select to include `email`, and when the value is present pass it as an additional recipient on the parent-side send. Two options for the second recipient — I'll default to **A** unless you prefer B:

- **A. Send the parent-side email to both addresses in one send** (`to: [parentEmail, studentEmail]`). Simpler, one idempotency key, both see the same message with the Zoom link.
- **B. Send a separate copy to the student** with its own idempotency key (`...-student-copy`). More log entries but lets suppression/unsubscribe apply independently per recipient.

No changes to the tutor email or to the email templates themselves — the Zoom link and time are already in the body.

### 4. Admin visibility
Show the student's email (when set) in the admin customer detail view alongside the parent's email, read-only.

## Out of scope

- Creating a separate login for the student. This is an email delivery change only; the student does not get an account or dashboard access.
- Changing who the emails appear to be "from" or the template copy.

Confirm option A vs B and I'll implement.
