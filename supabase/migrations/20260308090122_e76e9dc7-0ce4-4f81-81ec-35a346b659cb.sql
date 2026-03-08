
-- Allow managers to insert notifications
DROP POLICY IF EXISTS "Staff can insert notifications" ON public.notifications;
CREATE POLICY "Staff can insert notifications" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.user_id = auth.uid()
    AND users.role IN ('owner', 'superadmin', 'hr', 'manager')
  )
);

-- Allow managers to insert assessments
DROP POLICY IF EXISTS "HR can insert assessments" ON public.assessments;
CREATE POLICY "Staff can insert assessments" ON public.assessments
FOR INSERT TO authenticated
WITH CHECK (
  company_id IN (
    SELECT u.company_id FROM users u
    WHERE u.user_id = auth.uid()
    AND u.role IN ('hr', 'manager')
  )
);

-- Allow managers to update assessments
DROP POLICY IF EXISTS "HR can update company assessments" ON public.assessments;
CREATE POLICY "Staff can update company assessments" ON public.assessments
FOR UPDATE TO authenticated
USING (
  company_id IN (
    SELECT u.company_id FROM users u
    WHERE u.user_id = auth.uid()
    AND u.role IN ('hr', 'manager')
  )
);
