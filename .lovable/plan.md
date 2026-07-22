Three items to add.

## 1. Admin: add/remove subjects + trial subject

**Add/remove subjects** (`src/components/admin/SubjectsEditor.tsx` + `src/lib/admin.functions.ts`):
- `createSubject` server fn: inserts into `subjects`, then creates matching Stripe product + single/pack5 prices with the same `stripe_product_slug` lookup-key pattern used in `checkout.functions.ts`.
- `deleteSubject` server fn: soft-delete (`active=false`) if any credits/lessons reference it; hard-delete only if untouched. Deactivates Stripe prices.
- Editor gets an "Add subject" row (name + price) and a delete button per row with a confirm dialog.

**Trial subject**:
- Migration: add `is_trial boolean default false` to `subjects` (unique partial index so only one active trial) and `trial_used_at timestamptz` to `accounts`.
- Seed "Trial lesson" at $35, `is_trial=true`, with a single Stripe price only (no pack5).
- `checkout.functions.ts`: if `subject.is_trial`, force `kind='single'`; block if `account.trial_used_at` is set OR the account already has any `credits` row. Webhook stamps `trial_used_at` on trial purchase.
- `BuyLessonsDialog` + landing page: show the trial as a distinct card ("First lesson — $35, one-time") only when the account is trial-eligible; hide once used or once any other purchase exists.
- Admin editor lets you toggle `is_trial` and edit the trial price.

## 2. Homepage copy

`src/routes/index.tsx`: change H1 to "Math & computer science tutoring." (drop the trailing clause).

## 3. Google Calendar integration (tutor's calendar)

Workspace-scoped: events on **your** calendar, client attends as an invitee. Uses the standard `google_calendar` App connector (gateway-backed) — clients don't connect their own Google accounts.

Steps:
1. Link `google_calendar` via `standard_connectors--connect` (authorize with the Google account holding the lessons calendar).
2. New `src/lib/calendar.server.ts` with `createLessonEvent` / `updateLessonEvent` / `cancelLessonEvent` helpers hitting `https://connector-gateway.lovable.dev/google_calendar/calendar/v3/calendars/primary/events`:
   - summary: `{subject} — {student name}`
   - description: parent/student contact + Zoom link from `settings.zoom_link`
   - start/end in tutor timezone (1h)
   - attendees: parent email + student email (if set)
   - `sendUpdates=all` so Google emails the invite/update/cancel
3. Add `google_event_id text` column to `lessons`. Store on create, use it on reschedule/cancel.
4. Wire calls into `bookLesson`, `rescheduleMyLesson`, `rescheduleLessonAsAdmin`, `cancelMyLesson`, `cancelLessonAsAdmin` — best-effort (calendar failure shouldn't block the DB action, mirroring emails).

**Suppress Lovable confirmation emails to avoid double-emailing:**
- `bookLesson` in `src/lib/booking.functions.ts`: only send `lesson-confirmation` if the calendar event creation fails (fallback path). On success, Google's invite covers the parent + student; tutor gets the calendar event directly.
- `rescheduleMyLesson` / `rescheduleLessonAsAdmin` / `cancelMyLesson` / `cancelLessonAsAdmin`: skip the `sendLessonUpdateEmails` call when the calendar update/cancel succeeds. Google sends update/cancellation notices via `sendUpdates=all`.
- 24-hour reminder in `src/routes/api/public/hooks/lesson-reminders.ts`: **keep** — Google Calendar's default reminders are per-attendee and unreliable; the branded reminder with Zoom link is worth keeping.
- Net effect: on the happy path (calendar works), only Google invites + our reminder go out. On calendar failure, we fall back to our confirmation/update emails so the client is never left uninformed.

## Suggested order
1. Homepage copy (trivial).
2. Subjects add/remove + trial.
3. Google Calendar (I'll prompt you to authorize the connector when we get there).

Want me to proceed in this order?
