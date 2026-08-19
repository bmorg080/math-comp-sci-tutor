# Testing notes: pure core, thin shell

This folder is the pattern the tests are built around, and it is the same one
used on professional teams.

## The three layers

```text
routes / components        UI, no rules
  └─ *.functions.ts        server functions: auth middleware, input validation,
                           side effects (Google Calendar, email)
       └─ *.core.ts        DB reads/writes + orchestration  → tested with a fake DB
            └─ domain/     pure rules, no I/O                → tested directly
```

- `domain/credits.ts` — which credit gets spent.
- `domain/policy.ts` — refund eligibility and reschedule rules.
- `domain/slots.ts` — which 1-hour slots are offered.

Nothing in `domain/` imports Supabase, reads `Date.now()`, or sends anything.
Time is always passed in as `now`, which is why the boundary tests (exactly 24h,
exactly at expiry) can be exact instead of flaky.

## Running the tests

```bash
bun run test         # one-off
bunx vitest          # watch mode while you work
bunx vitest run src/lib/domain/credits.test.ts   # a single file
```

## The fake database

`src/test/fake-supabase.ts` is a small in-memory imitation of the Supabase query
builder — enough of `from().select().eq().maybeSingle()`, `insert()`, `update()`
to run `booking.core.ts` and `lessons.core.ts` with no network. Tests seed rows,
call the function, then assert on `sb.db.<table>` afterwards. That is how the
"a credit was not spent when booking failed" assertions work.

## Adding a test

1. Can you state the rule without mentioning the database? Put it in `domain/`
   and test it directly — that is where edge cases belong.
2. Does the rule depend on reading/writing rows? Put it in a `*.core.ts` and
   test it with `createFakeSupabase`.
3. Is it a side effect (email, calendar, Stripe)? Leave it in `*.functions.ts`
   and don't unit test it — those get verified end-to-end.

Good edge cases to reach for: the exact boundary (`>=` vs `>`), the empty list,
the row that belongs to someone else, the second attempt after a failure, and
the "two users at once" case (here: the slot taken between listing and booking).
