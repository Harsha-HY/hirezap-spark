
-- Create storage buckets for offer letters and BGV documents
INSERT INTO storage.buckets (id, name, public) VALUES ('offer-letters', 'offer-letters', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('bgv-documents', 'bgv-documents', false) ON CONFLICT DO NOTHING;

-- Storage policies for offer-letters
CREATE POLICY "Staff can upload offer letters" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'offer-letters' AND EXISTS (SELECT 1 FROM users u WHERE u.user_id = auth.uid() AND u.role IN ('hr')));
CREATE POLICY "Staff can view offer letters" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'offer-letters' AND EXISTS (SELECT 1 FROM users u WHERE u.user_id = auth.uid() AND u.role IN ('owner','superadmin','hr','manager','candidate')));

-- Storage policies for bgv-documents
CREATE POLICY "Candidates can upload bgv docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bgv-documents' AND EXISTS (SELECT 1 FROM users u WHERE u.user_id = auth.uid() AND u.role = 'candidate'));
CREATE POLICY "Staff can view bgv docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bgv-documents' AND EXISTS (SELECT 1 FROM users u WHERE u.user_id = auth.uid() AND u.role IN ('owner','superadmin','hr','manager','candidate')));
