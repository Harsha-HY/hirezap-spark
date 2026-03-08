
-- Allow authenticated users to read company_code from their own company
CREATE POLICY "Users can read own company"
ON public.companies
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT company_id FROM public.users WHERE user_id = auth.uid() AND company_id IS NOT NULL
  )
);
