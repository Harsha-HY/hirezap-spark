import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Pencil, RefreshCw, Trash2, Plus, Loader2, FileUp, CheckCircle2, Clock } from "lucide-react";

interface DSAProblem {
  problem_number: number;
  title: string;
  description: string;
  difficulty: string;
  time_minutes: number;
  expected_approach: string;
  test_cases: string[];
}

interface CodingTask {
  task_number: number;
  title: string;
  description: string;
  difficulty: string;
  time_minutes: number;
  tech_stack: string;
}

interface MCQQuestion {
  question_number: number;
  question: string;
  options: string[];
  correct_answer: string;
  difficulty: string;
  topic: string;
}

const difficultyColors: Record<string, string> = {
  easy: "bg-primary/10 text-primary",
  medium: "bg-amber-500/10 text-amber-500",
  hard: "bg-destructive/10 text-destructive",
};

const ReviewTechnical = () => {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<any>(null);
  const [dsaProblems, setDsaProblems] = useState<DSAProblem[]>([]);
  const [codingTasks, setCodingTasks] = useState<CodingTask[]>([]);
  const [mcqQuestions, setMcqQuestions] = useState<MCQQuestion[]>([]);
  const [jobTitle, setJobTitle] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [userRole, setUserRole] = useState<string>("hr");
  const [userId, setUserId] = useState<string>("");
  const [approving, setApproving] = useState(false);
  const [regeneratingAll, setRegeneratingAll] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Edit dialog
  const [editDialog, setEditDialog] = useState<{ type: string; index: number } | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

  // Add dialog
  const [addDialog, setAddDialog] = useState(false);
  const [addType, setAddType] = useState<string>("mcq");

  // Regenerate reason
  const [regenDialog, setRegenDialog] = useState<{ type: string; index: number } | null>(null);
  const [regenReason, setRegenReason] = useState("");
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);

  useEffect(() => {
    fetchAssessment();
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase.from("users").select("role, id").eq("user_id", session.user.id).maybeSingle();
        if (data) {
          setUserRole(data.role);
          setUserId(data.id);
        }
      }
    })();
  }, [assessmentId]);

  const fetchAssessment = async () => {
    if (!assessmentId) return;
    const { data, error } = await supabase
      .from("assessments")
      .select("*")
      .eq("id", assessmentId)
      .maybeSingle();

    if (error || !data) {
      toast({ title: "Error", description: "Assessment not found", variant: "destructive" });
      navigate(userRole === "manager" ? "/manager-dashboard" : "/hr-dashboard");
      return;
    }

    setAssessment(data);
    const questions = data.questions as any;
    setDsaProblems(questions?.dsa_problems || []);
    setCodingTasks(questions?.coding_tasks || []);
    setMcqQuestions(questions?.mcq_questions || []);

    const { data: job } = await supabase.from("jobs").select("title").eq("id", data.job_id).maybeSingle();
    if (job) setJobTitle(job.title);

    const { data: app } = await supabase.from("applications").select("candidate_id").eq("id", data.application_id).maybeSingle();
    if (app) {
      const { data: user } = await supabase.from("users").select("full_name").eq("id", app.candidate_id).maybeSingle();
      if (user) setCandidateName(user.full_name);
    }

    setLoading(false);
  };

  const saveQuestions = async (dsa: DSAProblem[], coding: CodingTask[], mcq: MCQQuestion[]) => {
    setDsaProblems(dsa);
    setCodingTasks(coding);
    setMcqQuestions(mcq);
    const existing = assessment?.questions as any || {};
    await supabase
      .from("assessments")
      .update({
        questions: JSON.parse(JSON.stringify({
          ...existing,
          dsa_problems: dsa,
          coding_tasks: coding,
          mcq_questions: mcq,
        })),
      })
      .eq("id", assessmentId);
  };

  const handleRemove = async (type: string, index: number) => {
    const dsa = [...dsaProblems];
    const coding = [...codingTasks];
    const mcq = [...mcqQuestions];
    if (type === "dsa") dsa.splice(index, 1);
    else if (type === "coding") coding.splice(index, 1);
    else mcq.splice(index, 1);
    await saveQuestions(dsa, coding, mcq);
    toast({ title: "Removed" });
  };

  const handleEdit = (type: string, index: number) => {
    let item: any;
    if (type === "dsa") item = { ...dsaProblems[index] };
    else if (type === "coding") item = { ...codingTasks[index] };
    else item = { ...mcqQuestions[index] };
    setEditForm({ ...item, _type: type });
    setEditDialog({ type, index });
  };

  const saveEdit = async () => {
    if (!editDialog || !editForm) return;
    const { _type, ...item } = editForm;
    const dsa = [...dsaProblems];
    const coding = [...codingTasks];
    const mcq = [...mcqQuestions];
    if (editDialog.type === "dsa") dsa[editDialog.index] = item;
    else if (editDialog.type === "coding") coding[editDialog.index] = item;
    else mcq[editDialog.index] = item;
    await saveQuestions(dsa, coding, mcq);
    setEditDialog(null);
    toast({ title: "Saved" });
  };

  const handleRegenerateAll = async () => {
    setRegeneratingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-technical", {
        body: {
          jobId: assessment.job_id,
          applicationId: assessment.application_id,
          companyId: assessment.company_id,
          createdBy: assessment.created_by,
        },
      });
      if (error) throw error;
      if (data?.questions) {
        setDsaProblems(data.questions.dsa_problems || []);
        setCodingTasks(data.questions.coding_tasks || []);
        setMcqQuestions(data.questions.mcq_questions || []);
        toast({ title: "Regenerated All", description: "New technical questions generated by AI." });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed", variant: "destructive" });
    }
    setRegeneratingAll(false);
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const updateData: any = {};
      if (userRole === "hr") {
        updateData.hr_approved = true;
        updateData.hr_approved_at = new Date().toISOString();
      } else {
        updateData.manager_approved = true;
        updateData.manager_approved_at = new Date().toISOString();
      }

      // Check if other role already approved
      const otherApproved = userRole === "hr" ? assessment.manager_approved : assessment.hr_approved;
      if (otherApproved) {
        updateData.status = "approved";
        updateData.approved_at = new Date().toISOString();
      }

      await supabase.from("assessments").update(updateData).eq("id", assessmentId);

      // Refresh assessment
      const { data: refreshed } = await supabase.from("assessments").select("*").eq("id", assessmentId).maybeSingle();
      if (refreshed) setAssessment(refreshed);

      // Notify other staff
      const { data: staffUsers } = await supabase
        .from("users")
        .select("id, role")
        .eq("company_id", assessment.company_id)
        .in("role", ["hr", "manager"])
        .neq("id", userId);

      if (staffUsers) {
        const notifs = staffUsers.map((s) => ({
          user_id: s.id,
          title: "✅ Technical Questions Approved",
          message: `${userRole === "hr" ? "HR" : "Hiring Manager"} approved technical questions for ${candidateName}.${otherApproved ? " Both approved — test will be sent to candidate!" : " Waiting for your approval."}`,
        }));
        if (notifs.length > 0) await supabase.from("notifications").insert(notifs);
      }

      // If both approved, notify candidate
      if (otherApproved) {
        const { data: app } = await supabase.from("applications").select("candidate_id").eq("id", assessment.application_id).maybeSingle();
        if (app) {
          await supabase.from("applications").update({ current_stage: "technical_test" }).eq("id", assessment.application_id);
          await supabase.from("notifications").insert({
            user_id: app.candidate_id,
            title: "💻 Technical Round Ready!",
            message: "Congratulations! You are selected for the Technical Round. Login to take your technical test. Complete within 48 hours.",
          });
        }
        toast({ title: "Both Approved!", description: "Technical test sent to candidate." });
      } else {
        toast({ title: "Approved!", description: `Waiting for ${userRole === "hr" ? "Manager" : "HR"} approval.` });
      }

      if (otherApproved) {
        navigate(userRole === "manager" ? "/manager-dashboard" : "/hr-dashboard");
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setApproving(false);
  };

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Max 10MB.", variant: "destructive" });
      return;
    }
    setUploadingPdf(true);
    toast({ title: "📄 Processing...", description: "Extracting questions from your file." });
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (assessment?.job_id) formData.append("jobId", assessment.job_id);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-pdf-questions`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: formData,
        }
      );
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to process file");
      }
      const data = await response.json();
      // Try to merge extracted questions
      if (data?.questions) {
        const q = data.questions;
        const newMcq = [...mcqQuestions];
        if (q.sections) {
          q.sections.forEach((sec: any) => {
            sec.questions.forEach((qq: any) => {
              newMcq.push({
                question_number: newMcq.length + 1,
                question: qq.question,
                options: qq.options || ["", "", "", ""],
                correct_answer: qq.correct_answer || "A",
                difficulty: qq.difficulty || "medium",
                topic: qq.topic || sec.name || "General",
              });
            });
          });
        }
        await saveQuestions(dsaProblems, codingTasks, newMcq);
        toast({ title: "✅ Questions Added!", description: `${newMcq.length - mcqQuestions.length} questions extracted.` });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setUploadingPdf(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const totalQuestions = dsaProblems.length + codingTasks.length + mcqQuestions.length;
  const hrApproved = assessment?.hr_approved;
  const managerApproved = assessment?.manager_approved;
  const currentUserApproved = userRole === "hr" ? hrApproved : managerApproved;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(userRole === "manager" ? "/manager-dashboard" : "/hr-dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Review Technical Assessment — {jobTitle}</h1>
              <p className="text-sm text-muted-foreground">Candidate: {candidateName} • {totalQuestions} questions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="file" accept=".pdf,.docx,.txt" ref={fileInputRef} onChange={handleUploadPdf} className="hidden" />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingPdf}>
              {uploadingPdf ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileUp className="h-4 w-4 mr-1" />}
              {uploadingPdf ? "Processing..." : "Upload File"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRegenerateAll} disabled={regeneratingAll}>
              <RefreshCw className={`h-4 w-4 mr-1 ${regeneratingAll ? "animate-spin" : ""}`} />
              {regeneratingAll ? "Generating..." : "Regenerate All"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-8">
        {/* Approval Status */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Approval Status</h3>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              {hrApproved ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <Clock className="h-5 w-5 text-amber-500" />
              )}
              <span className="text-sm">HR Approval: <strong>{hrApproved ? "✅ Approved" : "⏳ Pending"}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              {managerApproved ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <Clock className="h-5 w-5 text-amber-500" />
              )}
              <span className="text-sm">Manager Approval: <strong>{managerApproved ? "✅ Approved" : "⏳ Pending"}</strong></span>
            </div>
          </div>
          {!currentUserApproved && (
            <div className="mt-4 flex gap-2">
              <Button onClick={handleApprove} disabled={approving} className="bg-primary text-primary-foreground">
                {approving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                {approving ? "Approving..." : "✅ I Approve These Questions"}
              </Button>
            </div>
          )}
        </div>

        {/* DSA Problems */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">🧩 DSA Problems ({dsaProblems.length})</h2>
          </div>
          <div className="divide-y divide-border">
            {dsaProblems.map((p, idx) => (
              <div key={idx} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-muted-foreground">#{p.problem_number || idx + 1}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${difficultyColors[p.difficulty] || "bg-muted text-muted-foreground"}`}>{p.difficulty}</span>
                      <span className="text-[10px] text-muted-foreground">{p.time_minutes}min</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1">{p.title}</p>
                    <p className="text-sm text-muted-foreground mb-2">{p.description}</p>
                    <p className="text-xs text-muted-foreground"><strong>Approach:</strong> {p.expected_approach}</p>
                    {p.test_cases?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Test Cases:</p>
                        {p.test_cases.map((tc, i) => (
                          <p key={i} className="text-xs text-muted-foreground font-mono bg-muted/50 rounded px-2 py-0.5 mb-0.5">{tc}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit("dsa", idx)} className="text-xs gap-1 h-7"><Pencil className="h-3 w-3" /> Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleRemove("dsa", idx)} className="text-xs gap-1 h-7 text-destructive"><Trash2 className="h-3 w-3" /> Remove</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Coding Tasks */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">💻 Coding Tasks ({codingTasks.length})</h2>
          </div>
          <div className="divide-y divide-border">
            {codingTasks.map((t, idx) => (
              <div key={idx} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-muted-foreground">#{t.task_number || idx + 1}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${difficultyColors[t.difficulty] || "bg-muted text-muted-foreground"}`}>{t.difficulty}</span>
                      <span className="text-[10px] text-muted-foreground">{t.time_minutes}min</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-500">{t.tech_stack}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1">{t.title}</p>
                    <p className="text-sm text-muted-foreground">{t.description}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit("coding", idx)} className="text-xs gap-1 h-7"><Pencil className="h-3 w-3" /> Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleRemove("coding", idx)} className="text-xs gap-1 h-7 text-destructive"><Trash2 className="h-3 w-3" /> Remove</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* MCQ Questions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl border border-border bg-card">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">📝 MCQ Questions ({mcqQuestions.length})</h2>
          </div>
          <div className="divide-y divide-border">
            {mcqQuestions.map((q, idx) => {
              const correctIdx = q.correct_answer.charCodeAt(0) - 65;
              return (
                <div key={idx} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-muted-foreground">Q{q.question_number || idx + 1}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${difficultyColors[q.difficulty] || "bg-muted text-muted-foreground"}`}>{q.difficulty}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-500">{q.topic}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-3">{q.question}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={`text-sm px-3 py-2 rounded-lg border ${
                              oIdx === correctIdx
                                ? "border-primary bg-primary/10 text-primary font-medium"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            <span className="font-bold mr-2">{String.fromCharCode(65 + oIdx)}.</span>{opt}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit("mcq", idx)} className="text-xs gap-1 h-7"><Pencil className="h-3 w-3" /> Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleRemove("mcq", idx)} className="text-xs gap-1 h-7 text-destructive"><Trash2 className="h-3 w-3" /> Remove</Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4">
              {editForm._type === "dsa" && (
                <>
                  <div><label className="text-sm font-medium text-foreground">Title</label><Input value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} /></div>
                  <div><label className="text-sm font-medium text-foreground">Description</label><Textarea value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={4} /></div>
                  <div><label className="text-sm font-medium text-foreground">Expected Approach</label><Textarea value={editForm.expected_approach || ""} onChange={(e) => setEditForm({ ...editForm, expected_approach: e.target.value })} rows={3} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-sm font-medium text-foreground">Difficulty</label>
                      <Select value={editForm.difficulty} onValueChange={(v) => setEditForm({ ...editForm, difficulty: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent></Select>
                    </div>
                    <div><label className="text-sm font-medium text-foreground">Time (min)</label><Input type="number" value={editForm.time_minutes || 20} onChange={(e) => setEditForm({ ...editForm, time_minutes: parseInt(e.target.value) || 20 })} /></div>
                  </div>
                </>
              )}
              {editForm._type === "coding" && (
                <>
                  <div><label className="text-sm font-medium text-foreground">Title</label><Input value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} /></div>
                  <div><label className="text-sm font-medium text-foreground">Description</label><Textarea value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={4} /></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="text-sm font-medium text-foreground">Tech Stack</label><Input value={editForm.tech_stack || ""} onChange={(e) => setEditForm({ ...editForm, tech_stack: e.target.value })} /></div>
                    <div><label className="text-sm font-medium text-foreground">Difficulty</label>
                      <Select value={editForm.difficulty} onValueChange={(v) => setEditForm({ ...editForm, difficulty: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent></Select>
                    </div>
                    <div><label className="text-sm font-medium text-foreground">Time (min)</label><Input type="number" value={editForm.time_minutes || 30} onChange={(e) => setEditForm({ ...editForm, time_minutes: parseInt(e.target.value) || 30 })} /></div>
                  </div>
                </>
              )}
              {editForm._type === "mcq" && (
                <>
                  <div><label className="text-sm font-medium text-foreground">Question</label><Textarea value={editForm.question || ""} onChange={(e) => setEditForm({ ...editForm, question: e.target.value })} rows={3} /></div>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i}><label className="text-sm font-medium text-foreground">Option {String.fromCharCode(65 + i)}</label><Input value={editForm.options?.[i] || ""} onChange={(e) => { const opts = [...(editForm.options || ["", "", "", ""])]; opts[i] = e.target.value; setEditForm({ ...editForm, options: opts }); }} /></div>
                  ))}
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="text-sm font-medium text-foreground">Correct</label>
                      <Select value={editForm.correct_answer} onValueChange={(v) => setEditForm({ ...editForm, correct_answer: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="A">A</SelectItem><SelectItem value="B">B</SelectItem><SelectItem value="C">C</SelectItem><SelectItem value="D">D</SelectItem></SelectContent></Select>
                    </div>
                    <div><label className="text-sm font-medium text-foreground">Difficulty</label>
                      <Select value={editForm.difficulty} onValueChange={(v) => setEditForm({ ...editForm, difficulty: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent></Select>
                    </div>
                    <div><label className="text-sm font-medium text-foreground">Topic</label><Input value={editForm.topic || ""} onChange={(e) => setEditForm({ ...editForm, topic: e.target.value })} /></div>
                  </div>
                </>
              )}
              <Button onClick={saveEdit} className="w-full bg-primary text-primary-foreground">Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReviewTechnical;
