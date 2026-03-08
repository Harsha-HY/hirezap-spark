import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, CheckCircle, XCircle, ArrowRight, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

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
  cover_letter: string | null;
}

interface Props {
  companyId: string;
}

const stageFlow = ["applied", "ai_scored", "shortlisted", "interview", "selected", "rejected"];

const stageLabel: Record<string, string> = {
  applied: "Applied",
  ai_scored: "AI Scored",
  shortlisted: "Shortlisted",
  interview: "Interview",
  selected: "Selected",
  rejected: "Rejected",
};

const stageBadgeClass: Record<string, string> = {
  applied: "bg-muted text-muted-foreground",
  ai_scored: "bg-blue-500/10 text-blue-500",
  shortlisted: "bg-amber-500/10 text-amber-500",
  interview: "bg-purple-500/10 text-purple-500",
  selected: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
};

const HRCandidatesView = ({ companyId }: Props) => {
  const [applications, setApplications] = useState<(Application & { candidate_name: string; candidate_email: string; job_title: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchApplications = async () => {
    setLoading(true);

    // Get all jobs for this company
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

    // Get applications for those jobs
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

    // Get candidate names
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

    setApplications(enriched);
    setLoading(false);
  };

  useEffect(() => {
    if (companyId) fetchApplications();
  }, [companyId]);

  const handleViewResume = async (resumeUrl: string | null) => {
    if (!resumeUrl) {
      toast({ title: "No Resume", description: "This candidate did not upload a resume." });
      return;
    }
    const { data } = await supabase.storage.from("resumes").createSignedUrl(resumeUrl, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast({ title: "Error", description: "Could not load resume.", variant: "destructive" });
    }
  };

  const handleUpdateStage = async (appId: string, newStage: string) => {
    const { error } = await supabase
      .from("applications")
      .update({ current_stage: newStage, status: newStage === "rejected" ? "rejected" : "active" })
      .eq("id", appId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: `Candidate moved to ${stageLabel[newStage]}.` });
      fetchApplications();
    }
  };

  const getVerdict = (analysis: any): string => {
    if (!analysis) return "—";
    if (typeof analysis === "object" && analysis.verdict) return analysis.verdict;
    return "—";
  };

  const getNextStage = (current: string): string | null => {
    const idx = stageFlow.indexOf(current);
    if (idx === -1 || idx >= stageFlow.length - 2) return null; // can't go past selected
    return stageFlow[idx + 1];
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
          <div className="p-12 text-center text-muted-foreground">
            No candidates have applied yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Candidate</TableHead>
                <TableHead>Job Applied</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Current CTC</TableHead>
                <TableHead>Expected CTC</TableHead>
                <TableHead>Notice</TableHead>
                <TableHead>AI Score</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Resume</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => {
                const nextStage = getNextStage(app.current_stage);
                return (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{app.candidate_name}</p>
                        <p className="text-xs text-muted-foreground">{app.candidate_email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{app.job_title}</TableCell>
                    <TableCell>{app.experience_years} yrs</TableCell>
                    <TableCell>₹{app.current_ctc.toLocaleString()}</TableCell>
                    <TableCell>₹{app.expected_ctc.toLocaleString()}</TableCell>
                    <TableCell>{app.notice_period} days</TableCell>
                    <TableCell>
                      {app.resume_score !== null ? (
                        <span className={`font-bold ${app.resume_score >= 70 ? "text-primary" : app.resume_score >= 50 ? "text-amber-500" : "text-destructive"}`}>
                          {app.resume_score}/100
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="capitalize text-sm">{getVerdict(app.ai_analysis)}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stageBadgeClass[app.current_stage] || "bg-muted text-muted-foreground"}`}>
                        {stageLabel[app.current_stage] || app.current_stage}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewResume(app.resume_url)}
                        className="text-muted-foreground hover:text-foreground gap-1"
                      >
                        <FileText className="h-4 w-4" />
                        View
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {app.current_stage !== "rejected" && app.current_stage !== "selected" && nextStage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStage(app.id, nextStage)}
                            className="text-primary hover:text-primary gap-1 text-xs"
                            title={`Move to ${stageLabel[nextStage]}`}
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
                            title="Reject"
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
        )}
      </div>
    </motion.div>
  );
};

export default HRCandidatesView;
