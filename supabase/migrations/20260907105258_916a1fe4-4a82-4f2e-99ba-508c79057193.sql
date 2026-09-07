-- 1. Remove write privileges from anonymous (logged-out) visitors on all public tables.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.accounts FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.account_members FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.students FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.lessons FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.credits FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.custom_prices FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.email_log FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.user_roles FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.settings FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.subjects FROM anon;

-- 2. Internal payment-event bookkeeping is service-role only.
REVOKE ALL ON public.webhook_events FROM anon;
REVOKE ALL ON public.webhook_events FROM authenticated;

-- 3. Reminder cron: hourly, live site, private token instead of the public key.
SELECT cron.unschedule('lesson-reminders');
SELECT cron.schedule(
  'lesson-reminders',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://project--49d2214a-e455-4ac6-b356-00a68368d58e.lovable.app/api/public/hooks/lesson-reminders',
    headers:='{"Content-Type": "application/json", "x-cron-secret": "8c6bae288ead713fe97f14211797dc59f2a2d9558d7d88ed6a0268c3800a5084"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);