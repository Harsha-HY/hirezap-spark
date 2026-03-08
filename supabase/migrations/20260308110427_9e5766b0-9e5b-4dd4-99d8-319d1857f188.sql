CREATE POLICY "Staff can delete GD scores" ON public.gd_scores
FOR DELETE TO authenticated
USING (
  gd_id IN (
    SELECT gd.id FROM group_discussions gd
    JOIN users u ON u.company_id = gd.company_id
    WHERE u.user_id = auth.uid()
    AND u.role IN ('owner', 'superadmin', 'hr', 'manager')
  )
);