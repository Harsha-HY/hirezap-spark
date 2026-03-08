import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  interview: any;
  candidateName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
  currentUser: any;
}

const scoreCategories = [
  { key: "problem_solving", label: "Problem Solving" },
  { key: "technical_knowledge", label: "Technical Knowledge" },
  { key: "communication", label: "Communication Skills" },
  { key: "culture_fit", label: "Culture Fit" },
  { key: "leadership", label: "Leadership Potential" },
  { key: "overall_impression", label: "Overall Impression" },
];

const InterviewScorecard = ({ interview, candidateName, open, onOpenChange, onSubmitted, currentUser }: Props) => {
  const { toast } = useToast();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [detailedNotes, setDetailedNotes] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleScore = (key: string, val: number) => {
    setScores(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async () => {
    if (Object.keys(scores).length < scoreCategories.length || !recommendation) {
      toast({ title: "Incomplete", description: "Please rate all categories and select recommendation.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const avg = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length;
      const interviewScore = Math.round((avg / 5) * 100);

      await supabase.from("interviews").update({
        scorecard: { scores, detailed_notes: detailedNotes },
        recommendation,
        status: "completed",
      } as any).eq("id", interview.id);

      // Update application interview_score
      await supabase.from("applications").update({
        interview_score: interviewScore,
      }).eq("id", interview.application_id);

      // Notify HR if manager submitted
      if (currentUser.role === "manager") {
        const { data: hrUsers } = await supabase.from("users").select("id").eq("role", "hr").eq("company_id", currentUser.company_id);
        for (const hr of (hrUsers || [])) {
          await supabase.from("notifications").insert({
            user_id: hr.id,
            title: "📝 Interview Scorecard Submitted",
            message: `${currentUser.full_name} submitted scorecard for ${candidateName}.\nRecommendation: ${recommendation}\nAverage Score: ${avg.toFixed(1)}/5`,
          });
        }
      }

      toast({ title: "✅ Scorecard Submitted", description: `Average: ${avg.toFixed(1)}/5 — ${recommendation}` });
      onSubmitted();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Interview Scorecard</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 mb-4">
          <p className="text-sm text-muted-foreground">Candidate: <span className="font-medium text-foreground">{candidateName}</span></p>
          <p className="text-sm text-muted-foreground">Round: <span className="font-medium text-foreground">{interview?.round_type?.replace(/_/g, " ")}</span></p>
          <p className="text-sm text-muted-foreground">Date: <span className="font-medium text-foreground">{interview?.scheduled_date}</span></p>
        </div>

        <div className="space-y-4">
          {scoreCategories.map(cat => (
            <div key={cat.key} className="space-y-1.5">
              <Label className="text-sm">{cat.label}</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(val => (
                  <button
                    key={val}
                    onClick={() => handleScore(cat.key, val)}
                    className={`h-9 w-9 rounded-lg text-sm font-bold transition-all ${
                      scores[cat.key] === val
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="space-y-2">
            <Label>Detailed Notes</Label>
            <Textarea value={detailedNotes} onChange={e => setDetailedNotes(e.target.value)} rows={3} placeholder="Observations, strengths, areas of concern..." />
          </div>

          <div className="space-y-2">
            <Label>Recommendation *</Label>
            <Select value={recommendation} onValueChange={setRecommendation}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Strong Hire">Strong Hire</SelectItem>
                <SelectItem value="Hire">Hire</SelectItem>
                <SelectItem value="Maybe">Maybe</SelectItem>
                <SelectItem value="Do Not Hire">Do Not Hire</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitting ? "Submitting..." : "Submit Scorecard"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InterviewScorecard;
