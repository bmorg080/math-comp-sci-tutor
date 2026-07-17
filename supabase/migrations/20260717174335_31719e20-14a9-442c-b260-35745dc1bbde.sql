
CREATE TABLE public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  kind text not null,
  env text not null,
  session_id text,
  credits_inserted integer not null default 0,
  notes text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

CREATE INDEX idx_webhook_events_session_id ON public.webhook_events(session_id);

GRANT ALL ON public.webhook_events TO service_role;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages webhook_events"
  ON public.webhook_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
