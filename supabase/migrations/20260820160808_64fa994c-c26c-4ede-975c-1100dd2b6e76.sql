SELECT cron.unschedule(1);
SELECT cron.schedule(
  'lesson-reminders',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url:='https://project--49d2214a-e455-4ac6-b356-00a68368d58e-dev.lovable.app/api/public/hooks/lesson-reminders',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzcW5zbHZ3dXl1dm5vcG54Z2xwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyOTU0NTUsImV4cCI6MjA5OTg3MTQ1NX0.nNKMZJGT-QPX2nRIQoEFwhRWGy8eNj8lYMAZQMF_c34"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);