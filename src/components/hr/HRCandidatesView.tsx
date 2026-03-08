import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, XCircle, BookOpen, Eye, Loader2 } from "lucide-react";
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

const stageFlow = ["applied", "ai_scored", "shortlisted", "aptitude_test", "test_completed", "interview", "selected", "rejected"];

const stageLabel: Record<string, string> = {
  applied: "Applied",
  ai_scored: "AI Scored",
  shortlisted: "Shortlisted",
  aptitude_test: "Aptitude Test",
  test_completed: "Test Done",
  interview: "Interview",
  selected: "Selected",
  rejected: "Rejected",
};

const stageBadgeClass: Record<string, string> = {
  applied: "bg-muted text-muted-foreground",
  ai_scored: "bg-blue-500/10 text-blue-500",
  shortlisted: "bg-amber-500/10 text-amber-500",
  aptitude_test: "bg-purple-500/10 text-purple-500",
  test_completed: "bg-primary/10 text-primary",
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
  const [generatingTestFor, setGeneratingTestFor] = useState<string | null>(null);
  const { toast } = useToast();

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

    toast({ title: "Updated", description: `Candidate moved to ${stageLabel[newStage]}.` });
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
        navigate(`/review-assessment/${data.assessmentId}`);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to generate questions", variant: "destructive" });
    }
    setGeneratingTestFor(null);
  };

  const handleViewTestResults = async (app: any) => {
    setTestResultDialog(app);

    const { data: answers } = await supabase
      .from("test_answers")
      .select("*")
      .eq("application_id", app.id)
      .order("question_index", { ascending: true });

    const { data: viols } = await supabase
      .from("test_violations")
      .select("*")
      .eq("application_id", app.id)
      .order("created_at", { ascending: true });

    setTestAnswers(answers || []);
    setTestViolations(viols || []);
  };

  const getVerdict = (analysis: any): string => {
    if (!analysis) return "—";
    if (typeof analysis === "object" && analysis.verdict) return analysis.verdict;
    return "—";
  };

  const getNextStage = (current: string): string | null => {
    const idx = stageFlow.indexOf(current);
    if (idx === -1 || idx >= stageFlow.length - 2) return null;
    // Skip aptitude_test stage in the flow button - use the dedicated button
    const next = stageFlow[idx + 1];
    if (next === "aptitude_test") return null;
    if (next === "test_completed") return null;
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

                  return (
                    <TableRow key={app.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{app.candidate_name}</p>
                          <p className="text-xs text-muted-foreground">{app.candidate_email}</p>
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
                        <div className="flex items-center gap-1">
                          {canOpenTest && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenAptitudeTest(app)}
                              className="text-purple-500 hover:text-purple-600 gap-1 text-xs"
                              title="Open Aptitude Test"
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                              Open Test
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
                              onClick={() => handleUpdateStage(app.id, "rejected")}
                              className="text-destructive hover:text-destructive text-xs"
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
            const isPdf = resumeUrl.toLowerCase().includes('.pdf');
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Test Results — {testResultDialog?.candidate_name}</DialogTitle>
          </DialogHeader>
          {testResultDialog && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{testResultDialog.test_score ?? "—"}/100</p>
                  <p className="text-xs text-muted-foreground">Score</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{testAnswers.filter(a => a.selected_option !== null).length}/40</p>
                  <p className="text-xs text-muted-foreground">Answered</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                  <p className={`text-2xl font-bold ${testViolations.length > 0 ? "text-destructive" : "text-primary"}`}>{testViolations.length}</p>
                  <p className="text-xs text-muted-foreground">Violations</p>
                </div>
              </div>

              {/* Violations */}
              {testViolations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">⚠️ Violations</h3>
                  <div className="space-y-2">
                    {testViolations.map((v: any) => (
                      <div key={v.id} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                        <span className="text-destructive text-xs font-medium uppercase">{v.violation_type}</span>
                        <span className="text-muted-foreground">—</span>
                        <span className="text-foreground">{v.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Time per question */}
              {testAnswers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Time per Question (seconds)</h3>
                  <div className="grid grid-cols-10 gap-1">
                    {testAnswers.map((a: any) => (
                      <div
                        key={a.question_index}
                        className={`text-center p-1.5 rounded text-xs font-medium ${
                          a.time_spent_seconds < 3
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground"
                        }`}
                        title={`Q${a.question_index + 1}: ${a.time_spent_seconds}s`}
                      >
                        {a.time_spent_seconds}s
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
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
    </motion.div>
  );
};

export default HRCandidatesView;
