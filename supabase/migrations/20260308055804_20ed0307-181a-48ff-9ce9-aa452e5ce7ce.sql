
-- Tighten notifications insert policy to only allow HR/superadmin/owner roles
DROP POLICY "Authenticated can insert notifications" ON public.notifications;

CREATE POLICY "Staff can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'superadmin', 'hr')
  )
);
