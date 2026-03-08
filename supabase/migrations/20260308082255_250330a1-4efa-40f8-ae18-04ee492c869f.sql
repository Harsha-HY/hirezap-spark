
-- Add video columns to applications
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS video_score integer,
  ADD COLUMN IF NOT EXISTS video_analysis jsonb;

-- Create videos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: candidates can upload own videos
CREATE POLICY "Candidates can upload videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'videos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.users WHERE user_id = auth.uid() AND role = 'candidate'
  )
);

-- RLS: candidates can read own videos
CREATE POLICY "Candidates can read own videos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'videos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.users WHERE user_id = auth.uid()
  )
);

-- RLS: staff can read company candidate videos
CREATE POLICY "Staff can read company videos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'videos'
  AND (storage.foldername(name))[1] IN (
    SELECT a.candidate_id::text
    FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    JOIN public.users u ON u.company_id = j.company_id
    WHERE u.user_id = auth.uid()
      AND u.role IN ('owner', 'superadmin', 'hr', 'manager')
  )
);
