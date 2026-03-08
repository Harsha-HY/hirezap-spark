
-- Create security definer function to check if user is a candidate in any GD group
CREATE OR REPLACE FUNCTION public.is_candidate_in_gd(p_gd_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM gd_groups g, users u
    WHERE g.gd_id = p_gd_id
      AND u.user_id = auth.uid()
      AND u.id = ANY(g.candidate_ids)
  );
$$;

-- Create security definer function to check if user is staff in GD's company
CREATE OR REPLACE FUNCTION public.is_staff_for_gd(p_gd_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_discussions gd
    JOIN users u ON u.company_id = gd.company_id
    WHERE gd.id = p_gd_id
      AND u.user_id = auth.uid()
      AND u.role IN ('owner', 'superadmin', 'hr', 'manager')
  );
$$;

-- Drop old problematic policies on group_discussions
DROP POLICY IF EXISTS "Candidates can view own GDs" ON public.group_discussions;
DROP POLICY IF EXISTS "Staff can view company GDs" ON public.group_discussions;
DROP POLICY IF EXISTS "Staff can insert GDs" ON public.group_discussions;
DROP POLICY IF EXISTS "Staff can update GDs" ON public.group_discussions;

-- Recreate policies without circular references
CREATE POLICY "Candidates can view own GDs" ON public.group_discussions
FOR SELECT USING (public.is_candidate_in_gd(id));

CREATE POLICY "Staff can view company GDs" ON public.group_discussions
FOR SELECT USING (
  company_id IN (
    SELECT u.company_id FROM users u
    WHERE u.user_id = auth.uid()
      AND u.role IN ('owner', 'superadmin', 'hr', 'manager')
  )
);

CREATE POLICY "Staff can insert GDs" ON public.group_discussions
FOR INSERT WITH CHECK (
  company_id IN (
    SELECT u.company_id FROM users u
    WHERE u.user_id = auth.uid()
      AND u.role IN ('hr', 'manager')
  )
);

CREATE POLICY "Staff can update GDs" ON public.group_discussions
FOR UPDATE USING (
  company_id IN (
    SELECT u.company_id FROM users u
    WHERE u.user_id = auth.uid()
      AND u.role IN ('hr', 'manager')
  )
);

-- Drop old problematic policies on gd_groups
DROP POLICY IF EXISTS "Candidates can view own groups" ON public.gd_groups;
DROP POLICY IF EXISTS "Staff can insert GD groups" ON public.gd_groups;
DROP POLICY IF EXISTS "Staff can view GD groups" ON public.gd_groups;

-- Recreate gd_groups policies without circular references
CREATE POLICY "Candidates can view own groups" ON public.gd_groups
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.user_id = auth.uid()
      AND u.id = ANY(gd_groups.candidate_ids)
  )
);

CREATE POLICY "Staff can insert GD groups" ON public.gd_groups
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.user_id = auth.uid()
      AND u.role IN ('hr', 'manager')
  )
);

CREATE POLICY "Staff can view GD groups" ON public.gd_groups
FOR SELECT USING (
  public.is_staff_for_gd(gd_id)
);
