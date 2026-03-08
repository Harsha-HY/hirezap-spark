
-- Add test_score column to applications
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS test_score integer;

-- Create test_violations table
CREATE TABLE public.test_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL,
  job_id uuid NOT NULL,
  violation_type text NOT NULL,
  description text NOT NULL,
  question_number integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create test_answers table to store candidate responses
CREATE TABLE public.test_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  question_index integer NOT NULL,
  selected_option integer,
  time_spent_seconds integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.test_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_answers ENABLE ROW LEVEL SECURITY;

-- Violations: candidates can insert own violations
CREATE POLICY "Candidates can insert own violations"
ON public.test_violations FOR INSERT TO authenticated
WITH CHECK (candidate_id IN (
  SELECT id FROM public.users WHERE user_id = auth.uid()
));

-- Violations: staff can view company violations
CREATE POLICY "Staff can view violations"
ON public.test_violations FOR SELECT TO authenticated
USING (job_id IN (
  SELECT j.id FROM jobs j
  JOIN users u ON u.company_id = j.company_id
  WHERE u.user_id = auth.uid() AND u.role IN ('owner','superadmin','hr','manager')
));

-- Violations: candidates can view own violations
CREATE POLICY "Candidates can view own violations"
ON public.test_violations FOR SELECT TO authenticated
USING (candidate_id IN (
  SELECT id FROM public.users WHERE user_id = auth.uid()
));

-- Answers: candidates can insert own answers
CREATE POLICY "Candidates can insert own answers"
ON public.test_answers FOR INSERT TO authenticated
WITH CHECK (application_id IN (
  SELECT id FROM public.applications WHERE candidate_id IN (
    SELECT id FROM public.users WHERE user_id = auth.uid()
  )
));

-- Answers: candidates can update own answers
CREATE POLICY "Candidates can update own answers"
ON public.test_answers FOR UPDATE TO authenticated
USING (application_id IN (
  SELECT id FROM public.applications WHERE candidate_id IN (
    SELECT id FROM public.users WHERE user_id = auth.uid()
  )
));

-- Answers: candidates can view own answers
CREATE POLICY "Candidates can view own answers"
ON public.test_answers FOR SELECT TO authenticated
USING (application_id IN (
  SELECT id FROM public.applications WHERE candidate_id IN (
    SELECT id FROM public.users WHERE user_id = auth.uid()
  )
));

-- Answers: staff can view company answers
CREATE POLICY "Staff can view answers"
ON public.test_answers FOR SELECT TO authenticated
USING (application_id IN (
  SELECT a.id FROM applications a
  JOIN jobs j ON j.id = a.job_id
  JOIN users u ON u.company_id = j.company_id
  WHERE u.user_id = auth.uid() AND u.role IN ('owner','superadmin','hr','manager')
));

-- Enable realtime for violations
ALTER PUBLICATION supabase_realtime ADD TABLE public.test_violations;
