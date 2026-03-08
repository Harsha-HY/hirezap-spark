import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Zap, Check, Loader2 } from "lucide-react";

interface Job {
  id: string;
  title: string;
  aptitude_cutoff: number | null;
}

interface Props {
  companyId: string;
}

const AptitudeCutoffCard = ({ companyId }: Props) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [cutoff, setCutoff] = useState<number>(60);
  const [saving, setSaving] = useState(false);
  const [savedCutoff, setSavedCutoff] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, title, aptitude_cutoff")
        .eq("company_id", companyId)
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (data) {
        setJobs(data as Job[]);
        if (data.length > 0 && !selectedJobId) {
          setSelectedJobId(data[0].id);
          setCutoff((data[0] as Job).aptitude_cutoff ?? 60);
          setSavedCutoff((data[0] as Job).aptitude_cutoff);
        }
      }
    })();
  }, [companyId]);

  useEffect(() => {
    const job = jobs.find((j) => j.id === selectedJobId);
    if (job) {
      setCutoff(job.aptitude_cutoff ?? 60);
      setSavedCutoff(job.aptitude_cutoff);
    }
  }, [selectedJobId, jobs]);

  const handleSave = async () => {
    if (!selectedJobId) return;
    setSaving(true);
    const { error } = await supabase
      .from("jobs")
      .update({ aptitude_cutoff: cutoff } as any)
      .eq("id", selectedJobId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSavedCutoff(cutoff);
      setJobs((prev) =>
        prev.map((j) => (j.id === selectedJobId ? { ...j, aptitude_cutoff: cutoff } : j))
      );
      toast({
        title: "✅ Cutoff Saved",
        description: `Candidates scoring ≥ ${cutoff}% will automatically advance to Video Introduction.`,
      });
    }
    setSaving(false);
  };

  if (jobs.length === 0) return null;

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-xl border border-border bg-card p-6"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Aptitude Cutoff Settings</h2>
          <p className="text-xs text-muted-foreground">
            Auto-advance candidates who score above the cutoff to Video Round
          </p>
        </div>
      </div>

      {/* Job selector */}
      <div className="mb-5">
        <label className="text-sm font-medium text-foreground mb-1.5 block">Select Job</label>
        <Select value={selectedJobId} onValueChange={setSelectedJobId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a job" />
          </SelectTrigger>
          <SelectContent>
            {jobs.map((j) => (
              <SelectItem key={j.id} value={j.id}>
                {j.title}
                {j.aptitude_cutoff !== null && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (cutoff: {j.aptitude_cutoff}%)
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cutoff slider */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-foreground">Minimum Passing Score</label>
          <span className="text-2xl font-bold text-primary">{cutoff}%</span>
        </div>
        <Slider
          value={[cutoff]}
          onValueChange={(val) => setCutoff(val[0])}
          min={0}
          max={100}
          step={5}
          className="mb-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Status indicator */}
      <div className="rounded-lg bg-secondary/50 p-3 mb-5">
        {savedCutoff !== null ? (
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-primary" />
            <span className="text-foreground">
              Active cutoff: <strong>{savedCutoff}%</strong> for{" "}
              <strong>{selectedJob?.title}</strong>
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No cutoff set for this job. Candidates will need manual approval after aptitude test.
          </p>
        )}
      </div>

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={saving || cutoff === savedCutoff}
        className="w-full gap-2"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Zap className="h-4 w-4" />
        )}
        {savedCutoff !== null ? "Update Cutoff" : "Set Cutoff"}
      </Button>
    </motion.div>
  );
};

export default AptitudeCutoffCard;
