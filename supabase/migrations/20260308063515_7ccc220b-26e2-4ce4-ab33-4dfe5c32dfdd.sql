-- Add AI scoring columns to applications table
ALTER TABLE public.applications 
  ADD COLUMN IF NOT EXISTS resume_score integer,
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb;

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;