ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS stripe_product_slug text;

UPDATE public.subjects SET stripe_product_slug = CASE name
  WHEN 'Algebra' THEN 'algebra'
  WHEN 'AP Computer Science A' THEN 'ap_cs_a'
  WHEN 'Calculus' THEN 'calculus'
  WHEN 'Geometry' THEN 'geometry'
  WHEN 'Pre-Algebra' THEN 'pre_algebra'
  WHEN 'Pre-Calculus' THEN 'pre_calculus'
  WHEN 'SAT Math Prep' THEN 'sat_math_prep'
END WHERE stripe_product_slug IS NULL;