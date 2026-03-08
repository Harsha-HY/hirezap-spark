import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Calendar, Clock, ArrowLeft, Eye, CheckCircle, XCircle, Loader2, Brain } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CreateGDPanel from "@/components/CreateGDPanel";

interface GD {
  id: string;
  job_id: string;
  topic: string;
  scheduled_date: string;
  scheduled_time: string;
  duration: number;
  status: string;
  instructions: string | null;
  created_at: string;
  job_title?: string;
}

interface GDGroup {
  id: string;
  gd_id: string;
  group_name: string;
  candidate_ids: string[];
}

interface GDScore {
  id: string;
  gd_id: string;
  candidate_id: string;
  overall_gd_score: number;
  speaking_percentage: number;
  verdict: string;
  ai_feedback: string | null;
  points_quality: number;
  leadership_score: number;
  communication_score: number;
  relevance_score: number;
}

const GDDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState<string>("hr");
  const [gds, setGDs] = useState<GD[]>([]);
  const [groups, setGroups] = useState<GDGroup[]>([]);
  const [scores, setScores] = useState<GDScore[]>([]);
  const [candidateNames, setCandidateNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [scoresDialog, setScoresDialog] = useState<GD | null>(null);
  const [updatingStage, setUpdatingStage] = useState<string | null>(null);
  const [analyzingGD, setAnalyzingGD] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/login"); return; }

    const { data: user } = await supabase
      .from("users")
      .select("id, full_name, company_id, role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!user?.company_id) return;
    setCompanyId(user.company_id);
    setUserId(user.id);
    setUserName(user.full_name);
    setUserRole(user.role);

    // Fetch GDs
    const { data: gdData } = await supabase
      .from("group_discussions")
      .select("*")
      .eq("company_id", user.company_id)
      .order("scheduled_date", { ascending: false });

    if (gdData) {
      // Get job titles
      const jobIds = [...new Set(gdData.map((g: any) => g.job_id))];
      const { data: jobsData } = await supabase
        .from("jobs")
        .select("id, title")
        .in("id", jobIds);
      const jobMap = Object.fromEntries((jobsData || []).map(j => [j.id, j.title]));

      setGDs(gdData.map((g: any) => ({ ...g, job_title: jobMap[g.job_id] || "Unknown" })));
    }

    // Fetch groups
    const { data: groupData } = await supabase
      .from("gd_groups")
      .select("*");
    setGroups((groupData as any) || []);

    // Fetch scores
    const { data: scoreData } = await supabase
      .from("gd_scores")
      .select("*");
    setScores((scoreData as any) || []);

    // Get candidate names
    const allCandidateIds = [...new Set((groupData || []).flatMap((g: any) => g.candidate_ids || []))];
    if (allCandidateIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", allCandidateIds);
      setCandidateNames(Object.fromEntries((users || []).map(u => [u.id, u.full_name])));
    }

    setLoading(false);
  }, [navigate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const now = new Date();
  const scheduled = gds.filter(g => g.status === "scheduled");
  const completed = gds.filter(g => g.status === "completed");
  const live = gds.filter(g => {
    if (g.status !== "scheduled") return false;
    const gdDate = new Date(`${g.scheduled_date}T${g.scheduled_time}`);
    const endDate = new Date(gdDate.getTime() + g.duration * 60000);
    return now >= gdDate && now <= endDate;
  });

  const getGroupsForGD = (gdId: string) => groups.filter(g => g.gd_id === gdId);
  const getScoresForGD = (gdId: string) => scores.filter(s => s.gd_id === gdId);
  const getCandidateCount = (gdId: string) => {
    const gdGroups = getGroupsForGD(gdId);
    return gdGroups.reduce((sum, g) => sum + (g.candidate_ids?.length || 0), 0);
  };

  const handleProceed = async (gdId: string, candidateId: string) => {
    setUpdatingStage(candidateId);
    try {
      // Find application for this candidate in the GD's job
      const gd = gds.find(g => g.id === gdId);
      if (!gd) return;
      const { data: app } = await supabase
        .from("applications")
        .select("id")
        .eq("candidate_id", candidateId)
        .eq("job_id", gd.job_id)
        .maybeSingle();

      if (app) {
        await supabase.from("applications").update({ current_stage: "interview" } as any).eq("id", app.id);
        await supabase.from("notifications").insert({
          user_id: candidateId,
          title: "🎉 You cleared Group Discussion!",
          message: "Congratulations! You have been selected to proceed to the HR Interview round. Details will follow shortly.",
        });
        toast({ title: "✅ Candidate Proceeded", description: "Moved to HR Interview stage." });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setUpdatingStage(null);
    fetchData();
  };

  const handleReject = async (gdId: string, candidateId: string) => {
    setUpdatingStage(candidateId);
    try {
      const gd = gds.find(g => g.id === gdId);
      if (!gd) return;
      const { data: app } = await supabase
        .from("applications")
        .select("id")
        .eq("candidate_id", candidateId)
        .eq("job_id", gd.job_id)
        .maybeSingle();

      if (app) {
        await supabase.from("applications").update({ current_stage: "rejected", status: "rejected" } as any).eq("id", app.id);
        await supabase.from("notifications").insert({
          user_id: candidateId,
          title: "Application Update",
          message: "Thank you for participating in the Group Discussion. After careful evaluation, we will not be proceeding with your application at this time. We wish you the best in your career.",
        });
        toast({ title: "Candidate Rejected" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setUpdatingStage(null);
    fetchData();
  };

  const handleAnalyzeGD = async (gd: GD) => {
    setAnalyzingGD(gd.id);
    try {
      const gdGroups = getGroupsForGD(gd.id);
      const groupInfoForAI = gdGroups.map(g => ({
        id: g.id,
        group_name: g.group_name,
        candidate_ids: g.candidate_ids,
      }));

      const { data, error } = await supabase.functions.invoke("analyze-gd", {
        body: {
          gdId: gd.id,
          topic: gd.topic,
          duration: gd.duration,
          candidateNames,
          groupInfo: groupInfoForAI,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "✅ AI Analysis Complete", description: "GD scores generated and candidates notified with personalized feedback." });

      // Notify HR if manager did this
      if (userRole === "manager") {
        const { data: hrUsers } = await supabase
          .from("users")
          .select("id")
          .eq("company_id", companyId)
          .eq("role", "hr");

        for (const hr of (hrUsers || [])) {
          await supabase.from("notifications").insert({
            user_id: hr.id,
            title: "📊 GD Analysis Completed",
            message: `${userName} completed AI analysis for GD: "${gd.topic}" (${gd.job_title}). ${getCandidateCount(gd.id)} candidates were scored. Review the results and proceed candidates to HR Interview.`,
          });
        }
      }

      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setAnalyzingGD(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(userRole === "manager" ? "/manager-dashboard" : "/hr-dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Group Discussions</h1>
              <p className="text-sm text-muted-foreground">Manage and monitor group discussion rounds</p>
            </div>
          </div>
          <Button onClick={() => setPanelOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create New GD
          </Button>
        </div>

        {/* Live Section */}
        {live.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-foreground">Active Now</h2>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
              </span>
              <Badge variant="destructive" className="text-xs">LIVE</Badge>
            </div>
            <div className="grid gap-4">
              {live.map(gd => (
                <Card key={gd.id} className="border-destructive/30 bg-destructive/5">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{gd.topic}</p>
                        <p className="text-sm text-muted-foreground">{gd.job_title} • {getCandidateCount(gd.id)} candidates • {getGroupsForGD(gd.id).length} group(s)</p>
                      </div>
                      <Button size="sm" className="gap-2 bg-primary">
                        <Eye className="h-4 w-4" /> Watch Live
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {/* Scheduled */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Scheduled ({scheduled.length})
          </h2>
          {scheduled.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No GDs scheduled yet. Click "Create New GD" to get started.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {scheduled.map(gd => {
                const gdGroups = getGroupsForGD(gd.id);
                return (
                  <Card key={gd.id}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">{gd.topic}</p>
                          <p className="text-sm text-muted-foreground">{gd.job_title}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {gd.scheduled_date}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {gd.scheduled_time}</span>
                            <span>{gd.duration} min</span>
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {getCandidateCount(gd.id)} candidates</span>
                          </div>
                          {gdGroups.length > 0 && (
                            <div className="flex gap-2 mt-2">
                              {gdGroups.map(g => (
                                <Badge key={g.id} variant="secondary" className="text-xs">
                                  Group {g.group_name}: {g.candidate_ids?.length || 0}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge className="bg-amber-500/10 text-amber-500 border-0">Scheduled</Badge>
                          <Button
                            size="sm"
                            onClick={() => handleAnalyzeGD(gd)}
                            disabled={analyzingGD === gd.id}
                            className="gap-1.5 text-xs"
                          >
                            {analyzingGD === gd.id ? (
                              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing...</>
                            ) : (
                              <><Brain className="h-3.5 w-3.5" /> Complete &amp; Analyze</>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Completed */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" /> Completed ({completed.length})
          </h2>
          {completed.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No completed GDs yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {completed.map(gd => (
                <Card key={gd.id}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{gd.topic}</p>
                        <p className="text-sm text-muted-foreground">{gd.job_title} • {gd.scheduled_date}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setScoresDialog(gd)} className="gap-1 text-xs">
                          <Eye className="h-3.5 w-3.5" /> View Scores
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Create GD Panel */}
      <CreateGDPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        companyId={companyId}
        userId={userId}
        userName={userName}
        userRole={userRole}
        onCreated={fetchData}
      />

      {/* Scores Dialog */}
      <Dialog open={!!scoresDialog} onOpenChange={() => setScoresDialog(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>GD Scores — {scoresDialog?.topic}</DialogTitle>
          </DialogHeader>
          {scoresDialog && (() => {
            const gdScores = getScoresForGD(scoresDialog.id);
            const gdGroups = getGroupsForGD(scoresDialog.id);

            return (
              <div className="space-y-4">
                {gdGroups.map(group => {
                  const groupScores = gdScores
                    .filter(s => group.candidate_ids?.includes(s.candidate_id))
                    .sort((a, b) => (b.overall_gd_score || 0) - (a.overall_gd_score || 0));

                  return (
                    <div key={group.id}>
                      <h3 className="text-sm font-semibold text-foreground mb-2">Group {group.group_name}</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Rank</TableHead>
                            <TableHead>Candidate</TableHead>
                            <TableHead>Score</TableHead>
                            <TableHead>Speaking%</TableHead>
                            <TableHead>Quality</TableHead>
                            <TableHead>Leadership</TableHead>
                            <TableHead>Verdict</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupScores.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center text-muted-foreground">
                                No scores yet for this group.
                              </TableCell>
                            </TableRow>
                          ) : (
                            groupScores.map((s, idx) => (
                              <TableRow key={s.id} className={idx < Math.ceil(groupScores.length / 3) ? "bg-primary/5" : ""}>
                                <TableCell className="font-bold">#{idx + 1}</TableCell>
                                <TableCell className="font-medium">{candidateNames[s.candidate_id] || "Unknown"}</TableCell>
                                <TableCell>
                                  <span className={`font-bold ${s.overall_gd_score >= 70 ? "text-primary" : s.overall_gd_score >= 50 ? "text-amber-500" : "text-destructive"}`}>
                                    {s.overall_gd_score}
                                  </span>
                                </TableCell>
                                <TableCell>{s.speaking_percentage}%</TableCell>
                                <TableCell>{s.points_quality}/10</TableCell>
                                <TableCell>{s.leadership_score}/10</TableCell>
                                <TableCell>
                                  <Badge variant={s.verdict === "strong" ? "default" : s.verdict === "average" ? "secondary" : "destructive"} className="text-xs">
                                    {s.verdict}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleProceed(scoresDialog.id, s.candidate_id)}
                                      disabled={updatingStage === s.candidate_id}
                                      className="text-primary text-xs gap-1"
                                    >
                                      <CheckCircle className="h-3.5 w-3.5" /> Proceed
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleReject(scoresDialog.id, s.candidate_id)}
                                      disabled={updatingStage === s.candidate_id}
                                      className="text-destructive text-xs gap-1"
                                    >
                                      <XCircle className="h-3.5 w-3.5" /> Reject
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })}

                {/* Candidates without scores */}
                {gdGroups.length > 0 && gdScores.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Scores will appear here after the GD is completed and AI analysis is done.
                  </p>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GDDashboard;
