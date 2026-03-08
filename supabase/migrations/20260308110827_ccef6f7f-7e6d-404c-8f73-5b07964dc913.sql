
-- Add interview_score and overall_score to applications
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS interview_score integer;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS overall_score numeric;

-- Interviews table
CREATE TABLE public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
  candidate_id uuid NOT NULL,
  job_id uuid REFERENCES public.jobs(id) NOT NULL,
  company_id uuid REFERENCES public.companies(id) NOT NULL,
  round_type text NOT NULL DEFAULT 'hr_interview',
  interviewer_id uuid NOT NULL,
  interviewer_name text NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  duration integer NOT NULL DEFAULT 30,
  mode text NOT NULL DEFAULT 'video_call',
  meeting_link text,
  notes text,
  scorecard jsonb,
  recommendation text,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view company interviews" ON public.interviews FOR SELECT TO authenticated
  USING (company_id IN (SELECT u.company_id FROM users u WHERE u.user_id = auth.uid() AND u.role IN ('owner','superadmin','hr','manager')));
CREATE POLICY "Staff can insert interviews" ON public.interviews FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT u.company_id FROM users u WHERE u.user_id = auth.uid() AND u.role IN ('hr','manager')));
CREATE POLICY "Staff can update interviews" ON public.interviews FOR UPDATE TO authenticated
  USING (company_id IN (SELECT u.company_id FROM users u WHERE u.user_id = auth.uid() AND u.role IN ('hr','manager')));
CREATE POLICY "Candidates can view own interviews" ON public.interviews FOR SELECT TO authenticated
  USING (candidate_id IN (SELECT u.id FROM users u WHERE u.user_id = auth.uid()));

-- Offer letters table
CREATE TABLE public.offer_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
  candidate_id uuid NOT NULL,
  job_id uuid REFERENCES public.jobs(id) NOT NULL,
  company_id uuid REFERENCES public.companies(id) NOT NULL,
  designation text NOT NULL,
  department text NOT NULL,
  ctc_total numeric NOT NULL,
  basic_salary numeric NOT NULL DEFAULT 0,
  hra numeric NOT NULL DEFAULT 0,
  performance_bonus numeric NOT NULL DEFAULT 0,
  other_allowances numeric NOT NULL DEFAULT 0,
  esops numeric DEFAULT 0,
  joining_date date NOT NULL,
  accept_by date NOT NULL,
  work_location text NOT NULL,
  work_type text NOT NULL DEFAULT 'Onsite',
  probation_period text NOT NULL DEFAULT '3 months',
  status text NOT NULL DEFAULT 'sent',
  accepted_at timestamptz,
  decline_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.offer_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view company offers" ON public.offer_letters FOR SELECT TO authenticated
  USING (company_id IN (SELECT u.company_id FROM users u WHERE u.user_id = auth.uid() AND u.role IN ('owner','superadmin','hr','manager')));
CREATE POLICY "HR can insert offers" ON public.offer_letters FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT u.company_id FROM users u WHERE u.user_id = auth.uid() AND u.role IN ('hr')));
CREATE POLICY "HR can update offers" ON public.offer_letters FOR UPDATE TO authenticated
  USING (company_id IN (SELECT u.company_id FROM users u WHERE u.user_id = auth.uid() AND u.role IN ('hr')));
CREATE POLICY "Candidates can view own offers" ON public.offer_letters FOR SELECT TO authenticated
  USING (candidate_id IN (SELECT u.id FROM users u WHERE u.user_id = auth.uid()));
CREATE POLICY "Candidates can update own offers" ON public.offer_letters FOR UPDATE TO authenticated
  USING (candidate_id IN (SELECT u.id FROM users u WHERE u.user_id = auth.uid()));

-- Negotiation messages
CREATE TABLE public.negotiation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES public.offer_letters(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.negotiation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view messages" ON public.negotiation_messages FOR SELECT TO authenticated
  USING (offer_id IN (
    SELECT ol.id FROM offer_letters ol
    JOIN users u ON (u.user_id = auth.uid())
    WHERE ol.candidate_id = u.id OR (u.role IN ('hr','superadmin','owner') AND ol.company_id = u.company_id)
  ));
CREATE POLICY "Participants can send messages" ON public.negotiation_messages FOR INSERT TO authenticated
  WITH CHECK (offer_id IN (
    SELECT ol.id FROM offer_letters ol
    JOIN users u ON (u.user_id = auth.uid())
    WHERE ol.candidate_id = u.id OR (u.role IN ('hr','superadmin','owner') AND ol.company_id = u.company_id)
  ));

-- BGV documents
CREATE TABLE public.bgv_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
  candidate_id uuid NOT NULL,
  document_type text NOT NULL,
  file_url text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bgv_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view company bgv docs" ON public.bgv_documents FOR SELECT TO authenticated
  USING (application_id IN (SELECT a.id FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.company_id = j.company_id WHERE u.user_id = auth.uid() AND u.role IN ('owner','superadmin','hr','manager')));
CREATE POLICY "Staff can update bgv docs" ON public.bgv_documents FOR UPDATE TO authenticated
  USING (application_id IN (SELECT a.id FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.company_id = j.company_id WHERE u.user_id = auth.uid() AND u.role IN ('hr')));
CREATE POLICY "Candidates can view own bgv docs" ON public.bgv_documents FOR SELECT TO authenticated
  USING (candidate_id IN (SELECT u.id FROM users u WHERE u.user_id = auth.uid()));
CREATE POLICY "Candidates can insert bgv docs" ON public.bgv_documents FOR INSERT TO authenticated
  WITH CHECK (candidate_id IN (SELECT u.id FROM users u WHERE u.user_id = auth.uid()));

-- Enable realtime for negotiation messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.negotiation_messages;

-- Add onboarding stages to applications
-- (already flexible text field, no change needed)

-- Add updated_at trigger to new tables
CREATE TRIGGER update_interviews_updated_at BEFORE UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_offer_letters_updated_at BEFORE UPDATE ON public.offer_letters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
