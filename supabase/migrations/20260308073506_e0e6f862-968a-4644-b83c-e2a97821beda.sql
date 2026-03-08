
-- Create assessments table for AI-generated aptitude test questions
CREATE TABLE public.assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  created_by UUID NOT NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- HR/staff can view assessments for their company
CREATE POLICY "Staff can view company assessments"
ON public.assessments FOR SELECT TO authenticated
USING (
  company_id IN (
    SELECT u.company_id FROM public.users u
    WHERE u.user_id = auth.uid()
    AND u.role IN ('owner', 'superadmin', 'hr', 'manager')
  )
);

-- HR can insert assessments for their company
CREATE POLICY "HR can insert assessments"
ON public.assessments FOR INSERT TO authenticated
WITH CHECK (
  company_id IN (
    SELECT u.company_id FROM public.users u
    WHERE u.user_id = auth.uid()
    AND u.role = 'hr'
  )
);

-- HR can update assessments for their company
CREATE POLICY "HR can update company assessments"
ON public.assessments FOR UPDATE TO authenticated
USING (
  company_id IN (
    SELECT u.company_id FROM public.users u
    WHERE u.user_id = auth.uid()
    AND u.role = 'hr'
  )
);

-- Candidates can read approved assessments for their applications
CREATE POLICY "Candidates can read approved assessments"
ON public.assessments FOR SELECT TO authenticated
USING (
  status = 'approved'
  AND application_id IN (
    SELECT a.id FROM public.applications a
    JOIN public.users u ON u.id = a.candidate_id
    WHERE u.user_id = auth.uid()
  )
);

-- Add updated_at trigger
CREATE TRIGGER update_assessments_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
