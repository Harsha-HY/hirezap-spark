
-- Add code_answers column to store DSA/coding text answers for AI analysis
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS code_answers jsonb;
