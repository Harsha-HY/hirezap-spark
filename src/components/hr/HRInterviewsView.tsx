import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Video, Phone, MapPin, Plus, Loader2, ClipboardCheck, FileText, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import InterviewScorecard from "@/components/InterviewScorecard";
import OfferLetterPanel from "@/components/OfferLetterPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  companyId: string;
}

const HRInterviewsView = ({ companyId }: Props) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [interviews, setInterviews] = useState<any[]>([]);
  const [candidateNames, setCandidateNames] = useState<Record<string, string>>({});
  const [candidateEmails, setCandidateEmails] = useState<Record<string, string>>({});
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [scorecardInterview, setScorecardInterview] = useState<any>(null);
  const [offerApp, setOfferApp] = useState<any>(null);
  const [viewScorecard, setViewScorecard] = useState<any>(null);

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: user } = await supabase.from("users").select("id, full_name, company_id, role").eq("user_id", session.user.id).maybeSingle();
    if (!user) return;
    setCurrentUser(user);

    const { data: interviewData } = await supabase
      .from("interviews")
      .select("*")
      .eq("company_id", companyId)
      .order("scheduled_date", { ascending: false });

    if (interviewData) {
      setInterviews(interviewData as any);
      const cIds = [...new Set(interviewData.map((i: any) => i.candidate_id))];
      const jIds = [...new Set(interviewData.map((i: any) => i.job_id))];

      if (cIds.length) {
        const { data: users } = await supabase.from("users").select("id, full_name, email").in("id", cIds);
        setCandidateNames(Object.fromEntries((users || []).map(u => [u.id, u.full_name])));
        setCandidateEmails(Object.fromEntries((users || []).map(u => [u.id, u.email])));
      }
      if (jIds.length) {
        const { data: jobs } = await supabase.from("jobs").select("id, title").in("id", jIds);
        setJobTitles(Object.fromEntries((jobs || []).map(j => [j.id, j.title])));
      }
    }
    setLoading(false);
  };

  useEffect(() => { if (companyId) fetchData(); }, [companyId]);

  const scheduled = interviews.filter(i => i.status === "scheduled");
  const completed = interviews.filter(i => i.status === "completed");

  const getModeIcon = (mode: string) => {
    if (mode === "video_call") return <Video className="h-3.5 w-3.5" />;
    if (mode === "phone_call") return <Phone className="h-3.5 w-3.5" />;
    return <MapPin className="h-3.5 w-3.5" />;
  };

  const handleGenerateOffer = async (interview: any) => {
    const { data: app } = await supabase.from("applications").select("*").eq("id", interview.application_id).maybeSingle();
    if (app) {
      setOfferApp({
        ...app,
        candidate_name: candidateNames[interview.candidate_id] || "Unknown",
        candidate_email: candidateEmails[interview.candidate_id] || "",
        job_title: jobTitles[interview.job_id] || "",
      });
    }
  };

  // Calculate overall score when offer is generated
  const calculateOverallScore = async (appId: string) => {
    const { data: app } = await supabase.from("applications").select("resume_score, test_score, video_score, technical_score, interview_score").eq("id", appId).maybeSingle();
    if (!app) return;

    const overall =
      (app.resume_score || 0) * 0.20 +
      (app.test_score || 0) * 0.20 +
      (app.video_score || 0) * 0.15 +
      (app.technical_score || 0) * 0.20 +
      (app.interview_score || 0) * 0.10;
    // GD score would need separate fetch - simplified
    await supabase.from("applications").update({ overall_score: Math.round(overall * 100) / 100 } as any).eq("id", appId);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Interviews</h2>
        <Button size="sm" onClick={() => navigate("/schedule-interview")} className="gap-2">
          <Plus className="h-4 w-4" /> Schedule Interview
        </Button>
      </div>

      {/* Scheduled */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Scheduled ({scheduled.length})</h3>
        {scheduled.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">No scheduled interviews.</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {scheduled.map(interview => (
              <Card key={interview.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{candidateNames[interview.candidate_id] || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">{jobTitles[interview.job_id]} • {interview.round_type.replace(/_/g, " ")}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {interview.scheduled_date}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {interview.scheduled_time}</span>
                        <span className="flex items-center gap-1">{getModeIcon(interview.mode)} {interview.mode.replace(/_/g, " ")}</span>
                        <span>{interview.duration}m</span>
                      </div>
                      {interview.meeting_link && (
                        <a href={interview.meeting_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                          🔗 Join Meeting
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-500/10 text-amber-500 border-0">Scheduled</Badge>
                      <Button size="sm" variant="outline" onClick={() => setScorecardInterview(interview)} className="gap-1 text-xs">
                        <ClipboardCheck className="h-3.5 w-3.5" /> Fill Scorecard
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Completed */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Completed ({completed.length})</h3>
        {completed.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">No completed interviews yet.</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {completed.map(interview => (
              <Card key={interview.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{candidateNames[interview.candidate_id] || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">{jobTitles[interview.job_id]} • {interview.round_type.replace(/_/g, " ")}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant={interview.recommendation === "Strong Hire" || interview.recommendation === "Hire" ? "default" : "secondary"} className="text-xs">
                          {interview.recommendation}
                        </Badge>
                        <span className="text-muted-foreground">{interview.scheduled_date}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setViewScorecard(interview)} className="gap-1 text-xs">
                        <Eye className="h-3.5 w-3.5" /> View Scorecard
                      </Button>
                      {(interview.recommendation === "Strong Hire" || interview.recommendation === "Hire") && (
                        <Button size="sm" onClick={() => handleGenerateOffer(interview)} className="gap-1 text-xs">
                          <FileText className="h-3.5 w-3.5" /> Generate Offer
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Scorecard Dialog */}
      {scorecardInterview && currentUser && (
        <InterviewScorecard
          interview={scorecardInterview}
          candidateName={candidateNames[scorecardInterview.candidate_id] || "Unknown"}
          open={!!scorecardInterview}
          onOpenChange={(open) => !open && setScorecardInterview(null)}
          onSubmitted={() => {
            calculateOverallScore(scorecardInterview.application_id);
            fetchData();
          }}
          currentUser={currentUser}
        />
      )}

      {/* View Scorecard */}
      <Dialog open={!!viewScorecard} onOpenChange={() => setViewScorecard(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Scorecard — {candidateNames[viewScorecard?.candidate_id] || ""}</DialogTitle></DialogHeader>
          {viewScorecard?.scorecard && (
            <div className="space-y-3">
              {Object.entries((viewScorecard.scorecard as any).scores || {}).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(v => (
                      <span key={v} className={`h-6 w-6 rounded text-xs flex items-center justify-center font-bold ${v <= (val as number) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{v}</span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="border-t border-border pt-3">
                <p className="text-sm"><span className="text-muted-foreground">Recommendation:</span> <span className="font-semibold text-foreground">{viewScorecard.recommendation}</span></p>
                {(viewScorecard.scorecard as any).detailed_notes && (
                  <p className="text-sm text-muted-foreground mt-2">{(viewScorecard.scorecard as any).detailed_notes}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Offer Letter Panel */}
      {offerApp && currentUser && (
        <OfferLetterPanel
          application={offerApp}
          candidateName={offerApp.candidate_name}
          candidateEmail={offerApp.candidate_email}
          jobTitle={offerApp.job_title}
          open={!!offerApp}
          onOpenChange={(open) => !open && setOfferApp(null)}
          onGenerated={fetchData}
          currentUser={currentUser}
        />
      )}
    </motion.div>
  );
};

export default HRInterviewsView;
