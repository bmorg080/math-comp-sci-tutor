CREATE OR REPLACE FUNCTION public.public_busy_slots(_from timestamptz, _to timestamptz)
RETURNS TABLE(starts_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT starts_at
  FROM public.lessons
  WHERE status IN ('scheduled','completed')
    AND starts_at >= _from
    AND starts_at <= _to;
$$;

REVOKE ALL ON FUNCTION public.public_busy_slots(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_busy_slots(timestamptz, timestamptz) TO anon, authenticated;