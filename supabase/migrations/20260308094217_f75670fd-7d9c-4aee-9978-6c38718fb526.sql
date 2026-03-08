
CREATE POLICY "Manager can insert jobs"
ON public.jobs
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT users.company_id
    FROM users
    WHERE users.user_id = auth.uid() AND users.role = 'manager'
  )
);

CREATE POLICY "Manager can update company jobs"
ON public.jobs
FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT users.company_id
    FROM users
    WHERE users.user_id = auth.uid() AND users.role = 'manager'
  )
);
