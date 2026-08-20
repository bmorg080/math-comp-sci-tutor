REVOKE ALL ON public.subjects FROM anon;
GRANT SELECT (id, name, description, price_cents, active, sort_order, is_trial) ON public.subjects TO anon;