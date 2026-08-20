# End-to-End Booking Test (Full Real Run)

Goal: prove that a real purchase → booking → confirmation email → Google Calendar invite → reminder email chain works, using Brianmorgan080@icloud.com as the test customer.

## What the test will do

1. **Create a test customer account** — sign up in the preview as Brianmorgan080@icloud.com, add a student record with the same email so both-party delivery is exercised.
2. **Buy a lesson with Stripe test mode** — run a real checkout using test card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP. Confirm the webhook fires, the `webhook_events` row is recorded once, and exactly one credit is granted (no duplicates).
3. **Book a slot** — pick an open slot ~2 days out from the booking calendar, confirm the credit is consumed and a `lessons` row is created.
4. **Verify the confirmation path** — check that either a Google Calendar invite went out (event created on brian@brianmorgantutor.com's calendar with the customer + student as attendees) or the confirmation email was sent, per the existing suppression rule, and that the Zoom link from settings appears with the correct local times.
5. **Verify the reminder** — temporarily move the lesson's start time into the reminder window, invoke the reminder hook, confirm the reminder email sends once with the Zoom link, then restore the real start time.
6. **Verify cancellation** — cancel the lesson outside the 24h window, confirm the credit is refunded, the calendar event is removed, and the cancellation email sends.
7. **Clean up** — cancel/remove the test lesson, calendar event, and test credits so the production data stays clean. The Stripe test-mode charge stays in the test ledger (harmless).

## Checks and evidence I will report

- Stripe: session id, one webhook event row, one credit row.
- Database: lesson row with `google_event_id` populated and correct `starts_at`.
- Emails: rows in `email_log` plus the delivery log entries (sent/rejected/suppressed) per recipient.
- Calendar: event id, attendee list, start/end in the right timezone.
- Any failure gets diagnosed and fixed in the same pass, then re-verified.

## What you should watch for on your side

- Check Brianmorgan080@icloud.com (including spam) for: purchase-related mail, the Google Calendar invite, the reminder, and the cancellation notice.
- Check brian@brianmorgantutor.com's Google Calendar for the created and then removed event.

## Technical notes

- Driven with Playwright against the preview at localhost, using a real signup (not a synthetic session), so the client-side Stripe embedded checkout and booking UI are both exercised.
- The reminder hook is `/api/public/hooks/lesson-reminders`; it will be invoked directly rather than waiting for cron.
- Time shifts for the reminder step are done with a scoped SQL update on the single test lesson only.
- Nothing in application code changes unless the test surfaces a bug; fixes would be scoped to the failing path.
