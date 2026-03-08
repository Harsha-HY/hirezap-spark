
ALTER TABLE public.jobs ADD COLUMN aptitude_cutoff integer DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.auto_advance_on_test_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff integer;
BEGIN
  IF NEW.current_stage = 'test_completed' AND NEW.test_score IS NOT NULL THEN
    SELECT aptitude_cutoff INTO v_cutoff FROM jobs WHERE id = NEW.job_id;
    
    IF v_cutoff IS NOT NULL AND NEW.test_score >= v_cutoff THEN
      NEW.current_stage := 'video_intro';
      
      INSERT INTO notifications (user_id, title, message)
      VALUES (
        NEW.candidate_id,
        '🎉 Aptitude Test Cleared!',
        'Congratulations! You scored ' || NEW.test_score || '% and cleared the aptitude test (cutoff: ' || v_cutoff || '%). Next step: Video Introduction. Login to record your video.'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_advance_on_test_score
  BEFORE UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_advance_on_test_score();
