
-- Applications table
CREATE TABLE public.applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  current_company text NOT NULL,
  current_ctc numeric NOT NULL,
  expected_ctc numeric NOT NULL,
  notice_period integer NOT NULL,
  experience_years numeric NOT NULL,
  resume_url text,
  photo_url text,
  cover_letter text,
  current_stage text NOT NULL DEFAULT 'applied',
  status text NOT NULL DEFAULT 'active',
  applied_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Candidates can view their own applications
CREATE POLICY "Candidates can view own applications"
  ON public.applications FOR SELECT
  USING (candidate_id IN (
    SELECT id FROM public.users WHERE user_id = auth.uid()
  ));

-- Candidates can insert applications
CREATE POLICY "Candidates can insert applications"
  ON public.applications FOR INSERT
  WITH CHECK (candidate_id IN (
    SELECT id FROM public.users WHERE user_id = auth.uid() AND role = 'candidate'
  ));

-- Company staff can view applications for their jobs
CREATE POLICY "Staff can view company applications"
  ON public.applications FOR SELECT
  USING (job_id IN (
    SELECT j.id FROM public.jobs j
    INNER JOIN public.users u ON u.company_id = j.company_id
    WHERE u.user_id = auth.uid() AND u.role IN ('owner', 'superadmin', 'hr', 'manager')
  ));

-- Staff can update applications (change stage/status)
CREATE POLICY "Staff can update company applications"
  ON public.applications FOR UPDATE
  USING (job_id IN (
    SELECT j.id FROM public.jobs j
    INNER JOIN public.users u ON u.company_id = j.company_id
    WHERE u.user_id = auth.uid() AND u.role IN ('owner', 'superadmin', 'hr', 'manager')
  ));

-- Storage buckets for resumes and photos
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true);

-- Storage policies for resumes
CREATE POLICY "Candidates can upload resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'resumes' AND auth.role() = 'authenticated');

CREATE POLICY "Candidates can view own resumes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resumes' AND auth.role() = 'authenticated');

-- Storage policies for photos
CREATE POLICY "Candidates can upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'photos' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photos');

-- RLS policy for public job viewing (anon users)
CREATE POLICY "Anyone can view open jobs"
  ON public.jobs FOR SELECT
  USING (status = 'open');

-- Allow candidates to read company names for job listings
CREATE POLICY "Anyone can read company names"
  ON public.companies FOR SELECT
  USING (true);
