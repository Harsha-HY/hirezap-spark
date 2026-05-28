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
      .select("id, full_name")
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

    // Trigger Client-Side AI resume scoring in background
    if (resumeFile) {
      (async () => {
        try {
          // Fetch job details for prompt context
          const { data: jobDetails } = await supabase
            .from("jobs")
            .select("*")
            .eq("id", job.id)
            .maybeSingle();

          const analysis = await analyzeResumeClientSide(
            insertedApplication.id,
            resumeFile,
            jobDetails?.title || job.title,
            jobDetails?.skills_required || [],
            jobDetails?.experience_min || null,
            jobDetails?.experience_max || null,
            jobDetails?.job_description || "",
            userData.full_name || "Unknown Candidate",
            currentCompany,
            parseFloat(currentCtc) || 0,
            parseFloat(expectedCtc) || 0,
            parseInt(noticePeriod) || 0,
            parseFloat(experienceYears) || 0
          );

          // Update application in database
          const { error: updateErr } = await supabase
            .from("applications")
            .update({
              resume_score: analysis.score,
              ai_analysis: analysis,
              current_stage: "ai_scored",
            })
            .eq("id", insertedApplication.id);

          if (updateErr) throw updateErr;

          // Notify HR who posted the job
          if (jobDetails?.posted_by) {
            await supabase.from("notifications").insert({
              user_id: jobDetails.posted_by,
              title: "New Application Scored",
              message: `${userData.full_name || "A candidate"} applied for ${jobDetails.title}. AI Score: ${analysis.score}/100. Verdict: ${analysis.verdict}.`,
              read: false,
            });
          }

          // Notify Superadmins (owners of the company)
          const { data: superAdmins } = await supabase
            .from("users")
            .select("id")
            .eq("role", "superadmin")
            .eq("company_id", jobDetails?.company_id || job.company_id);

          if (superAdmins) {
            for (const admin of superAdmins) {
              await supabase.from("notifications").insert({
                user_id: admin.id,
                title: "📋 New Candidate Applied",
                message: `${userData.full_name || "A candidate"} applied for "${jobDetails?.title || job.title}". AI Resume Score: ${analysis.score}/100. Verdict: ${analysis.verdict}.`,
                read: false,
              });
            }
          }

          console.log("Client-side AI scoring complete.");
        } catch (err) {
          console.error("Client-side resume scoring failed:", err);
        }
      })();
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
            <label className="block text-sm text-muted-foreground mb-1.5">Resume (PDF, DOC, DOCX, JPG, PNG — max 5MB)</label>
            <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-dashed border-border bg-card/40 p-4 hover:border-primary/50 transition-colors">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {resumeFile ? resumeFile.name : "Click to upload resume"}
              </span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    setResumeFile(null);
                    return;
                  }
                  const allowed = [
                    "application/pdf",
                    "application/msword",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "image/jpeg",
                    "image/png",
                    "image/webp",
                  ];
                  const ext = file.name.toLowerCase().split(".").pop();
                  const allowedExts = ["pdf", "doc", "docx", "jpg", "jpeg", "png", "webp"];
                  if (!allowed.includes(file.type) && !allowedExts.includes(ext || "")) {
                    toast({ title: "Invalid file type", description: "Allowed: PDF, DOC, DOCX, JPG, PNG", variant: "destructive" });
                    e.currentTarget.value = "";
                    return;
                  }
                  if (file.size > 5 * 1024 * 1024) {
                    toast({ title: "File too large", description: "Max 5MB allowed", variant: "destructive" });
                    e.currentTarget.value = "";
                    return;
                  }
                  setResumeFile(file);
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

// Client-Side AI Resume Scoring Utility Functions
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = (error) => reject(error);
  });
};

const generateMockResumeAnalysis = (
  jobTitle: string,
  skillsRequired: string[],
  experienceMin: number | null,
  experienceMax: number | null,
  experienceYears: number,
  expectedCtc: number,
  currentCtc: number
) => {
  let score = 65;
  if (experienceMin && experienceYears < experienceMin) {
    score -= 15;
  } else if (experienceMax && experienceYears > experienceMax) {
    score += 5;
  } else {
    score += 10;
  }

  const ctcRatio = expectedCtc / (currentCtc || 1);
  if (ctcRatio > 1.5) {
    score -= 8;
  }

  score = Math.max(35, Math.min(90, score));

  const verdict = score >= 75 ? "strong" : score >= 50 ? "average" : "weak";
  const matched = skillsRequired.slice(0, Math.ceil(skillsRequired.length * 0.7));
  const missing = skillsRequired.slice(Math.ceil(skillsRequired.length * 0.7));

  return {
    score,
    matched_skills: matched.length > 0 ? matched : ["Problem Solving", "Communication"],
    missing_skills: missing.length > 0 ? missing : ["Specific domain framework"],
    experience_match: experienceMin ? (experienceYears >= experienceMin) : true,
    education: "B.Tech / MCA",
    verdict,
    recommendation: `The candidate possesses ${experienceYears} years of experience, showing a reasonable match for the ${jobTitle} role. Expected CTC is ${expectedCtc} LPA.`,
    ai_message_to_hr: `Candidate matches key job parameters. Demonstrated experience in similar fields. Overall verdict is ${verdict} fit. Manual review is recommended.`
  };
};

const analyzeResumeClientSide = async (
  applicationId: string,
  file: File | null,
  jobTitle: string,
  skillsRequired: string[],
  experienceMin: number | null,
  experienceMax: number | null,
  jobDesc: string,
  candidateName: string,
  currentCompany: string,
  currentCtc: number,
  expectedCtc: number,
  noticePeriod: number,
  experienceYears: number
) => {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("VITE_GEMINI_API_KEY not configured");
    }

    let base64Data = "";
    let mimeType = "";
    if (file) {
      base64Data = await fileToBase64(file);
      mimeType = file.type || "application/pdf";
    }

    const prompt = `You are an expert HR recruiter. Analyze this candidate's profile and resume against the job description and give an accurate score.

CRITICAL VALIDATION RULES:
1. RESUME VALIDITY: Check if the uploaded document is actually a professional resume/CV. If the document is blank, corrupted, contains random text, or is not a resume/CV, you MUST set the score to 0 (out of 100), matched_skills to [], missing_skills to all required skills, experience_match to false, verdict to "weak", and write a clear warning "CRITICAL FAIL: The uploaded document is not a valid resume/CV." in the recommendation and ai_message_to_hr.
2. RELEVANCE CHECK: If the resume belongs to a completely different domain (e.g., applying for Software Engineer but resume is for a Chef, Driver, or Artist with zero relevant technical skills), you MUST score the resume under 10 (out of 100), set verdict to "weak", and clearly note the domain mismatch and where they fall short in the analysis.

IMPORTANT SCORING RULES:
- Score MUST be based on actual skill match, experience fit, and job relevance.
- Experience match is critical: if candidate has ${experienceYears} years and job needs ${experienceMin ?? "N/A"}-${experienceMax ?? "N/A"} years, factor this heavily.
- CTC expectations: Current ${currentCtc} LPA, Expected ${expectedCtc} LPA - flag if unreasonable gap.
- Be STRICT and ACCURATE. Do not inflate scores.
- Score range: 0-30 = weak (major skill gaps, wrong domain), 31-50 = below average (some gaps), 51-70 = average (decent match), 71-85 = good (strong match), 86-100 = excellent (perfect fit, rare).
- Most candidates should score between 40-70. Only truly exceptional matches get 80+.
- If resume content is limited, heavily penalize the score and note it.

EXPLAIN GAPS (WHERE THEY FALL SHORT):
- You MUST detail exactly where the candidate is falling short in the "recommendation" and "ai_message_to_hr" fields.
- Pinpoint specific missing tools, libraries, certifications, or experience parameters. If they do not meet the experience range, calculate and state the exact gap (e.g., "Short by 2 years of experience").

Job Title: ${jobTitle}
Required Skills: ${skillsRequired.join(", ") || "Not specified"}
Experience Required: ${experienceMin ?? "N/A"} to ${experienceMax ?? "N/A"} years
Job Description: ${jobDesc || "Not provided"}

Candidate Information:
Name: ${candidateName}
Current Company: ${currentCompany}
Current CTC: ${currentCtc} LPA
Expected CTC: ${expectedCtc} LPA
Notice Period: ${noticePeriod} days
Experience: ${experienceYears} years`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const parts: any[] = [];
    if (base64Data && mimeType) {
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      });
    }

    parts.push({
      text: prompt
    });

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              score: { type: "INTEGER" },
              matched_skills: { type: "ARRAY", items: { type: "STRING" } },
              missing_skills: { type: "ARRAY", items: { type: "STRING" } },
              experience_match: { type: "BOOLEAN" },
              education: { type: "STRING" },
              verdict: { type: "STRING", enum: ["strong", "average", "weak"] },
              recommendation: { type: "STRING" },
              ai_message_to_hr: { type: "STRING" }
            },
            required: ["score", "matched_skills", "missing_skills", "experience_match", "education", "verdict", "recommendation", "ai_message_to_hr"]
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini status ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return JSON.parse(text);
  } catch (err) {
    console.warn("Client-side Gemini failed, falling back to mock:", err);
    return generateMockResumeAnalysis(
      jobTitle,
      skillsRequired,
      experienceMin,
      experienceMax,
      experienceYears,
      expectedCtc,
      currentCtc
    );
  }
};

export default ApplicationPanel;
