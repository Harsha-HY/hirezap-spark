import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, X, Check, Target, FileText, Upload, Loader2, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

interface JobRow {
  id: string;
  title: string;
  department: string;
  manager_id: string | null;
  salary_min: number | null;
  salary_max: number | null;
  location: string;
  work_type: string;
  applications_count: number;
  status: string;
  created_at: string;
}

interface Props {
  jobs: JobRow[];
  managers: { id: string; full_name: string }[];
  onPostJob: () => void;
  onJobUpdated?: () => void;
}

const workTypes = ["Onsite", "Remote", "Hybrid"];

const HRJobsView = ({ jobs, managers, onPostJob, onJobUpdated }: Props) => {
  const { toast } = useToast();
  const [editJob, setEditJob] = useState<JobRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [parsingPdf, setParsingPdf] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<any>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [hasExistingQuestions, setHasExistingQuestions] = useState(false);
  const [form, setForm] = useState({
    title: "",
    department: "",
    managerId: "",
    salaryMin: "",
    salaryMax: "",
    location: "",
    workType: "Onsite",
    status: "open",
    aptitudeCutoff: 60,
  });

  const getManagerName = (managerId: string | null) => {
    if (!managerId) return "—";
    return managers.find((m) => m.id === managerId)?.full_name || "—";
  };

  const openEdit = async (job: JobRow) => {
    setEditJob(job);
    setForm({
      title: job.title,
      department: job.department,
      managerId: job.manager_id || "",
      salaryMin: job.salary_min?.toString() || "",
      salaryMax: job.salary_max?.toString() || "",
      location: job.location,
      workType: job.work_type,
      status: job.status,
      aptitudeCutoff: (job as any).aptitude_cutoff ?? 60,
    });
    setPdfFile(null);
    setParsedQuestions(null);
    setQuestionCount(0);

    // Check if job already has aptitude questions
    const { data } = await supabase
      .from("jobs")
      .select("aptitude_questions")
      .eq("id", job.id)
      .maybeSingle();

    if (data?.aptitude_questions) {
      setHasExistingQuestions(true);
      const existing = data.aptitude_questions as any;
      const count = existing.sections?.reduce(
        (acc: number, sec: any) => acc + (sec.questions?.length || 0),
        0
      ) || 0;
      setQuestionCount(count);
      setParsedQuestions(existing);
    } else {
      setHasExistingQuestions(false);
    }

    setEditOpen(true);
  };

  const handlePdfUpload = async (file: File) => {
    if (!file || file.type !== "application/pdf") {
      toast({ title: "Invalid file", description: "Please upload a PDF file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "PDF must be under 5MB.", variant: "destructive" });
      return;
    }

    setPdfFile(file);
    setParsingPdf(true);
    setParsedQuestions(null);

    toast({ title: "🤖 Analyzing PDF...", description: "AI is converting your PDF into MCQ questions." });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("jobId", editJob?.id || "");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-pdf-questions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Failed (${response.status})`);
      }

      const data = await response.json();
      if (data.questions) {
        setParsedQuestions(data.questions);
        const count = data.questions.sections?.reduce(
          (acc: number, sec: any) => acc + (sec.questions?.length || 0),
          0
        ) || 0;
        setQuestionCount(count);
        setHasExistingQuestions(false); // It's a new upload
        toast({ title: `✅ ${count} questions extracted!` });
      }
    } catch (err: any) {
      toast({ title: "PDF parsing failed", description: err.message, variant: "destructive" });
      setPdfFile(null);
    }
    setParsingPdf(false);
  };

  const removeQuestions = () => {
    setPdfFile(null);
    setParsedQuestions(null);
    setQuestionCount(0);
    setHasExistingQuestions(false);
  };

  const handleSave = async () => {
    if (!editJob) return;
    setSaving(true);

    const updateData: any = {
      title: form.title,
      department: form.department,
      manager_id: form.managerId || null,
      salary_min: form.salaryMin ? Number(form.salaryMin) : null,
      salary_max: form.salaryMax ? Number(form.salaryMax) : null,
      location: form.location,
      work_type: form.workType,
      status: form.status,
      aptitude_cutoff: form.aptitudeCutoff,
    };

    // If new questions were parsed from PDF upload, save them
    if (parsedQuestions && !hasExistingQuestions) {
      updateData.aptitude_questions = parsedQuestions;
    }
    // If questions were explicitly removed
    if (!parsedQuestions && !hasExistingQuestions) {
      updateData.aptitude_questions = null;
    }

    const { error } = await supabase
      .from("jobs")
      .update(updateData)
      .eq("id", editJob.id);

    if (error) {
      toast({ title: "Failed to update job", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Job updated successfully!" });
      setEditOpen(false);
      onJobUpdated?.();
    }
    setSaving(false);
  };

  const inputClass = "w-full rounded-lg border border-border bg-secondary/50 py-3 px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm";

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Posted Jobs ({jobs.length})</h2>
          <Button onClick={onPostJob} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2" size="sm">
            <Plus className="h-4 w-4" />
            Post New Job
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Job Title</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Salary</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Applications</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date Posted</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  No jobs posted yet. Click &quot;Post New Job&quot; to get started.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.title}</TableCell>
                  <TableCell>{job.department}</TableCell>
                  <TableCell>{getManagerName(job.manager_id)}</TableCell>
                  <TableCell>
                    {job.salary_min && job.salary_max
                      ? `₹${job.salary_min.toLocaleString()} - ₹${job.salary_max.toLocaleString()}`
                      : "—"}
                  </TableCell>
                  <TableCell>{job.location}</TableCell>
                  <TableCell>{job.applications_count}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      job.status === "open" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(job.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(job)}
                      className="gap-1.5 text-muted-foreground hover:text-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </motion.div>

      {/* Edit Job Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg bg-card border-border overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl font-bold text-foreground">Edit Job</SheetTitle>
          </SheetHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Job Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className={inputClass} />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Department</label>
              <input type="text" value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} className={inputClass} />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Assign Manager</label>
              <Select value={form.managerId} onValueChange={(v) => setForm((p) => ({ ...p, managerId: v }))}>
                <SelectTrigger className="bg-secondary/50 border-border h-12">
                  <SelectValue placeholder="Select a manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Salary Min</label>
                <input type="number" value={form.salaryMin} onChange={(e) => setForm((p) => ({ ...p, salaryMin: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Salary Max</label>
                <input type="number" value={form.salaryMax} onChange={(e) => setForm((p) => ({ ...p, salaryMax: e.target.value }))} className={inputClass} />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Location</label>
              <input type="text" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} className={inputClass} />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Work Type</label>
              <Select value={form.workType} onValueChange={(v) => setForm((p) => ({ ...p, workType: v }))}>
                <SelectTrigger className="bg-secondary/50 border-border h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workTypes.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger className="bg-secondary/50 border-border h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Aptitude PDF Upload / Existing Questions */}
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-primary" />
                <label className="text-sm font-medium text-foreground">Aptitude Test Questions</label>
              </div>

              {parsedQuestions && !parsingPdf ? (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium text-foreground">
                        {questionCount} questions {hasExistingQuestions ? "loaded" : "extracted"}
                      </span>
                    </div>
                    <button type="button" onClick={removeQuestions} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {pdfFile && <p className="text-[11px] text-muted-foreground">{pdfFile.name}</p>}
                  {parsedQuestions.sections && (
                    <div className="mt-2 space-y-1">
                      {parsedQuestions.sections.map((sec: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{sec.name}</span>
                          <span className="text-primary font-medium">{sec.questions?.length || 0} Qs</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : parsingPdf ? (
                <div className="flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/20 p-4">
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Analyzing PDF...</p>
                    <p className="text-[11px] text-muted-foreground">AI is converting content to MCQ format</p>
                  </div>
                </div>
              ) : (
                <>
                  <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border hover:border-primary/50 bg-secondary/20 p-5 cursor-pointer transition-colors">
                    <Upload className="h-7 w-7 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Upload PDF to replace questions</span>
                    <span className="text-[10px] text-muted-foreground">Max 5MB • PDF only</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePdfUpload(f);
                      }}
                    />
                  </label>
                  <p className="text-[10px] text-muted-foreground mt-2 italic">
                    No questions attached. AI will auto-generate when candidates reach aptitude stage.
                  </p>
                </>
              )}
            </div>

            {/* Aptitude Cutoff */}
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-primary" />
                <label className="text-sm font-medium text-foreground">Aptitude Cutoff Score</label>
                <span className="ml-auto text-lg font-bold text-primary">{form.aptitudeCutoff}%</span>
              </div>
              <Slider
                value={[form.aptitudeCutoff]}
                onValueChange={(val) => setForm((p) => ({ ...p, aptitudeCutoff: val[0] }))}
                min={0}
                max={100}
                step={5}
                className="mb-2"
              />
              <p className="text-[11px] text-muted-foreground mt-2">
                Candidates scoring ≥ {form.aptitudeCutoff}% will auto-advance to Video Round
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving || parsingPdf} className="w-full rounded-lg py-6 text-sm font-semibold gap-2 mt-2">
              {saving ? "Saving..." : (<><Check className="h-4 w-4" /> Save Changes</>)}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default HRJobsView;
