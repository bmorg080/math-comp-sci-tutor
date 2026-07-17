
-- Owners can insert lessons for their own account
CREATE POLICY les_insert_own ON public.lessons
FOR INSERT TO authenticated
WITH CHECK (account_id = public.current_account_id());

-- Owners can update their own lessons (used for cancel/reschedule)
CREATE POLICY les_update_own ON public.lessons
FOR UPDATE TO authenticated
USING (account_id = public.current_account_id())
WITH CHECK (account_id = public.current_account_id());

-- Owners need UPDATE on credits to refund on cancel (mark refunded_at, clear consumed_lesson_id)
CREATE POLICY cr_update_own ON public.credits
FOR UPDATE TO authenticated
USING (account_id = public.current_account_id())
WITH CHECK (account_id = public.current_account_id());
