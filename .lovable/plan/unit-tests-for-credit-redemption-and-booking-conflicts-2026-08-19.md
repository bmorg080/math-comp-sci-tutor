# Unit tests for credit redemption and booking conflicts

Goal: get real, professional test-writing experience on the trickiest parts of the app — which credit gets used, when a credit comes back, and what happens when two people grab the same slot.

Today there is no test runner and no test file in the project, and the booking/cancel/reschedule rules live inside server-function handlers that talk to the database directly. That mix makes them hard to unit test. The plan is to pull the *decision-making* out into small pure functions, test those hard, and then test the handlers against a fake database.

## What gets built

### 1. Test tooling
- Add Vitest with a `test` script (`bunx vitest run`) and a node-environment config.
- Tests live next to the code as `*.test.ts`.

### 2. Extract the rules into a pure domain module
New `src/lib/domain/` with no database or network imports:
- `slots.ts` — build the weekly availability grid (`generateSlots`), apply the 1-hour lead-time buffer and horizon, subtract booked times.
- `credits.ts` — `pickCreditToConsume(credits, now)`: choose the oldest unexpired, unused, unrefunded credit; return nothing when none qualifies.
- `policy.ts` — `isRefundEligible(startsAt, now, cancellationHours)` and `canReschedule(...)`.

The existing server functions then import these helpers instead of inlining the logic, so behaviour stays identical and the tests cover the code actually running in production.

### 3. Unit tests for the pure rules
Credit redemption edge cases:
- Picks the soonest-expiring credit first (so credits don't get wasted).
- Skips credits that expire exactly at / before "now"; boundary at the exact expiry millisecond.
- Skips already-consumed and refunded credits.
- Returns "needs payment" when the account has zero usable credits.
- Credits belonging to another account are never considered.

Cancellation / refund policy:
- Cancel outside the window (e.g. 25h) refunds the credit.
- Cancel inside the window (e.g. 23h) cancels without a refund and flags a late cancel.
- Exactly at the cutoff (24h to the millisecond) — pinned as refundable.
- Reschedule is blocked inside the window and blocked for a new time under 1 hour away.

Slot generation:
- Split shifts on one day produce two blocks with no bleed between them.
- Slots shorter than a full hour at the end of a shift are not offered.
- Slots inside the lead-time buffer and beyond the horizon are dropped.
- A daylight-saving-transition day still yields correct local start times.

### 4. Handler tests with a fake database
A small in-memory fake of the Supabase query builder (`from().select().eq()...`) in `src/test/fake-supabase.ts`, letting `bookLesson`, `cancelMyLesson`, and `rescheduleMyLesson` run without a real backend, with calendar/email modules stubbed:
- Booking a slot that another account just took throws the "just booked" error and consumes no credit.
- Successful booking consumes exactly one credit and links it to the new lesson.
- Booking a cancelled lesson's old time is allowed (cancelled lessons don't block).
- Reschedule onto a taken slot fails and leaves the original lesson untouched.
- Refunded credit becomes reusable for a later booking.

### 5. Notes for you
A short `src/lib/domain/README.md` explaining the pattern being practiced: pure core, thin I/O shell, fake at the boundary — plus how to run and extend the tests.

## Technical details
- Vitest + `vite-tsconfig-paths` so `@/` aliases resolve; no jsdom needed (all node-side logic).
- Time is injected as a `now: Date` argument to the pure functions rather than read from `Date.now()` inside them, and handler tests use `vi.setSystemTime`.
- Calendar and email side effects are dynamically imported in the handlers already, so they can be stubbed with `vi.mock` without touching production behaviour.
- No database schema changes, no user-visible changes.
