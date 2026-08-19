# Google Calendar account switch

## Goal
Have new calendar invites (and their attendee emails) come from your
`brian@brianmorgantutor.com` Google Workspace address instead of the account
currently linked.

## Current state (verified)
- `google_calendar` connector is linked: connection `Brian's Google Calendar`
  (`std_01ky3st1rge8csf63bs4g3gapp`), gateway-backed, has access.
- `src/lib/calendar.server.ts` reads `GOOGLE_CALENDAR_API_KEY` and routes
  through the gateway. The linked account is the event organizer — there are
  no hardcoded organizer addresses in the code, so **no code change is needed**.
  Switching the linked account automatically changes the organizer for all
  future events.

## Plan
1. **You sign into Google** as `brian@brianmorgantutor.com` in your browser
   before starting the reconnect (so OAuth picks the right account).
2. **I run the reconnect** (`standard_connectors--reconnect`) — an in-chat card
   opens. You complete the Google OAuth flow as the `@brianmorgantutor.com`
   account and authorize Calendar access.
3. **Verify** the new connection still shows "has access: yes" / gateway-backed.
4. **Smoke test** — book a throwaway lesson from `/book` and confirm the
   calendar invite organizer is the `@brianmorgantutor.com` address; then cancel
   it so the credit is refunded.

## Notes
- Existing already-created calendar events keep their original organizer.
  Only **new** bookings (and their cancellations/reschedules) use the new
  account.
- The `sendUpdates=all` flag in `calendar.server.ts` already makes Google email
  the invite to the tutor + parent + student, so nothing else changes.
