## Goal
Let visitors browse available lesson time slots on the public landing page before creating an account. Booking still requires sign-in.

## Changes

**1. Public server function: `listPublicOpenSlots`**
- New export in `src/lib/booking.functions.ts` (or a new `public-booking.functions.ts`), unauthenticated.
- Same slot-generation logic as `listOpenSlots` (intersect tutor `weekly_availability` with existing `lessons`), but:
  - Uses the server publishable client (narrow `TO anon` SELECT on `settings` + `lessons` time/status columns only — no student/subject/user data returned).
  - Returns only UTC ISO start/end strings — no lesson IDs, no PII.
- Add a `TO anon` SELECT policy on `lessons` restricted to non-cancelled rows, projecting only `starts_at`/`ends_at`/`status` via safe-column selection in the fetcher. (Or expose via a SQL function that returns just busy intervals.)

**2. Public route: `/availability`**
- New `src/routes/availability.tsx` (public, SSR on, own `head()` metadata).
- Loader primes TanStack Query with `listPublicOpenSlots` for the next ~4 weeks.
- Renders the same date-grouped slot list as `/book`, converted to the visitor's local timezone.
- Each slot is a **non-interactive card** with a "Sign up to book this time" CTA that links to `/auth?redirect=/book` (does not pre-reserve — the slot may be gone by the time they finish signing up, and `bookLesson` already re-checks conflicts).
- Note above the list: "Times shown in your local timezone. Sign in to book."

**3. Landing page (`src/routes/index.tsx`)**
- Add a "See available times" button in the hero / near the availability schedule, linking to `/availability`.
- Keep the existing weekly-availability summary as-is.

**4. No changes to `/book`**
- Still authenticated, still uses `listOpenSlots` + `bookLesson`.

## Technical notes
- Public fn projects only time columns; no `student_id`, `subject_id`, `account_id`, or notes leave the server. RLS `TO anon` policy is scoped accordingly.
- Slots list is capped (e.g. next 28 days) to bound response size.
- Public route loader uses `ensureQueryData`; component uses `useSuspenseQuery`. `errorComponent` + `notFoundComponent` included.
- No new dependencies.

## Out of scope
- Holding/reserving a slot across the sign-up flow.
- Showing tutor's actual booked lesson details (kept private).