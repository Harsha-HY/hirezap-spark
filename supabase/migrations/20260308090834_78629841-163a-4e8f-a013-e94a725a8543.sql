
-- Add type column to assessments to distinguish aptitude vs technical
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'aptitude';

-- Add dual-approval columns for technical assessments
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS hr_approved boolean NOT NULL DEFAULT false;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS manager_approved boolean NOT NULL DEFAULT false;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS hr_approved_at timestamp with time zone;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS manager_approved_at timestamp with time zone;

-- Add technical_score to applications
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS technical_score integer;
