
-- Companies table
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  industry text NOT NULL DEFAULT 'Other',
  location text NOT NULL,
  plan text NOT NULL DEFAULT 'Starter',
  company_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add company_id to users table
ALTER TABLE public.users ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- Enable RLS on companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Owner can do everything with companies
CREATE POLICY "Owner can select companies" ON public.companies FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owner can insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner can update companies" ON public.companies FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owner can delete companies" ON public.companies FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Update trigger for companies
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
