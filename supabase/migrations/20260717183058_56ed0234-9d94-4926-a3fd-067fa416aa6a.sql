ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_lessons_reminder_due
  ON public.lessons (starts_at)
  WHERE status = 'scheduled' AND reminder_sent_at IS NULL;