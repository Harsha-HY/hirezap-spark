CREATE POLICY "Candidates can update own applications"
ON public.applications
FOR UPDATE
TO authenticated
USING (
  candidate_id IN (
    SELECT id FROM users WHERE user_id = auth.uid() AND role = 'candidate'
  )
)
WITH CHECK (
  candidate_id IN (
    SELECT id FROM users WHERE user_id = auth.uid() AND role = 'candidate'
  )
);