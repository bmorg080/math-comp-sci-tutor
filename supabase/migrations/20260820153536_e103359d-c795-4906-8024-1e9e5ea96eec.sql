-- Restrict SECURITY DEFINER function execution
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

-- Hide tutor_email and zoom_link from anonymous users. Authenticated admin
-- keeps full SELECT (needed by admin.functions.ts via requireSupabaseAuth).
-- The existing settings_select_all policy (USING true) stays; column grants
-- now gate which columns anon can read. getPublicHomeData (anon, publishable
-- client) only selects the granted columns, so the public landing page keeps
-- working.
REVOKE SELECT ON public.settings FROM anon;
GRANT SELECT (
  tutor_name, tutor_bio, tutor_timezone, bundle_size, bundle_discount_pct,
  credit_expiry_months, cancellation_hours, weekly_availability
) ON public.settings TO anon;