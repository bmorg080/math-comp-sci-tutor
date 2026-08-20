# Pre-Launch Security Hardening

## Goal
Resolve the security scanner warnings before publishing so no sensitive
business data is exposed to anonymous users, then proceed to Stripe go-live
and publish.

## Current state (verified)
- Build + runtime: clean (no errors in `/tmp/observability`).
- Email domain `brianmorgantutor.com`: verified, ready to send.
- Google Calendar connector: linked + has access (booking sync works).
- Stripe go-live: step 1 done, step 2 (go-live form) in progress, 3–5 pending.
- Publish: not yet published; visibility = public.
- Security scan (from 2026-07-17): no critical findings. Four warnings:
  1. `SUPA_anon_security_definer_function_executable` — anon can `EXECUTE`
     SECURITY DEFINER functions.
  2. `SUPA_authenticated_security_definer_function_executable` — authenticated
     can `EXECUTE` SECURITY DEFINER functions.
  3. `settings_tutor_email_public_exposure` — `settings` SELECT policy is
     `USING (true)`, so anon reads every column including `tutor_email` and
     `zoom_link`.
  4. `subjects_public_select_low_risk` — `subjects` publicly readable
     (intentional public pricing catalog; low risk, leave as-is).

The only anon reader of `settings` is `getPublicHomeData`
(`src/lib/public-data.functions.ts`), which selects exactly:
`tutor_name, tutor_bio, tutor_timezone, bundle_size, bundle_discount_pct,
credit_expiry_months, cancellation_hours, weekly_availability`.
Admin reads (`admin.functions.ts`, `requireSupabaseAuth`) need the full row
including `tutor_email`/`zoom_link`, so authenticated must keep full SELECT.

SECURITY DEFINER functions in scope:
- `public.has_role(_user_id, _role)` — called by RLS policies; only
  authenticated needs it.
- `public.current_account_id()` — called by RLS policies; only authenticated.
- `public.public_busy_slots(_from, _to)` — intentionally public (anon browses
  availability); reads only lesson `starts_at` of scheduled/completed lessons.

## Changes

### 1. New migration: restrict SECURITY DEFINER execution
File: `supabase/migrations/<ts>_<slug>.sql`
```sql
-- has_role / current_account_id are only used by RLS policies, which run
-- as the invoking authenticated user. Revoke PUBLIC, grant authenticated.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_account_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_account_id() TO authenticated;

-- public_busy_slots is intentionally anon-callable (public availability
-- browsing). Drop the unnecessary authenticated grant to reduce surface.
REVOKE EXECUTE ON FUNCTION public.public_busy_slots(timestamptz, timestamptz)
  FROM authenticated;
```
This resolves warnings 1 and 2 for `has_role` / `current_account_id`.
`public_busy_slots` remains anon-accessible by design (warning will persist
for it; acceptable — it exposes only busy time slots, no PII).

### 2. New migration: column-level anon access on `settings`
```sql
-- Hide tutor_email and zoom_link from anonymous users. Authenticated admin
-- keeps full SELECT (needed by admin.functions.ts via requireSupabaseAuth).
REVOKE SELECT ON public.settings FROM anon;
GRANT SELECT (
  tutor_name, tutor_bio, tutor_timezone, bundle_size, bundle_discount_pct,
  credit_expiry_months, cancellation_hours, weekly_availability
) ON public.settings TO anon;
```
The existing `settings_select_all` policy (`USING (true)`) stays; column
grants now gate which columns anon can read. `getPublicHomeData` (anon,
publishable client) only selects the granted columns, so the public landing
page keeps working. This resolves warning 3.

### 3. `subjects` — no change
Public pricing catalog is intentional and low risk (warning 4). Leave as-is.

### 4. Re-run security scan
After migrations apply, run `security--run_security_scan` and confirm the
`settings_tutor_email_public_exposure` and the `has_role`/`current_account_id`
SECURITY DEFINER warnings are gone. Update security memory to reflect that
`public_busy_slots` anon-executable is by-design.

## After security is clean
1. Guide you through the remaining Stripe go-live steps (form → install app →
   auto-provisioned live keys → readiness check). These happen in Stripe.
2. Publish the site (preview_ui--publish) once payments are live.

## Out of scope (post-launch)
- Google Calendar sender-address switch to @brianmorgantutor.com (paused).
- Additional unit tests.
