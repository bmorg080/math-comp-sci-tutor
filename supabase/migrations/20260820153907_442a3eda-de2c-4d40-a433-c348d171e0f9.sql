-- Replace the public_home_settings view (flagged as a security-definer view by
-- lint 0010) with a SECURITY DEFINER function returning only safe, non-sensitive
-- columns. This matches the existing public_busy_slots pattern: anon calls a
-- read-only RPC that exposes no PII (no tutor_email, no zoom_link). The settings
-- table itself stays authenticated-only (no anon SELECT policy), so the
-- supabase_lov settings-exposure warning stays resolved.
DROP VIEW IF EXISTS public.public_home_settings;

CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS TABLE(
  id integer,
  tutor_name text,
  tutor_bio text,
  tutor_timezone text,
  bundle_size integer,
  bundle_discount_pct integer,
  credit_expiry_months integer,
  cancellation_hours integer,
  weekly_availability jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, tutor_name, tutor_bio, tutor_timezone, bundle_size,
         bundle_discount_pct, credit_expiry_months, cancellation_hours,
         weekly_availability
  FROM public.settings
  WHERE id = 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated;