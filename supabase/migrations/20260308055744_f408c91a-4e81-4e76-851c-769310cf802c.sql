
-- Create jobs table
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department text NOT NULL,
  manager_id uuid REFERENCES public.users(id),
  salary_min numeric,
  salary_max numeric,
  location text NOT NULL,
  work_type text NOT NULL DEFAULT 'Onsite',
  experience_min numeric,
  experience_max numeric,
  skills_required text[] DEFAULT '{}',
  job_description text,
  posted_by uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  status text NOT NULL DEFAULT 'open',
  applications_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Company users can view their company's jobs
CREATE POLICY "Users can view company jobs"
ON public.jobs FOR SELECT TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.users WHERE user_id = auth.uid() AND company_id IS NOT NULL
  )
);

-- HR can insert jobs for their company
CREATE POLICY "HR can insert jobs"
ON public.jobs FOR INSERT TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.users WHERE user_id = auth.uid() AND role = 'hr'
  )
);

-- HR can update their company's jobs
CREATE POLICY "HR can update company jobs"
ON public.jobs FOR UPDATE TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.users WHERE user_id = auth.uid() AND role = 'hr'
  )
);

-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (
  user_id IN (
    SELECT id FROM public.users WHERE user_id = auth.uid()
  )
);

-- Any authenticated user can insert notifications
CREATE POLICY "Authenticated can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (true);

-- Users can update (mark read) their own notifications
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (
  user_id IN (
    SELECT id FROM public.users WHERE user_id = auth.uid()
  )
);

-- Add updated_at trigger to jobs
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
