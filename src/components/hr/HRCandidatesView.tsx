import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, XCircle, BookOpen, Eye, Loader2, Video, Play, Code2, Filter, CheckCheck, Users } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Application {
  id: string;
  candidate_id: string;
  job_id: string;
  status: string;
  current_stage: string;
  resume_score: number | null;
  resume_url: string | null;
  photo_url: string | null;
  ai_analysis: any;
  video_url: string | null;
  video_score: number | null;
  video_analysis: any;
  experience_years: number;
  current_company: string;
  current_ctc: number;
  expected_ctc: number;
  notice_period: number;
  applied_at: string;
  test_score: number | null;
  technical_score: number | null;
  code_answers: any;
}

interface Props {
  companyId: string;
}

const stageFlow = ["applied", "ai_scored", "shortlisted", "aptitude_test", "test_completed", "video_intro", "video_submitted", "technical_round", "technical_test", "technical_completed", "group_discussion", "gd_completed", "hr_interview", "interview", "offer_sent", "hired", "bgv", "onboarded", "selected", "rejected"];

const stageLabel: Record<string, string> = {
  applied: "Applied",
  ai_scored: "AI Scored",
  shortlisted: "Shortlisted",
  aptitude_test: "Aptitude Test",
  test_completed: "Test Done",
  video_intro: "Video Intro",
  video_submitted: "Video Done",
  technical_round: "Technical Round",
  technical_test: "Technical Test",
  technical_completed: "Technical Done",
  group_discussion: "Group Discussion",
  gd_completed: "GD Completed",
  hr_interview: "HR Interview",
  interview: "HR Interview",
  offer_sent: "Offer Sent",
  hired: "Hired",
  bgv: "BGV Pending",
  onboarded: "Onboarded",
  selected: "Selected",
  rejected: "Rejected",
};

const stageBadgeClass: Record<string, string> = {
  applied: "bg-muted text-muted-foreground",
  ai_scored: "bg-blue-500/10 text-blue-500",
  shortlisted: "bg-amber-500/10 text-amber-500",
  aptitude_test: "bg-purple-500/10 text-purple-500",
  test_completed: "bg-primary/10 text-primary",
  video_intro: "bg-pink-500/10 text-pink-500",
  video_submitted: "bg-emerald-500/10 text-emerald-500",
  technical_round: "bg-orange-500/10 text-orange-500",
  technical_test: "bg-orange-500/10 text-orange-500",
  technical_completed: "bg-teal-500/10 text-teal-500",
  group_discussion: "bg-cyan-500/10 text-cyan-500",
  gd_completed: "bg-cyan-500/10 text-cyan-500",
  hr_interview: "bg-indigo-500/10 text-indigo-500",
  interview: "bg-indigo-500/10 text-indigo-500",
  offer_sent: "bg-emerald-500/10 text-emerald-500",
  hired: "bg-primary/10 text-primary",
  bgv: "bg-amber-500/10 text-amber-500",
  onboarded: "bg-primary/10 text-primary",
  selected: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
};

const HRCandidatesView = ({ companyId }: Props) => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<(Application & { candidate_name: string; candidate_email: string; job_title: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [testResultDialog, setTestResultDialog] = useState<any>(null);
  const [testAnswers, setTestAnswers] = useState<any[]>([]);
  const [testViolations, setTestViolations] = useState<any[]>([]);
  const [testQuestions, setTestQuestions] = useState<any[]>([]);
  const [testSections, setTestSections] = useState<any[]>([]);
  const [candidatePhotoUrl, setCandidatePhotoUrl] = useState<string | null>(null);
  const [generatingTestFor, setGeneratingTestFor] = useState<string | null>(null);
  const [generatingTechnicalFor, setGeneratingTechnicalFor] = useState<string | null>(null);
  const [videoDialog, setVideoDialog] = useState<any>(null);
  const [videoSignedUrl, setVideoSignedUrl] = useState<string | null>(null);
  const [analyzingVideo, setAnalyzingVideo] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>("hr");
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [cutoffDialogOpen, setCutoffDialogOpen] = useState(false);
  const [cutoffScore, setCutoffScore] = useState(60);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [technicalReportDialog, setTechnicalReportDialog] = useState<any>(null);
  const [technicalAssessment, setTechnicalAssessment] = useState<any>(null);
  const { toast } = useToast();

  // Detect current user role and name
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from("users").select("role, full_name").eq("user_id", session.user.id).maybeSingle();
      if (data) {
        setCurrentUserRole(data.role);
        setCurrentUserName(data.full_name);
      }
    })();
  }, []);

  // Notify HR users when a manager takes an action
  const notifyHROfManagerAction = async (title: string, message: string) => {
    if (currentUserRole !== "manager") return;
    // Get all HR users in this company
    const { data: hrUsers } = await supabase
      .from("users")
      .select("id")
      .eq("role", "hr")
      .eq("company_id", companyId);
    if (!hrUsers) return;
    const inserts = hrUsers.map((hr) => ({
      user_id: hr.id,
      title,
      message,
    }));
    if (inserts.length > 0) {
      await supabase.from("notifications").insert(inserts);
    }
  };


  const fetchApplications = async () => {
    setLoading(true);

    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, title")
      .eq("company_id", companyId);

    if (!jobs || jobs.length === 0) {
      setApplications([]);
      setLoading(false);
      return;
    }

    const jobIds = jobs.map((j) => j.id);
    const jobMap = Object.fromEntries(jobs.map((j) => [j.id, j.title]));

    const { data: apps } = await supabase
      .from("applications")
      .select("*")
      .in("job_id", jobIds)
      .order("applied_at", { ascending: false });

    if (!apps || apps.length === 0) {
      setApplications([]);
      setLoading(false);
      return;
    }

    const candidateIds = [...new Set(apps.map((a) => a.candidate_id))];
    const { data: candidates } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("id", candidateIds);

    const candidateMap = Object.fromEntries(
      (candidates || []).map((c) => [c.id, { name: c.full_name, email: c.email }])
    );

    const enriched = apps.map((a) => ({
      ...a,
      candidate_name: candidateMap[a.candidate_id]?.name || "Unknown",
      candidate_email: candidateMap[a.candidate_id]?.email || "",
      job_title: jobMap[a.job_id] || "Unknown Job",
    }));

    setApplications(enriched as any);
    setLoading(false);
  };

  useEffect(() => {
    if (companyId) fetchApplications();
  }, [companyId]);

  const handleViewResume = async (url: string | null) => {
    if (!url) {
      toast({ title: "No Resume", description: "This candidate did not upload a resume." });
      return;
    }

    let storagePath = url;

    // If it's a full Supabase URL, extract the storage path
    if (url.startsWith("http")) {
      const marker = "/object/public/resumes/";
      const markerAlt = "/object/sign/resumes/";
      let idx = url.indexOf(marker);
      if (idx !== -1) {
        storagePath = decodeURIComponent(url.substring(idx + marker.length));
      } else {
        idx = url.indexOf(markerAlt);
        if (idx !== -1) {
          storagePath = decodeURIComponent(url.substring(idx + markerAlt.length));
        }
      }
    }

    const { data, error } = await supabase.storage.from("resumes").createSignedUrl(storagePath, 3600);
    if (data?.signedUrl) {
      setResumeUrl(data.signedUrl);
      setResumeDialogOpen(true);
    } else {
      console.error("Signed URL error:", error, "path:", storagePath);
      toast({ title: "Error", description: "Could not load resume. The file may not exist.", variant: "destructive" });
    }
  };

  const handleUpdateStage = async (appId: string, newStage: string) => {
    const { error } = await supabase
      .from("applications")
      .update({ current_stage: newStage, status: newStage === "rejected" ? "rejected" : "active" })
      .eq("id", appId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const appData = applications.find((a) => a.id === appId);
    toast({ title: "Updated", description: `Candidate moved to ${stageLabel[newStage]}.` });
    await notifyHROfManagerAction(
      "Manager Action",
      `${currentUserName} moved ${appData?.candidate_name || "a candidate"} to ${stageLabel[newStage] || newStage}.`
    );
    fetchApplications();
  };

  const handleOpenAptitudeTest = async (app: Application & { candidate_name: string; job_title: string }) => {
    setGeneratingTestFor(app.id);
    toast({
      title: "🤖 Generating Questions...",
      description: "AI is creating 40 aptitude questions for this role. Please wait.",
    });

    try {
      // Get HR user id
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: hrUser } = await supabase
        .from("users")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const { data, error } = await supabase.functions.invoke("generate-assessment", {
        body: {
          jobId: app.job_id,
          applicationId: app.id,
          companyId,
          createdBy: hrUser?.id,
        },
      });

      if (error) throw error;

      if (data?.assessmentId) {
        toast({
          title: "🤖 AI has created 40 aptitude questions!",
          description: "Please review before sending to candidate. Nothing sent yet.",
        });
        await notifyHROfManagerAction(
          "📝 Questions Generated",
          `${currentUserName} generated aptitude questions for ${app.candidate_name} (${app.job_title}).`
        );
        navigate(`/review-assessment/${data.assessmentId}`);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to generate questions", variant: "destructive" });
    }
    setGeneratingTestFor(null);
  };

  const handleViewTestResults = async (app: any) => {
    setTestResultDialog(app);
    setTestQuestions([]);
    setTestSections([]);
    setCandidatePhotoUrl(null);

    // Fetch answers, violations, assessment questions, and photo in parallel
    const [answersRes, violsRes, assessmentRes] = await Promise.all([
      supabase.from("test_answers").select("*").eq("application_id", app.id).order("question_index", { ascending: true }),
      supabase.from("test_violations").select("*").eq("application_id", app.id).order("created_at", { ascending: true }),
      supabase.from("assessments").select("questions").eq("application_id", app.id).maybeSingle(),
    ]);

    setTestAnswers(answersRes.data || []);
    setTestViolations(violsRes.data || []);

    // Parse assessment questions into flat list with section info
    if (assessmentRes.data?.questions) {
      const q = assessmentRes.data.questions as any;
      if (q.sections) {
        setTestSections(q.sections);
        const flat: any[] = [];
        q.sections.forEach((sec: any) => {
          sec.questions.forEach((question: any) => {
            flat.push({ ...question, section: sec.name });
          });
        });
        setTestQuestions(flat);
      }
    }

    // Get candidate photo
    if (app.photo_url) {
      if (app.photo_url.startsWith("http")) {
        setCandidatePhotoUrl(app.photo_url);
      } else {
        const { data: photoData } = await supabase.storage.from("photos").getPublicUrl(app.photo_url);
        if (photoData?.publicUrl) setCandidatePhotoUrl(photoData.publicUrl);
      }
    }
  };

  const handleOpenVideoIntro = async (app: any) => {
    // Move candidate to video_intro stage and notify
    const { error } = await supabase
      .from("applications")
      .update({ current_stage: "video_intro" })
      .eq("id", app.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Get candidate user record for notification
    const { data: candidateUser } = await supabase
      .from("users")
      .select("id")
      .eq("id", app.candidate_id)
      .maybeSingle();

    if (candidateUser) {
      await supabase.from("notifications").insert({
        user_id: candidateUser.id,
        title: "Aptitude Test Cleared!",
        message: "Congratulations! You have cleared the aptitude test. Next step is Video Introduction. Record a 3 to 4 minute video about: Introduce yourself, Your experience and skills, Your best project, Why you want this role. Login to record your video at /video-intro. Complete within 48 hours.",
      });
    }

    await notifyHROfManagerAction(
      "🎥 Video Round Opened",
      `${currentUserName} opened video introduction for ${app.candidate_name || "a candidate"}.`
    );
    toast({ title: "✅ Video Round Opened", description: `Candidate has been notified to record their video introduction.` });
    fetchApplications();
  };

  const pollForAnalysis = async (appId: string) => {
    for (let i = 0; i < 30; i++) { // poll for up to 60 seconds
      await new Promise((r) => setTimeout(r, 2000));
      const { data: updated } = await supabase
        .from("applications")
        .select("video_score, video_analysis")
        .eq("id", appId)
        .maybeSingle();

      if (updated?.video_analysis) {
        const va = updated.video_analysis as any;
        if (va.status === "processing") continue;
        if (va.status === "failed") {
          toast({ title: "Video Analysis Failed", description: va.error || "Please retry.", variant: "destructive" });
          setAnalyzingVideo(false);
          return;
        }
        // Analysis complete
        setVideoDialog((prev: any) => prev ? { ...prev, video_analysis: updated.video_analysis, video_score: updated.video_score } : prev);
        toast({ title: "✅ Analysis Complete", description: `Overall Score: ${updated.video_score}/100` });
        setAnalyzingVideo(false);
        fetchApplications();
        return;
      }
    }
    setAnalyzingVideo(false);
    toast({ title: "Timeout", description: "Analysis is taking longer than expected. Please check back later." });
  };

  const handleViewVideo = async (app: any) => {
    setVideoDialog(app);
    setVideoSignedUrl(null);
    setAnalyzingVideo(false);
    if (app.video_url) {
      const { data } = await supabase.storage.from("videos").createSignedUrl(app.video_url, 3600);
      if (data?.signedUrl) setVideoSignedUrl(data.signedUrl);
    }
    // Auto-trigger AI analysis if not already done (skip if already analyzed or processing)
    const va = app.video_analysis as any;
    if (app.video_url && (!va || va.status === "failed")) {
      setAnalyzingVideo(true);
      try {
        const { error } = await supabase.functions.invoke("analyze-video", {
          body: { applicationId: app.id },
        });
        if (error) throw error;
        // Poll for results
        pollForAnalysis(app.id);
      } catch (e: any) {
        console.error("Video analysis error:", e);
        toast({ title: "Video Analysis", description: "AI analysis failed. You can retry later.", variant: "destructive" });
        setAnalyzingVideo(false);
      }
    } else if (va?.status === "processing") {
      setAnalyzingVideo(true);
      pollForAnalysis(app.id);
    }
  };

  const handleRetryVideoAnalysis = async () => {
    if (!videoDialog) return;
    setAnalyzingVideo(true);
    try {
      const { error } = await supabase.functions.invoke("analyze-video", {
        body: { applicationId: videoDialog.id },
      });
      if (error) throw error;
      pollForAnalysis(videoDialog.id);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Analysis failed", variant: "destructive" });
      setAnalyzingVideo(false);
    }
  };

  const handleOpenTechnicalRound = async (app: Application & { candidate_name: string; job_title: string }) => {
    setGeneratingTechnicalFor(app.id);
    toast({
      title: "🤖 Generating Technical Questions...",
      description: "AI is creating DSA, coding, and MCQ questions based on the candidate's resume. Please wait.",
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: currentUser } = await supabase
        .from("users")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const { data, error } = await supabase.functions.invoke("generate-technical", {
        body: {
          jobId: app.job_id,
          applicationId: app.id,
          companyId,
          createdBy: currentUser?.id,
        },
      });

      if (error) throw error;

      if (data?.assessmentId) {
        // Update stage to technical_round (pending approval)
        await supabase.from("applications").update({ current_stage: "technical_round" }).eq("id", app.id);
        toast({
          title: "🤖 Technical questions generated!",
          description: "Both HR and Manager must review and approve before sending to candidate.",
        });
        await notifyHROfManagerAction(
          "💻 Technical Round Opened",
          `${currentUserName} opened technical round for ${app.candidate_name} (${app.job_title}).`
        );
        navigate(`/review-technical/${data.assessmentId}`);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to generate technical questions", variant: "destructive" });
    }
    setGeneratingTechnicalFor(null);
  };

  const [techViolations, setTechViolations] = useState<any[]>([]);

  const handleViewTechReport = async (app: any) => {
    setTechnicalReportDialog(app);
    setTechnicalAssessment(null);
    setTechViolations([]);
    // Fetch assessment questions and violations in parallel
    const [assessmentRes, violationsRes] = await Promise.all([
      supabase.from("assessments").select("questions").eq("application_id", app.id).eq("type", "technical").maybeSingle(),
      supabase.from("test_violations").select("*").eq("application_id", app.id).order("created_at", { ascending: true }),
    ]);
    setTechnicalAssessment(assessmentRes.data?.questions || null);
    setTechViolations(violationsRes.data || []);
  };

  const getVerdict = (analysis: any): string => {
    if (!analysis) return "—";
    if (typeof analysis === "object" && analysis.verdict) return analysis.verdict;
    return "—";
  };

  const getNextStage = (current: string): string | null => {
    const idx = stageFlow.indexOf(current);
    if (idx === -1 || idx >= stageFlow.length - 2) return null;
    const next = stageFlow[idx + 1];
    // These stages are handled by specific buttons, not generic "next"
    if (["aptitude_test", "test_completed", "video_intro", "video_submitted", "technical_round", "technical_test", "technical_completed", "group_discussion", "gd_completed", "hr_interview", "interview", "offer_sent", "hired", "bgv", "onboarded"].includes(next)) return null;
    return next;
  };

  // Candidates eligible for cutoff auto-approve (test_completed with scores)
  const testCompletedApps = applications.filter(
    (a) => a.current_stage === "test_completed" && a.test_score !== null
  );
  const qualifyingApps = testCompletedApps.filter((a) => (a.test_score ?? 0) >= cutoffScore);

  const handleBulkApprove = async () => {
    if (qualifyingApps.length === 0) return;
    setBulkApproving(true);

    try {
      // Bulk update all qualifying candidates to video_intro
      for (const app of qualifyingApps) {
        await supabase
          .from("applications")
          .update({ current_stage: "video_intro" })
          .eq("id", app.id);

        // Send notification to each candidate
        const { data: candidateUser } = await supabase
          .from("users")
          .select("id")
          .eq("id", app.candidate_id)
          .maybeSingle();

        if (candidateUser) {
          await supabase.from("notifications").insert({
            user_id: candidateUser.id,
            title: "🎉 Aptitude Test Cleared!",
            message: `Congratulations! You scored ${app.test_score}% and cleared the aptitude test. Next step: Video Introduction. Login to record your video.`,
          });
        }
      }

      await notifyHROfManagerAction(
        "📊 Bulk Cutoff Approval",
        `${currentUserName} auto-approved ${qualifyingApps.length} candidates with aptitude score ≥ ${cutoffScore}% for Video Introduction.`
      );

      toast({
        title: `✅ ${qualifyingApps.length} candidates approved!`,
        description: `All candidates scoring ≥ ${cutoffScore}% moved to Video Introduction.`,
      });

      setCutoffDialogOpen(false);
      fetchApplications();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setBulkApproving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading candidates...</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="rounded-xl border border-border bg-card">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-foreground">All Candidates ({applications.length})</h2>
          {testCompletedApps.length > 0 && currentUserRole === "manager" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCutoffDialogOpen(true)}
              className="gap-2 text-xs"
            >
              <Filter className="h-3.5 w-3.5" />
              Auto-Approve by Cutoff ({testCompletedApps.length} pending)
            </Button>
          )}
        </div>

        {applications.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No candidates have applied yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Candidate</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Exp</TableHead>
                  <TableHead>CTC</TableHead>
                  <TableHead>Notice</TableHead>
                  <TableHead>AI Score</TableHead>
                  <TableHead>Verdict</TableHead>
                  <TableHead>Test Score</TableHead>
                  <TableHead>Tech Score</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Resume</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => {
                  const nextStage = getNextStage(app.current_stage);
                  const canOpenTest = ["ai_scored", "shortlisted"].includes(app.current_stage);
                  const canViewResults = app.current_stage === "test_completed" || app.test_score !== null;
                  const canOpenVideo = app.current_stage === "test_completed";
                  const canViewVideo = (app as any).video_url || app.current_stage === "video_submitted";
                  const canOpenTechnical = app.current_stage === "video_submitted";
                  const canViewTechReport = app.technical_score !== null || app.current_stage === "technical_completed";
                  const canMoveToGD = app.current_stage === "technical_completed";
                  const canScheduleInterview = app.current_stage === "gd_completed" || app.current_stage === "interview" || app.current_stage === "hr_interview";

                  return (
                    <TableRow key={app.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {app.photo_url && (
                            <img
                              src={app.photo_url.startsWith("http") ? app.photo_url : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/photos/${app.photo_url}`}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover border border-border shrink-0"
                            />
                          )}
                          <div>
                            <p className="font-medium text-foreground">{app.candidate_name}</p>
                            <p className="text-xs text-muted-foreground">{app.candidate_email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{app.job_title}</TableCell>
                      <TableCell>{app.experience_years}y</TableCell>
                      <TableCell>₹{app.current_ctc.toLocaleString()}</TableCell>
                      <TableCell>{app.notice_period}d</TableCell>
                      <TableCell>
                        {app.resume_score !== null ? (
                          <span className={`font-bold ${app.resume_score >= 70 ? "text-primary" : app.resume_score >= 50 ? "text-amber-500" : "text-destructive"}`}>
                            {app.resume_score}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="capitalize text-sm">{getVerdict(app.ai_analysis)}</TableCell>
                      <TableCell>
                        {app.test_score !== null ? (
                          <span className={`font-bold ${app.test_score >= 70 ? "text-primary" : app.test_score >= 50 ? "text-amber-500" : "text-destructive"}`}>
                            {app.test_score}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {app.technical_score !== null ? (
                          <span className={`font-bold ${app.technical_score >= 70 ? "text-primary" : app.technical_score >= 50 ? "text-amber-500" : "text-destructive"}`}>
                            {app.technical_score}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${stageBadgeClass[app.current_stage] || "bg-muted text-muted-foreground"}`}>
                          {stageLabel[app.current_stage] || app.current_stage}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleViewResume(app.resume_url)} className="text-muted-foreground hover:text-foreground gap-1">
                          <FileText className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          {canOpenTest && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenAptitudeTest(app)}
                              disabled={generatingTestFor === app.id}
                              className="text-purple-500 hover:text-purple-600 gap-1 text-xs"
                              title="Open Aptitude Test"
                            >
                              {generatingTestFor === app.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <BookOpen className="h-3.5 w-3.5" />
                              )}
                              {generatingTestFor === app.id ? "Generating..." : "Open Test"}
                            </Button>
                          )}
                          {canViewResults && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewTestResults(app)}
                              className="text-primary hover:text-primary gap-1 text-xs"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Results
                            </Button>
                          )}
                          {canOpenVideo && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenVideoIntro(app)}
                              className="text-pink-500 hover:text-pink-600 gap-1 text-xs"
                            >
                              <Video className="h-3.5 w-3.5" />
                              Open Video
                            </Button>
                          )}
                          {canViewVideo && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewVideo(app)}
                              className="text-emerald-500 hover:text-emerald-600 gap-1 text-xs"
                            >
                              <Play className="h-3.5 w-3.5" />
                              Watch
                            </Button>
                          )}
                          {canOpenTechnical && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenTechnicalRound(app)}
                              disabled={generatingTechnicalFor === app.id}
                              className="text-orange-500 hover:text-orange-600 gap-1 text-xs"
                              title="Open Technical Round"
                            >
                              {generatingTechnicalFor === app.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Code2 className="h-3.5 w-3.5" />
                              )}
                              {generatingTechnicalFor === app.id ? "Generating..." : "Technical"}
                            </Button>
                          )}
                          {canViewTechReport && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewTechReport(app)}
                              className="text-teal-500 hover:text-teal-600 gap-1 text-xs"
                              title="View Technical Report"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Tech Report
                            </Button>
                          )}
                          {canMoveToGD && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUpdateStage(app.id, "group_discussion")}
                              className="text-cyan-500 hover:text-cyan-600 gap-1 text-xs"
                              title="Move to Group Discussion"
                            >
                              <Users className="h-3.5 w-3.5" />
                              Move to GD
                            </Button>
                          )}
                          {nextStage && app.current_stage !== "rejected" && app.current_stage !== "selected" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUpdateStage(app.id, nextStage)}
                              className="text-primary hover:text-primary gap-1 text-xs"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                              {stageLabel[nextStage]}
                            </Button>
                          )}
                          {app.current_stage !== "rejected" && app.current_stage !== "selected" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Soft remove: just hide from active list
                                setApplications((prev) => prev.filter((a) => a.id !== app.id));
                                toast({ title: "Removed", description: `${app.candidate_name} removed from the list.` });
                              }}
                              className="text-destructive hover:text-destructive text-xs"
                              title="Remove from list"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Resume Viewer Dialog */}
      <Dialog open={resumeDialogOpen} onOpenChange={setResumeDialogOpen}>
        <DialogContent className="max-w-4xl h-[85vh]">
          <DialogHeader>
            <DialogTitle>Resume</DialogTitle>
          </DialogHeader>
          {resumeUrl && (() => {
            const lower = resumeUrl.toLowerCase();
            const isImage = ['.jpg', '.jpeg', '.png', '.webp'].some(ext => lower.includes(ext));
            const isPdf = lower.includes('.pdf');

            if (isImage) {
              return (
                <div className="w-full flex-1 overflow-auto rounded-lg border border-border" style={{ height: "calc(85vh - 80px)" }}>
                  <img src={resumeUrl} alt="Resume" className="w-full h-auto object-contain" />
                </div>
              );
            }

            const viewerUrl = isPdf
              ? resumeUrl
              : `https://docs.google.com/gview?url=${encodeURIComponent(resumeUrl)}&embedded=true`;
            return (
              <iframe 
                src={viewerUrl} 
                className="w-full flex-1 rounded-lg border border-border" 
                style={{ height: "calc(85vh - 80px)" }}
                title="Resume Viewer"
              />
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Test Results Dialog */}
      <Dialog open={!!testResultDialog} onOpenChange={() => setTestResultDialog(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Test Results — {testResultDialog?.candidate_name}</DialogTitle>
          </DialogHeader>
          {testResultDialog && (
            <div className="space-y-6">
              {/* Candidate Info + Photo */}
              <div className="flex items-start gap-4">
                {candidatePhotoUrl && (
                  <div className="shrink-0">
                    <img
                      src={candidatePhotoUrl}
                      alt={testResultDialog.candidate_name}
                      className="h-20 w-20 rounded-xl object-cover border-2 border-border"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-lg font-bold text-foreground">{testResultDialog.candidate_name}</p>
                  <p className="text-sm text-muted-foreground">{testResultDialog.candidate_email}</p>
                  <p className="text-sm text-muted-foreground">Job: {testResultDialog.job_title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Exp: {testResultDialog.experience_years}y • Company: {testResultDialog.current_company}
                  </p>
                </div>
              </div>

              {/* Score Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{testResultDialog.test_score ?? "—"}/100</p>
                  <p className="text-xs text-muted-foreground">Score</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {testAnswers.filter(a => a.selected_option !== null).length}/{testQuestions.length || 40}
                  </p>
                  <p className="text-xs text-muted-foreground">Answered</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {testAnswers.length > 0 ? Math.round(testAnswers.reduce((s, a) => s + (a.time_spent_seconds || 0), 0) / 60) : 0}m
                  </p>
                  <p className="text-xs text-muted-foreground">Total Time</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                  <p className={`text-2xl font-bold ${testViolations.length > 0 ? "text-destructive" : "text-primary"}`}>
                    {testViolations.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Violations</p>
                </div>
              </div>

              {/* Section-wise Performance */}
              {testSections.length > 0 && testQuestions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">📊 Section-wise Performance</h3>
                  <div className="space-y-2">
                    {(() => {
                      let globalIdx = 0;
                      return testSections.map((sec: any, sIdx: number) => {
                        const sectionQuestions = sec.questions || [];
                        const startIdx = globalIdx;
                        globalIdx += sectionQuestions.length;
                        
                        let correct = 0;
                        let attempted = 0;
                        sectionQuestions.forEach((q: any, qIdx: number) => {
                          const answer = testAnswers.find(a => a.question_index === startIdx + qIdx);
                          if (answer && answer.selected_option !== null) {
                            attempted++;
                            const correctIdx = q.correct_answer ? q.correct_answer.charCodeAt(0) - 65 : -1;
                            if (answer.selected_option === correctIdx) correct++;
                          }
                        });
                        const pct = sectionQuestions.length > 0 ? Math.round((correct / sectionQuestions.length) * 100) : 0;

                        return (
                          <div key={sIdx} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">{sec.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {correct}/{sectionQuestions.length} correct • {attempted} attempted
                              </p>
                            </div>
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct >= 70 ? "bg-primary" : pct >= 40 ? "bg-amber-500" : "bg-destructive"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-sm font-bold min-w-[40px] text-right ${pct >= 70 ? "text-primary" : pct >= 40 ? "text-amber-500" : "text-destructive"}`}>
                              {pct}%
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* Violations */}
              {testViolations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">⚠️ Violations ({testViolations.length})</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {testViolations.map((v: any) => (
                      <div key={v.id} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                        <span className="text-destructive text-xs font-medium uppercase shrink-0">{v.violation_type}</span>
                        <span className="text-muted-foreground">—</span>
                        <span className="text-foreground flex-1">{v.description}</span>
                        {v.question_number !== null && (
                          <span className="text-xs text-muted-foreground shrink-0">Q{v.question_number}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(v.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Question-by-Question Breakdown */}
              {testQuestions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">📝 Question-by-Question Breakdown</h3>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {testQuestions.map((q: any, idx: number) => {
                      const answer = testAnswers.find(a => a.question_index === idx);
                      const selectedOption = answer?.selected_option;
                      const correctIdx = q.correct_answer ? q.correct_answer.charCodeAt(0) - 65 : -1;
                      const isCorrect = selectedOption === correctIdx;
                      const isUnanswered = selectedOption === null || selectedOption === undefined;
                      const timeSpent = answer?.time_spent_seconds ?? 0;

                      return (
                        <div key={idx} className={`p-3 rounded-lg border ${isUnanswered ? "border-muted bg-muted/30" : isCorrect ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isUnanswered ? "bg-muted text-muted-foreground" : isCorrect ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                                Q{idx + 1}
                              </span>
                              <span className="text-[10px] text-muted-foreground">{q.section}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${q.difficulty === "easy" ? "bg-primary/10 text-primary" : q.difficulty === "hard" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-500"}`}>
                                {q.difficulty}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                              <span>⏱ {timeSpent}s</span>
                              {isUnanswered ? (
                                <span className="text-muted-foreground font-medium">Skipped</span>
                              ) : isCorrect ? (
                                <span className="text-primary font-medium">✓ Correct</span>
                              ) : (
                                <span className="text-destructive font-medium">✗ Wrong</span>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-foreground mb-2">{q.question}</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {q.options?.map((opt: string, oIdx: number) => {
                              const isSelected = selectedOption === oIdx;
                              const isCorrectOpt = oIdx === correctIdx;
                              let optClass = "border-border text-muted-foreground";
                              if (isCorrectOpt) optClass = "border-primary bg-primary/10 text-primary";
                              if (isSelected && !isCorrect) optClass = "border-destructive bg-destructive/10 text-destructive";
                              if (isSelected && isCorrect) optClass = "border-primary bg-primary/10 text-primary";

                              return (
                                <div key={oIdx} className={`text-xs px-2 py-1.5 rounded border ${optClass}`}>
                                  <span className="font-bold mr-1">{String.fromCharCode(65 + oIdx)}.</span>
                                  {opt}
                                  {isSelected && <span className="ml-1">👈</span>}
                                  {isCorrectOpt && !isSelected && <span className="ml-1">✓</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Time per question heatmap */}
              {testAnswers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">⏱ Time per Question (seconds)</h3>
                  <div className="grid grid-cols-10 gap-1">
                    {testAnswers.map((a: any) => (
                      <div
                        key={a.question_index}
                        className={`text-center p-1.5 rounded text-xs font-medium ${
                          a.time_spent_seconds < 3
                            ? "bg-destructive/10 text-destructive"
                            : a.time_spent_seconds > 120
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-muted text-muted-foreground"
                        }`}
                        title={`Q${a.question_index + 1}: ${a.time_spent_seconds}s`}
                      >
                        {a.time_spent_seconds}s
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    🔴 Under 3s (suspicious) • 🟡 Over 2min • ⚪ Normal
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    handleUpdateStage(testResultDialog.id, "interview");
                    setTestResultDialog(null);
                  }}
                  className="bg-primary text-primary-foreground"
                >
                  ✅ Move to Interview
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    handleUpdateStage(testResultDialog.id, "rejected");
                    setTestResultDialog(null);
                  }}
                  className="text-destructive border-destructive/30"
                >
                  ❌ Reject Candidate
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Video Viewer Dialog */}
      <Dialog open={!!videoDialog} onOpenChange={() => setVideoDialog(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Video Introduction — {videoDialog?.candidate_name}</DialogTitle>
          </DialogHeader>
          {videoDialog && (
            <div className="space-y-4">
              {videoSignedUrl ? (
                <video
                  src={videoSignedUrl}
                  controls
                  className="w-full rounded-lg border border-border aspect-video bg-black"
                />
              ) : (
                <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">Loading video...</p>
                </div>
              )}

              {videoSignedUrl && (
                <a
                  href={videoSignedUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  ⬇️ Download Video
                </a>
              )}

              {/* AI Video Analysis */}
              {analyzingVideo && (
                <div className="rounded-xl border border-border bg-card p-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-sm font-semibold text-foreground">🤖 AI is analyzing the video...</p>
                  <p className="text-xs text-muted-foreground mt-1">Evaluating expression, energy, eye contact, fluency, vocabulary and more</p>
                </div>
              )}

              {videoDialog.video_analysis && !analyzingVideo && videoDialog.video_analysis.status !== "processing" && videoDialog.video_analysis.status !== "failed" && (() => {
                const va = videoDialog.video_analysis;
                const metrics = [
                  { key: "energy_level", label: "⚡ Energy Level", icon: "⚡" },
                  { key: "eye_contact", label: "👁️ Eye Contact", icon: "👁️" },
                  { key: "english_fluency", label: "🗣️ English Fluency", icon: "🗣️" },
                  { key: "vocabulary", label: "📚 Vocabulary", icon: "📚" },
                  { key: "communication_skills", label: "💬 Communication", icon: "💬" },
                  { key: "confidence", label: "💪 Confidence", icon: "💪" },
                  { key: "body_language", label: "🧍 Body Language", icon: "🧍" },
                  { key: "content_quality", label: "📝 Content Quality", icon: "📝" },
                  { key: "professionalism", label: "👔 Professionalism", icon: "👔" },
                  { key: "overall_impression", label: "⭐ Overall Impression", icon: "⭐" },
                ];

                const verdictColors: Record<string, string> = {
                  strong: "bg-primary/10 text-primary border-primary/30",
                  average: "bg-amber-500/10 text-amber-500 border-amber-500/30",
                  weak: "bg-destructive/10 text-destructive border-destructive/30",
                };

                return (
                  <div className="space-y-4">
                    {/* Overall Score Header */}
                    <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">AI Video Score</p>
                        <p className="text-3xl font-bold text-foreground">{va.overall_score}<span className="text-lg text-muted-foreground">/100</span></p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${verdictColors[va.verdict] || verdictColors.average}`}>
                        {va.verdict?.toUpperCase()}
                      </span>
                    </div>

                    {/* Summary */}
                    {va.summary && (
                      <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-sm font-semibold text-foreground mb-1">📋 AI Summary</p>
                        <p className="text-sm text-muted-foreground">{va.summary}</p>
                      </div>
                    )}

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {metrics.map(({ key, label }) => {
                        const m = va[key];
                        if (!m) return null;
                        const score = m.score ?? 0;
                        const barColor = score >= 7 ? "bg-primary" : score >= 5 ? "bg-amber-500" : "bg-destructive";
                        return (
                          <div key={key} className="rounded-lg border border-border bg-card/60 p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-foreground">{label}</span>
                              <span className="text-sm font-bold text-foreground">{score}/10</span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score * 10}%` }} />
                            </div>
                            <p className="text-xs text-muted-foreground">{m.feedback}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Strengths & Improvements */}
                    <div className="grid grid-cols-2 gap-3">
                      {va.strengths?.length > 0 && (
                        <div className="rounded-lg border border-border bg-card/60 p-3">
                          <p className="text-xs font-semibold text-primary mb-2">✅ Strengths</p>
                          <ul className="space-y-1">
                            {va.strengths.map((s: string, i: number) => (
                              <li key={i} className="text-xs text-muted-foreground">• {s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {va.improvements?.length > 0 && (
                        <div className="rounded-lg border border-border bg-card/60 p-3">
                          <p className="text-xs font-semibold text-amber-500 mb-2">🔧 Areas to Improve</p>
                          <ul className="space-y-1">
                            {va.improvements.map((s: string, i: number) => (
                              <li key={i} className="text-xs text-muted-foreground">• {s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Retry button */}
                    <Button variant="outline" size="sm" onClick={handleRetryVideoAnalysis} disabled={analyzingVideo}>
                      🔄 Re-analyze Video
                    </Button>
                  </div>
                );
              })()}

              {(!videoDialog.video_analysis || videoDialog.video_analysis?.status === "failed") && !analyzingVideo && (
                <Button variant="outline" onClick={handleRetryVideoAnalysis} disabled={analyzingVideo}>
                  🤖 Analyze with AI
                </Button>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    handleUpdateStage(videoDialog.id, "technical_round");
                    setVideoDialog(null);
                  }}
                  className="bg-primary text-primary-foreground"
                >
                  ✅ Move to Technical Round
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    handleUpdateStage(videoDialog.id, "rejected");
                    setVideoDialog(null);
                  }}
                  className="text-destructive border-destructive/30"
                >
                  ❌ Reject Candidate
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cutoff Score Auto-Approve Dialog */}
      <Dialog open={cutoffDialogOpen} onOpenChange={setCutoffDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              Auto-Approve by Cutoff Score
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Set a minimum aptitude test score. All candidates scoring at or above this cutoff will automatically move to the <strong>Video Introduction</strong> round.
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Cutoff Score</span>
                  <span className="text-2xl font-bold text-primary">{cutoffScore}%</span>
                </div>
                <Slider
                  value={[cutoffScore]}
                  onValueChange={(val) => setCutoffScore(val[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Candidates qualifying</span>
                <span className="text-lg font-bold text-primary">
                  {qualifyingApps.length} / {testCompletedApps.length}
                </span>
              </div>
              {qualifyingApps.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {qualifyingApps.map((app) => (
                    <div key={app.id} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-card">
                      <span className="text-foreground">{app.candidate_name}</span>
                      <span className={`font-bold ${(app.test_score ?? 0) >= 70 ? "text-primary" : "text-amber-500"}`}>
                        {app.test_score}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {qualifyingApps.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No candidates meet this cutoff. Try lowering the score.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setCutoffDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkApprove}
                disabled={qualifyingApps.length === 0 || bulkApproving}
                className="flex-1 gap-2 bg-primary text-primary-foreground"
              >
                {bulkApproving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4" />
                )}
                {bulkApproving ? "Approving..." : `Approve ${qualifyingApps.length} Candidates`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Technical Report Dialog */}
      <Dialog open={!!technicalReportDialog} onOpenChange={() => setTechnicalReportDialog(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>💻 Technical Round Report — {technicalReportDialog?.candidate_name}</DialogTitle>
          </DialogHeader>
          {technicalReportDialog && (() => {
            const codeAnswers = technicalReportDialog.code_answers;
            const report = codeAnswers?.ai_report;
            const dsaAnswers = codeAnswers?.dsa_answers || {};
            const codingAnswers = codeAnswers?.coding_answers || {};
            const mcqAnswers = codeAnswers?.mcq_answers || {};
            const questions = technicalAssessment as any;
            const dsaProblems = questions?.dsa_problems || [];
            const codingTasks = questions?.coding_tasks || [];
            const mcqQuestions = questions?.mcq_questions || [];

            if (!report && !codeAnswers) {
              return (
                <div className="py-8 text-center text-muted-foreground">
                  <p>No technical round data available yet.</p>
                </div>
              );
            }

            return (
              <div className="space-y-6">
                {/* Score Overview */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                    <p className={`text-2xl font-bold ${(report?.overall_score ?? 0) >= 70 ? "text-primary" : (report?.overall_score ?? 0) >= 50 ? "text-amber-500" : "text-destructive"}`}>
                      {report?.overall_score ?? technicalReportDialog.technical_score ?? "—"}/100
                    </p>
                    <p className="text-xs text-muted-foreground">Overall Score</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{report?.dsa_score ?? "—"}/100</p>
                    <p className="text-xs text-muted-foreground">DSA Score</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{report?.coding_score ?? "—"}/100</p>
                    <p className="text-xs text-muted-foreground">Coding Score</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{report?.mcq_score ?? "—"}/100</p>
                    <p className="text-xs text-muted-foreground">MCQ Score</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{report?.mcq_correct ?? "—"}/{report?.mcq_total ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">MCQ Correct</p>
                  </div>
                </div>

                {/* DSA Problems Results */}
                {report?.dsa_results?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">🧩 DSA Problems</h3>
                    <div className="space-y-3">
                      {report.dsa_results.map((r: any, i: number) => {
                        const candidateCode = dsaAnswers[i] || "";
                        return (
                          <div key={i} className={`rounded-lg border p-4 ${r.correctness ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <span className="text-sm font-semibold text-foreground">#{r.problem_number} {r.title}</span>
                                {dsaProblems[i]?.difficulty && (
                                  <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${r.correctness ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                                    {dsaProblems[i].difficulty}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-sm font-bold ${r.score >= 70 ? "text-primary" : r.score >= 40 ? "text-amber-500" : "text-destructive"}`}>
                                  {r.score}/100
                                </span>
                                <span className={`text-xs font-medium ${r.correctness ? "text-primary" : "text-destructive"}`}>
                                  {r.correctness ? "✓ Correct" : "✗ Incorrect"}
                                </span>
                              </div>
                            </div>
                            {dsaProblems[i]?.description && (
                              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{dsaProblems[i].description}</p>
                            )}
                            <div className="flex gap-4 text-xs text-muted-foreground mb-2">
                              <span>⏱ Time: {r.time_complexity || "N/A"}</span>
                              <span>💾 Space: {r.space_complexity || "N/A"}</span>
                              <span>⭐ Code Quality: {r.code_quality}/10</span>
                            </div>
                            {candidateCode && (
                              <details className="mb-2">
                                <summary className="text-xs font-medium text-foreground cursor-pointer hover:text-primary">View Candidate's Code</summary>
                                <pre className="mt-2 p-3 rounded-lg bg-muted text-xs overflow-x-auto max-h-48 overflow-y-auto font-mono text-foreground border border-border">
                                  {candidateCode}
                                </pre>
                              </details>
                            )}
                            {r.feedback && (
                              <div className="mt-2 p-2 rounded bg-muted/50 border border-border">
                                <p className="text-xs font-medium text-foreground mb-1">🤖 AI Feedback:</p>
                                <p className="text-xs text-muted-foreground">{r.feedback}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Coding Tasks Results */}
                {report?.coding_results?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">💻 Coding Tasks</h3>
                    <div className="space-y-3">
                      {report.coding_results.map((r: any, i: number) => {
                        const candidateCode = codingAnswers[i] || "";
                        return (
                          <div key={i} className={`rounded-lg border p-4 ${r.correctness ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <span className="text-sm font-semibold text-foreground">#{r.task_number} {r.title}</span>
                                {codingTasks[i]?.tech_stack && (
                                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                    {codingTasks[i].tech_stack}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-sm font-bold ${r.score >= 70 ? "text-primary" : r.score >= 40 ? "text-amber-500" : "text-destructive"}`}>
                                  {r.score}/100
                                </span>
                                <span className={`text-xs font-medium ${r.correctness ? "text-primary" : "text-destructive"}`}>
                                  {r.correctness ? "✓ Correct" : "✗ Incorrect"}
                                </span>
                              </div>
                            </div>
                            {codingTasks[i]?.description && (
                              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{codingTasks[i].description}</p>
                            )}
                            <div className="flex gap-4 text-xs text-muted-foreground mb-2">
                              <span>⏱ Time: {r.time_complexity || "N/A"}</span>
                              <span>💾 Space: {r.space_complexity || "N/A"}</span>
                              <span>⭐ Code Quality: {r.code_quality}/10</span>
                            </div>
                            {candidateCode && (
                              <details className="mb-2">
                                <summary className="text-xs font-medium text-foreground cursor-pointer hover:text-primary">View Candidate's Code</summary>
                                <pre className="mt-2 p-3 rounded-lg bg-muted text-xs overflow-x-auto max-h-48 overflow-y-auto font-mono text-foreground border border-border">
                                  {candidateCode}
                                </pre>
                              </details>
                            )}
                            {r.feedback && (
                              <div className="mt-2 p-2 rounded bg-muted/50 border border-border">
                                <p className="text-xs font-medium text-foreground mb-1">🤖 AI Feedback:</p>
                                <p className="text-xs text-muted-foreground">{r.feedback}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* MCQ Results */}
                {report?.mcq_details?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">📝 MCQ Questions ({report.mcq_correct}/{report.mcq_total} correct)</h3>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                      {report.mcq_details.map((m: any, i: number) => {
                        const q = mcqQuestions[i];
                        return (
                          <div key={i} className={`p-3 rounded-lg border ${m.correct ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${m.correct ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                                  Q{m.question_number}
                                </span>
                                {q?.topic && <span className="text-[10px] text-muted-foreground">{q.topic}</span>}
                                {q?.difficulty && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${q.difficulty === "easy" ? "bg-primary/10 text-primary" : q.difficulty === "hard" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-500"}`}>
                                    {q.difficulty}
                                  </span>
                                )}
                              </div>
                              <span className={`text-xs font-medium ${m.correct ? "text-primary" : "text-destructive"}`}>
                                {m.correct ? "✓ Correct" : "✗ Wrong"}
                              </span>
                            </div>
                            {q?.question && <p className="text-sm text-foreground mb-2">{q.question}</p>}
                            {q?.options && (
                              <div className="grid grid-cols-2 gap-1.5">
                                {q.options.map((opt: string, oIdx: number) => {
                                  const optLetter = String.fromCharCode(65 + oIdx);
                                  const isSelected = m.selected_option === optLetter;
                                  const isCorrectOpt = m.correct_answer === optLetter;
                                  let optClass = "border-border text-muted-foreground";
                                  if (isCorrectOpt) optClass = "border-primary bg-primary/10 text-primary";
                                  if (isSelected && !m.correct) optClass = "border-destructive bg-destructive/10 text-destructive";
                                  if (isSelected && m.correct) optClass = "border-primary bg-primary/10 text-primary";
                                  return (
                                    <div key={oIdx} className={`text-xs px-2 py-1.5 rounded border ${optClass}`}>
                                      <span className="font-bold mr-1">{optLetter}.</span>
                                      {opt}
                                      {isSelected && <span className="ml-1">👈</span>}
                                      {isCorrectOpt && !isSelected && <span className="ml-1">✓</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Violations during technical test */}
                {techViolations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">⚠️ Proctoring Violations ({techViolations.length})</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {techViolations.map((v: any) => (
                        <div key={v.id} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                          <span className="text-destructive text-xs font-medium uppercase shrink-0">{v.violation_type}</span>
                          <span className="text-muted-foreground">—</span>
                          <span className="text-foreground flex-1">{v.description}</span>
                          {v.question_number !== null && (
                            <span className="text-xs text-muted-foreground shrink-0">Q{v.question_number}</span>
                          )}
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {new Date(v.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => {
                      handleUpdateStage(technicalReportDialog.id, "group_discussion");
                      setTechnicalReportDialog(null);
                    }}
                    className="bg-primary text-primary-foreground"
                  >
                    ✅ Move to Group Discussion
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleUpdateStage(technicalReportDialog.id, "rejected");
                      setTechnicalReportDialog(null);
                    }}
                    className="text-destructive border-destructive/30"
                  >
                    ❌ Reject Candidate
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default HRCandidatesView;
