
-- Group Discussions table
CREATE TABLE public.group_discussions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  topic TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  duration INTEGER NOT NULL DEFAULT 20,
  instructions TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- GD Groups table
CREATE TABLE public.gd_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gd_id UUID NOT NULL REFERENCES public.group_discussions(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  candidate_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- GD Scores table
CREATE TABLE public.gd_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gd_id UUID NOT NULL REFERENCES public.group_discussions(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL,
  group_id UUID REFERENCES public.gd_groups(id),
  speaking_time_minutes NUMERIC DEFAULT 0,
  speaking_percentage NUMERIC DEFAULT 0,
  times_spoke INTEGER DEFAULT 0,
  points_quality NUMERIC DEFAULT 0,
  relevance_score NUMERIC DEFAULT 0,
  leadership_score NUMERIC DEFAULT 0,
  communication_score NUMERIC DEFAULT 0,
  overall_gd_score NUMERIC DEFAULT 0,
  verdict TEXT DEFAULT 'pending',
  ai_feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.group_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gd_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gd_scores ENABLE ROW LEVEL SECURITY;

-- RLS for group_discussions
CREATE POLICY "Staff can view company GDs" ON public.group_discussions
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT u.company_id FROM users u WHERE u.user_id = auth.uid() AND u.role IN ('owner','superadmin','hr','manager')
  ));

CREATE POLICY "Staff can insert GDs" ON public.group_discussions
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT u.company_id FROM users u WHERE u.user_id = auth.uid() AND u.role IN ('hr','manager')
  ));

CREATE POLICY "Staff can update GDs" ON public.group_discussions
  FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT u.company_id FROM users u WHERE u.user_id = auth.uid() AND u.role IN ('hr','manager')
  ));

-- Candidates can see their own GDs
CREATE POLICY "Candidates can view own GDs" ON public.group_discussions
  FOR SELECT TO authenticated
  USING (id IN (
    SELECT g.gd_id FROM gd_groups g, users u
    WHERE u.user_id = auth.uid() AND u.id = ANY(g.candidate_ids)
  ));

-- RLS for gd_groups
CREATE POLICY "Staff can view GD groups" ON public.gd_groups
  FOR SELECT TO authenticated
  USING (gd_id IN (
    SELECT gd.id FROM group_discussions gd
    JOIN users u ON u.company_id = gd.company_id
    WHERE u.user_id = auth.uid() AND u.role IN ('owner','superadmin','hr','manager')
  ));

CREATE POLICY "Staff can insert GD groups" ON public.gd_groups
  FOR INSERT TO authenticated
  WITH CHECK (gd_id IN (
    SELECT gd.id FROM group_discussions gd
    JOIN users u ON u.company_id = gd.company_id
    WHERE u.user_id = auth.uid() AND u.role IN ('hr','manager')
  ));

CREATE POLICY "Candidates can view own groups" ON public.gd_groups
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.user_id = auth.uid() AND u.id = ANY(candidate_ids)
  ));

-- RLS for gd_scores
CREATE POLICY "Staff can view GD scores" ON public.gd_scores
  FOR SELECT TO authenticated
  USING (gd_id IN (
    SELECT gd.id FROM group_discussions gd
    JOIN users u ON u.company_id = gd.company_id
    WHERE u.user_id = auth.uid() AND u.role IN ('owner','superadmin','hr','manager')
  ));

CREATE POLICY "Staff can insert GD scores" ON public.gd_scores
  FOR INSERT TO authenticated
  WITH CHECK (gd_id IN (
    SELECT gd.id FROM group_discussions gd
    JOIN users u ON u.company_id = gd.company_id
    WHERE u.user_id = auth.uid() AND u.role IN ('hr','manager')
  ));

CREATE POLICY "Staff can update GD scores" ON public.gd_scores
  FOR UPDATE TO authenticated
  USING (gd_id IN (
    SELECT gd.id FROM group_discussions gd
    JOIN users u ON u.company_id = gd.company_id
    WHERE u.user_id = auth.uid() AND u.role IN ('hr','manager')
  ));

-- Add updated_at trigger
CREATE TRIGGER update_group_discussions_updated_at
  BEFORE UPDATE ON public.group_discussions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
