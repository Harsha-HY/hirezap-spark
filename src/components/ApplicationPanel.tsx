import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Image } from "lucide-react";

interface ApplicationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: { id: string; title: string; company_id: string } | null;
  onSuccess?: () => void;
}

const ApplicationPanel = ({ open, onOpenChange, job, onSuccess }: ApplicationPanelProps) => {
  const [currentCompany, setCurrentCompany] = useState("");
  const [currentCtc, setCurrentCtc] = useState("");
  const [expectedCtc, setExpectedCtc] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const inputClass = "w-full rounded-xl border border-border bg-card/60 backdrop-blur-sm py-3 px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm";

  const resetForm = () => {
    setCurrentCompany("");
    setCurrentCtc("");
    setExpectedCtc("");
    setNoticePeriod("");
    setExperienceYears("");
    setCoverLetter("");
    setResumeFile(null);
    setPhotoFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: "Please login first", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Get candidate user record
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!userData) {
      toast({ title: "User not found", variant: "destructive" });
      setLoading(false);
      return;
    }

    let resumePath: string | null = null;
    let photoUrl: string | null = null;

    // Upload resume (private bucket -> store object path, not public URL)
    if (resumeFile) {
      const path = `${userData.id}/${Date.now()}_${resumeFile.name}`;
      const { error: uploadErr } = await supabase.storage.from("resumes").upload(path, resumeFile);
      if (uploadErr) {
        toast({ title: "Resume upload failed", description: uploadErr.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      resumePath = path;
    }

    // Upload photo
    if (photoFile) {
      const path = `${userData.id}/${Date.now()}_${photoFile.name}`;
      const { error: uploadErr } = await supabase.storage.from("photos").upload(path, photoFile);
      if (uploadErr) {
        toast({ title: "Photo upload failed", description: uploadErr.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);
      photoUrl = urlData.publicUrl;
    }

    const { data: insertedApplication, error } = await supabase
      .from("applications")
      .insert({
        candidate_id: userData.id,
        job_id: job.id,
        current_company: currentCompany,
        current_ctc: parseFloat(currentCtc),
        expected_ctc: parseFloat(expectedCtc),
        notice_period: parseInt(noticePeriod),
        experience_years: parseFloat(experienceYears),
        resume_url: resumePath,
        photo_url: photoUrl,
        cover_letter: coverLetter || null,
        current_stage: "applied",
        status: "active",
      })
      .select("id")
      .single();

    if (error || !insertedApplication) {
      toast({ title: "Submission failed", description: error?.message || "Could not save application", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Trigger AI resume scoring in background (don't block UX)
    if (resumePath) {
      supabase.functions.invoke("score-resume", {
        body: { applicationId: insertedApplication.id },
      }).then((res) => {
        if (res.error) console.error("AI scoring error:", res.error);
        else console.log("AI scoring complete:", res.data);
      });
    }

    resetForm();
    onOpenChange(false);
    onSuccess?.();
    setLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg bg-card border-border overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-foreground text-xl">
            Apply for <span className="text-primary">{job?.title}</span>
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Current Company *</label>
            <input
              type="text"
              value={currentCompany}
              onChange={(e) => setCurrentCompany(e.target.value)}
              required
              className={inputClass}
              placeholder="Enter current company"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Current CTC (LPA) *</label>
              <input
                type="number"
                step="0.1"
                value={currentCtc}
                onChange={(e) => setCurrentCtc(e.target.value)}
                required
                className={inputClass}
                placeholder="e.g. 8.5"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Expected CTC (LPA) *</label>
              <input
                type="number"
                step="0.1"
                value={expectedCtc}
                onChange={(e) => setExpectedCtc(e.target.value)}
                required
                className={inputClass}
                placeholder="e.g. 12"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Notice Period (days) *</label>
              <input
                type="number"
                value={noticePeriod}
                onChange={(e) => setNoticePeriod(e.target.value)}
                required
                className={inputClass}
                placeholder="e.g. 30"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Experience (years) *</label>
              <input
                type="number"
                step="0.5"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                required
                className={inputClass}
                placeholder="e.g. 3"
              />
            </div>
          </div>

          {/* Resume upload */}
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Resume (PDF, max 5MB)</label>
            <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-dashed border-border bg-card/40 p-4 hover:border-primary/50 transition-colors">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {resumeFile ? resumeFile.name : "Click to upload resume"}
              </span>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && file.size > 5 * 1024 * 1024) {
                    toast({ title: "File too large", description: "Max 5MB allowed", variant: "destructive" });
                    return;
                  }
                  setResumeFile(file || null);
                }}
              />
            </label>
          </div>

          {/* Photo upload */}
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Profile Photo (JPG/PNG, max 2MB)</label>
            <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-dashed border-border bg-card/40 p-4 hover:border-primary/50 transition-colors">
              <Image className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {photoFile ? photoFile.name : "Click to upload photo"}
              </span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && file.size > 2 * 1024 * 1024) {
                    toast({ title: "File too large", description: "Max 2MB allowed", variant: "destructive" });
                    return;
                  }
                  setPhotoFile(file || null);
                }}
              />
            </label>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Cover Letter (optional)</label>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={4}
              className={inputClass + " resize-none"}
              placeholder="Write a brief cover letter..."
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-5 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_hsl(160,100%,45%,0.3)] transition-all"
          >
            {loading ? "Submitting..." : "Submit Application"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default ApplicationPanel;
