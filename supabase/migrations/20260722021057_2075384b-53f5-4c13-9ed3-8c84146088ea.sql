
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS subjects_one_active_trial
  ON public.subjects ((true)) WHERE is_trial = true AND active = true;

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS trial_used_at timestamptz;

ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS google_event_id text;
