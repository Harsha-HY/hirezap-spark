
-- Allow authenticated users to read resume files (HR needs to view candidate resumes)
CREATE POLICY "Authenticated users can read resumes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'resumes');
