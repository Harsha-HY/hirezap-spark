import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, Users, Calendar, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  userId: string;
  userName: string;
  userRole: string;
  onCreated: () => void;
}

interface CandidateOption {
  id: string;
  candidate_id: string;
  candidate_name: string;
  photo_url: string | null;
  resume_score: number | null;
  technical_score: number | null;
}

const CreateGDPanel = ({ open, onOpenChange, companyId, userId, userName, userRole, onCreated }: Props) => {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<{ id: string; title: string; department: string }[]>([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [aiTopics, setAiTopics] = useState<string[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [duration, setDuration] = useState("20");
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // Load jobs
  useEffect(() => {
    if (!companyId || !open) return;
    (async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, title, department")
        .eq("company_id", companyId)
        .eq("status", "open");
      setJobs(data || []);
    })();
  }, [companyId, open]);

  // Load candidates when job selected
  useEffect(() => {
    if (!selectedJob) { setCandidates([]); return; }
    setLoadingCandidates(true);
    (async () => {
      const { data: apps } = await supabase
        .from("applications")
        .select("id, candidate_id, photo_url, resume_score, technical_score")
        .eq("job_id", selectedJob)
        .eq("current_stage", "group_discussion");

      if (!apps || apps.length === 0) {
        setCandidates([]);
        setLoadingCandidates(false);
        return;
      }

      const candidateIds = [...new Set(apps.map(a => a.candidate_id))];
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", candidateIds);

      const nameMap = Object.fromEntries((users || []).map(u => [u.id, u.full_name]));

      setCandidates(apps.map(a => ({
        id: a.id,
        candidate_id: a.candidate_id,
        candidate_name: nameMap[a.candidate_id] || "Unknown",
        photo_url: a.photo_url,
        resume_score: a.resume_score,
        technical_score: a.technical_score,
      })));
      setLoadingCandidates(false);
    })();
  }, [selectedJob]);

  const toggleCandidate = (appId: string) => {
    setSelectedCandidates(prev =>
      prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]
    );
  };

  const selectAll = () => {
    setSelectedCandidates(candidates.map(c => c.id));
  };

  // Auto-group into max 8
  const groups = (() => {
    const selected = candidates.filter(c => selectedCandidates.includes(c.id));
    const result: { name: string; members: CandidateOption[] }[] = [];
    for (let i = 0; i < selected.length; i += 8) {
      result.push({
        name: String.fromCharCode(65 + result.length), // A, B, C...
        members: selected.slice(i, i + 8),
      });
    }
    return result;
  })();

  const handleAiSuggest = async () => {
    const job = jobs.find(j => j.id === selectedJob);
    if (!job) {
      toast({ title: "Select a job first", variant: "destructive" });
      return;
    }
    setLoadingTopics(true);
    setAiTopics([]);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-gd-topics", {
        body: { jobTitle: job.title, industry: job.department },
      });
      if (error) throw error;
      setAiTopics(data.topics || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to get suggestions", variant: "destructive" });
    }
    setLoadingTopics(false);
  };

  const handleSubmit = async () => {
    if (!selectedJob || selectedCandidates.length < 2 || !topic || !scheduledDate || !scheduledTime) {
      toast({ title: "Missing fields", description: "Please fill all required fields and select at least 2 candidates.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      // Create GD
      const { data: gd, error: gdError } = await supabase
        .from("group_discussions")
        .insert({
          job_id: selectedJob,
          company_id: companyId,
          topic,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
          duration: parseInt(duration),
          instructions: instructions || null,
          created_by: userId,
          status: "scheduled",
        } as any)
        .select()
        .single();

      if (gdError) throw gdError;

      // Create groups
      for (const group of groups) {
        await supabase.from("gd_groups").insert({
          gd_id: gd.id,
          group_name: group.name,
          candidate_ids: group.members.map(m => m.candidate_id),
        } as any);
      }

      // Notify candidates
      const selectedApps = candidates.filter(c => selectedCandidates.includes(c.id));
      for (const app of selectedApps) {
        const groupName = groups.find(g => g.members.some(m => m.id === app.id))?.name || "?";
        await supabase.from("notifications").insert({
          user_id: app.candidate_id,
          title: "🎉 GD Round Scheduled!",
          message: `You are selected for Group Discussion. Topic: ${topic}. Date: ${scheduledDate}, Time: ${scheduledTime}, Duration: ${duration} min. Group: ${groupName}. ${instructions ? `Instructions: ${instructions}` : ""} Be ready with good internet, camera, mic, and quiet environment.`,
        });
      }

      // If Manager created, notify HR
      if (userRole === "manager") {
        const { data: hrUsers } = await supabase
          .from("users")
          .select("id")
          .eq("role", "hr")
          .eq("company_id", companyId);
        if (hrUsers) {
          const job = jobs.find(j => j.id === selectedJob);
          for (const hr of hrUsers) {
            await supabase.from("notifications").insert({
              user_id: hr.id,
              title: "📋 GD Scheduled by Manager",
              message: `${userName} scheduled Group Discussion for ${job?.title || "Unknown"} candidates. Date: ${scheduledDate} Time: ${scheduledTime}. Candidates: ${selectedCandidates.length}.`,
            });
          }
        }
      }

      toast({ title: "✅ GD Scheduled!", description: `Group Discussion created with ${selectedCandidates.length} candidates in ${groups.length} group(s).` });
      onOpenChange(false);
      onCreated();

      // Reset
      setSelectedJob("");
      setCandidates([]);
      setSelectedCandidates([]);
      setTopic("");
      setAiTopics([]);
      setScheduledDate("");
      setScheduledTime("");
      setInstructions("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto bg-card border-border">
        <SheetHeader>
          <SheetTitle className="text-foreground">Schedule Group Discussion</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Select Job */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Select Job</label>
            <Select value={selectedJob} onValueChange={setSelectedJob}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Choose a job" />
              </SelectTrigger>
              <SelectContent>
                {jobs.map(j => (
                  <SelectItem key={j.id} value={j.id}>{j.title} — {j.department}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Select Candidates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Select Candidates</label>
              {candidates.length > 0 && (
                <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs text-primary">
                  Select All ({candidates.length})
                </Button>
              )}
            </div>
            {loadingCandidates ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading candidates...
              </div>
            ) : candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                {selectedJob ? "No candidates at Group Discussion stage for this job." : "Select a job first."}
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto rounded-lg border border-border p-2">
                {candidates.map(c => (
                  <label key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer">
                    <Checkbox
                      checked={selectedCandidates.includes(c.id)}
                      onCheckedChange={() => toggleCandidate(c.id)}
                    />
                    {c.photo_url && (
                      <img
                        src={c.photo_url.startsWith("http") ? c.photo_url : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/photos/${c.photo_url}`}
                        alt="" className="h-7 w-7 rounded-full object-cover border border-border"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.candidate_name}</p>
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      {c.resume_score !== null && <span>AI:{c.resume_score}</span>}
                      {c.technical_score !== null && <span>Tech:{c.technical_score}</span>}
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Group Preview */}
            {groups.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {groups.map(g => (
                  <div key={g.name} className="flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
                    <Users className="h-3 w-3" />
                    Group {g.name}: {g.members.length} candidates
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Topic */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">GD Topic</label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter discussion topic"
              className="bg-secondary border-border"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAiSuggest}
              disabled={loadingTopics || !selectedJob}
              className="gap-2 text-xs"
            >
              {loadingTopics ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              🤖 AI Suggest Topics
            </Button>

            {aiTopics.length > 0 && (
              <div className="space-y-2 mt-2">
                {aiTopics.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => { setTopic(t); setAiTopics([]); }}
                    className="w-full text-left rounded-lg border border-border p-3 text-sm text-foreground hover:bg-primary/10 hover:border-primary/30 transition-colors"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Date
              </label>
              <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Time
              </label>
              <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Duration</label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="20">20 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Special Instructions (optional)</label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Any special instructions for candidates..."
              rows={3}
              className="bg-secondary border-border"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedJob || selectedCandidates.length < 2 || !topic || !scheduledDate || !scheduledTime}
            className="w-full gap-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Schedule GD
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CreateGDPanel;
