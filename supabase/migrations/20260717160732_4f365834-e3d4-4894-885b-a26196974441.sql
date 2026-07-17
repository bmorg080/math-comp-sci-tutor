
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'customer');
CREATE TYPE public.lesson_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');
CREATE TYPE public.member_role AS ENUM ('parent', 'student');
CREATE TYPE public.credit_source AS ENUM ('purchase_single', 'purchase_bundle', 'admin_grant', 'admin_refund', 'cancellation_refund');

-- Updated-at trigger helper
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ACCOUNTS (family unit)
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ACCOUNT MEMBERS (auth.users <-> accounts)
CREATE TABLE public.account_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_role public.member_role NOT NULL DEFAULT 'parent',
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
CREATE INDEX ON public.account_members(account_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_members TO authenticated;
GRANT ALL ON public.account_members TO service_role;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

-- USER ROLES (kept separate from account_members for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security-definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_account_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT account_id FROM public.account_members WHERE user_id = auth.uid() LIMIT 1;
$$;

-- STUDENTS
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade_level TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.students(account_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- SUBJECTS
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  price_cents INTEGER NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subjects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- CUSTOM PRICES
CREATE TABLE public.custom_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  price_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, subject_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_prices TO authenticated;
GRANT ALL ON public.custom_prices TO service_role;
ALTER TABLE public.custom_prices ENABLE ROW LEVEL SECURITY;

-- CREDITS
CREATE TABLE public.credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  source public.credit_source NOT NULL,
  price_cents_paid INTEGER NOT NULL DEFAULT 0,
  stripe_payment_id TEXT,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_lesson_id UUID,
  refunded_at TIMESTAMPTZ,
  note TEXT
);
CREATE INDEX ON public.credits(account_id);
CREATE INDEX ON public.credits(account_id, consumed_lesson_id, refunded_at, expires_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credits TO authenticated;
GRANT ALL ON public.credits TO service_role;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

-- LESSONS
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  subject_id UUID NOT NULL REFERENCES public.subjects(id),
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status public.lesson_status NOT NULL DEFAULT 'scheduled',
  credit_id UUID REFERENCES public.credits(id) ON DELETE SET NULL,
  stripe_payment_id TEXT,
  price_cents_paid INTEGER NOT NULL DEFAULT 0,
  cancelled_by UUID REFERENCES auth.users(id),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.lessons(account_id);
CREATE INDEX ON public.lessons(starts_at);
CREATE INDEX ON public.lessons(status, starts_at);
-- Prevent double-booking active lessons at same time
CREATE UNIQUE INDEX lessons_active_time_unique
  ON public.lessons(starts_at) WHERE status = 'scheduled';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_lessons_updated BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- SETTINGS (singleton row)
CREATE TABLE public.settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  zoom_link TEXT NOT NULL DEFAULT '',
  tutor_name TEXT NOT NULL DEFAULT 'Your Tutor',
  tutor_email TEXT,
  tutor_timezone TEXT NOT NULL DEFAULT 'America/New_York',
  tutor_bio TEXT NOT NULL DEFAULT '',
  -- weekly_availability: [{ day: 0-6 (0=Sun), start: "16:00", end: "20:00" }]
  weekly_availability JSONB NOT NULL DEFAULT '[]'::jsonb,
  bundle_size INTEGER NOT NULL DEFAULT 5,
  bundle_discount_pct INTEGER NOT NULL DEFAULT 10,
  credit_expiry_months INTEGER NOT NULL DEFAULT 9,
  cancellation_hours INTEGER NOT NULL DEFAULT 24,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- EMAIL LOG (send idempotency)
CREATE TABLE public.email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  recipient TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_log TO authenticated;
GRANT ALL ON public.email_log TO service_role;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- ===================== RLS POLICIES =====================

-- accounts
CREATE POLICY "acc_select_own" ON public.accounts FOR SELECT TO authenticated
  USING (id = public.current_account_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "acc_update_own" ON public.accounts FOR UPDATE TO authenticated
  USING (id = public.current_account_id() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = public.current_account_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "acc_admin_all" ON public.accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- account_members
CREATE POLICY "am_select_own" ON public.account_members FOR SELECT TO authenticated
  USING (account_id = public.current_account_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "am_insert_self" ON public.account_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "am_admin_all" ON public.account_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_roles (read only for self + admin; writes via admin/service role)
CREATE POLICY "ur_select_self_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ur_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- students
CREATE POLICY "st_own" ON public.students FOR ALL TO authenticated
  USING (account_id = public.current_account_id() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (account_id = public.current_account_id() OR public.has_role(auth.uid(), 'admin'));

-- subjects
CREATE POLICY "subj_select_all" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "subj_admin_write" ON public.subjects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- custom_prices
CREATE POLICY "cp_read_own" ON public.custom_prices FOR SELECT TO authenticated
  USING (account_id = public.current_account_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cp_admin_write" ON public.custom_prices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- credits (read own; writes via server functions with service role)
CREATE POLICY "cr_read_own" ON public.credits FOR SELECT TO authenticated
  USING (account_id = public.current_account_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cr_admin_write" ON public.credits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- lessons
CREATE POLICY "les_read_own" ON public.lessons FOR SELECT TO authenticated
  USING (account_id = public.current_account_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "les_admin_write" ON public.lessons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- settings
CREATE POLICY "settings_select_all" ON public.settings FOR SELECT USING (true);
CREATE POLICY "settings_admin_write" ON public.settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- email_log
CREATE POLICY "el_admin" ON public.email_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
