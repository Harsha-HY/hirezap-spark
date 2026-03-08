import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, XCircle, BookOpen, Eye, Loader2, Video, Play, Code2, Filter, CheckCheck } from "lucide-react";
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
  experience_years: number;
  current_company: string;
  current_ctc: number;
  expected_ctc: number;
  notice_period: number;
  applied_at: string;
  test_score: number | null;
}

interface Props {
  companyId: string;
}

const stageFlow = ["applied", "ai_scored", "shortlisted", "aptitude_test", "test_completed", "video_intro", "video_submitted", "technical_round", "technical_test", "technical_completed", "group_discussion", "interview", "selected", "rejected"];

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
  interview: "HR Interview",
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
  interview: "bg-indigo-500/10 text-indigo-500",
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
  const [currentUserRole, setCurrentUserRole] = useState<string>("hr");
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [cutoffDialogOpen, setCutoffDialogOpen] = useState(false);
  const [cutoffScore, setCutoffScore] = useState(60);
  const [bulkApproving, setBulkApproving] = useState(false);
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

  const handleViewVideo = async (app: any) => {
    setVideoDialog(app);
    setVideoSignedUrl(null);
    if (app.video_url) {
      const { data } = await supabase.storage.from("videos").createSignedUrl(app.video_url, 3600);
      if (data?.signedUrl) setVideoSignedUrl(data.signedUrl);
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
    if (["aptitude_test", "test_completed", "video_intro", "video_submitted", "technical_round", "technical_test"].includes(next)) return null;
    return next;
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
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">All Candidates ({applications.length})</h2>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    handleUpdateStage(videoDialog.id, "interview");
                    setVideoDialog(null);
                  }}
                  className="bg-primary text-primary-foreground"
                >
                  ✅ Move to Interview
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
    </motion.div>
  );
};

export default HRCandidatesView;
