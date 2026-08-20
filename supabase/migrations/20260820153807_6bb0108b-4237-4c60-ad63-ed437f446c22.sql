-- 1) Close privilege escalation: the am_insert_self policy let any
--    authenticated user link themselves to an arbitrary account_id, gaining
--    access to that account's students/lessons/credits/custom_prices.
--    Account creation is handled server-side via the service role (bypasses
--    RLS), so a self-insert policy is not needed. Replace with admin-only.
DROP POLICY IF EXISTS "am_insert_self" ON public.account_members;
CREATE POLICY "am_insert_admin" ON public.account_members
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Stop exposing the settings table directly to anon. Authenticated users
--    (admin + signed-in customers who legitimately read their zoom_link via
--    requireSupabaseAuth) keep full SELECT.
DROP POLICY IF EXISTS "settings_select_all" ON public.settings;
CREATE POLICY "settings_select_authenticated" ON public.settings
  FOR SELECT TO authenticated USING (true);

-- Revoke ALL residual anon access on the settings table, including the
-- column-level grants from the prior migration. Anon now reads settings only
-- through the public_home_settings view below.
REVOKE SELECT ON public.settings FROM anon;
REVOKE SELECT (tutor_name, tutor_bio, tutor_timezone, bundle_size, bundle_discount_pct, credit_expiry_months, cancellation_hours, weekly_availability) ON public.settings FROM anon;

-- 3) Public reads go through a view that exposes ONLY safe, non-sensitive
--    columns (no tutor_email, no zoom_link). The view is owned by the
--    postgres role and therefore bypasses RLS, so anon needs no table
--    privileges or table-level SELECT policy.
CREATE OR REPLACE VIEW public.public_home_settings AS
  SELECT
    id,
    tutor_name,
    tutor_bio,
    tutor_timezone,
    bundle_size,
    bundle_discount_pct,
    credit_expiry_months,
    cancellation_hours,
    weekly_availability
  FROM public.settings
  WHERE id = 1;
GRANT SELECT ON public.public_home_settings TO anon, authenticated;