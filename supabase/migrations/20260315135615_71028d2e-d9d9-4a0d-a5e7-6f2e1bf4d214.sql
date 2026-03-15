
-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Senders can insert messages (HR/manager can start, candidates can reply)
CREATE POLICY "Users can send messages"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id IN (SELECT id FROM users WHERE user_id = auth.uid())
);

-- Participants can view their messages
CREATE POLICY "Users can view own messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  sender_id IN (SELECT id FROM users WHERE user_id = auth.uid())
  OR receiver_id IN (SELECT id FROM users WHERE user_id = auth.uid())
);

-- Participants can update (mark as read)
CREATE POLICY "Users can update own messages"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (
  receiver_id IN (SELECT id FROM users WHERE user_id = auth.uid())
);

-- Super admin / owner can see all company messages
CREATE POLICY "Admins can view all company messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.user_id = auth.uid()
    AND u.role IN ('superadmin', 'owner')
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
