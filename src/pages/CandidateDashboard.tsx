import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Zap, LayoutDashboard, Briefcase, MessageSquare, Settings,
  Bell, User, LogOut, CheckCircle2, Clock, Lock, FileText,
  Upload, Video, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import NegotiationChat from "@/components/NegotiationChat";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const stages = [
  { key: "applied", label: "Applied", icon: "✅" },
  { key: "resume_review", label: "Resume Review", icon: "⏳" },
  { key: "aptitude_test", label: "Aptitude Test", icon: "🔒" },
  { key: "video_intro", label: "Video Introduction", icon: "🔒" },
  { key: "technical_round", label: "Technical Round", icon: "🔒" },
  { key: "group_discussion", label: "Group Discussion", icon: "🔒" },
  { key: "hr_interview", label: "HR Interview", icon: "🔒" },
  { key: "offer_letter", label: "Offer Letter", icon: "🔒" },
];

const sidebarLinks = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Briefcase, label: "My Applications" },
  { icon: MessageSquare, label: "Messages" },
  { icon: Settings, label: "Settings" },
];

interface Application {
  id: string;
  current_stage: string;
  status: string;
  applied_at: string;
  job_id: string;
  resume_url?: string | null;
  jobs?: { title: string; company_id: string; companies?: { company_name: string } | null } | null;
}

const CandidateDashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [submittedTestAppIds, setSubmittedTestAppIds] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSidebar, setActiveSidebar] = useState("Dashboard");
  const [offerLetter, setOfferLetter] = useState<any>(null);
  const [companyName, setCompanyName] = useState("");
  const [interviews, setInterviews] = useState<any[]>([]);
  const [bgvDocs, setBgvDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [negotiationOpen, setNegotiationOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: userData } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!userData) return;
    setUser(userData);

    const { data: apps } = await supabase
      .from("applications")
      .select("*, jobs(title, company_id, companies(company_name))")
      .eq("candidate_id", userData.id)
      .order("applied_at", { ascending: false });

    if (apps) {
      const appRows = apps as unknown as Application[];
      setApplications(appRows);

      const appIds = appRows.map((a) => a.id);
      if (appIds.length > 0) {
        const { data: answerRows } = await supabase
          .from("test_answers")
          .select("application_id")
          .in("application_id", appIds);

        setSubmittedTestAppIds(new Set((answerRows || []).map((r: any) => r.application_id)));
      } else {
        setSubmittedTestAppIds(new Set());
      }
    }

    // Fetch offer letters, interviews, BGV docs
    const { data: offers } = await supabase
      .from("offer_letters")
      .select("*")
      .eq("candidate_id", userData.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (offers?.length) {
      setOfferLetter(offers[0]);
      // Get company name
      const { data: comp } = await supabase.from("companies").select("company_name").eq("id", (offers[0] as any).company_id).maybeSingle();
      if (comp) setCompanyName(comp.company_name);
    }

    const { data: interviewData } = await supabase
      .from("interviews")
      .select("*")
      .eq("candidate_id", userData.id)
      .order("scheduled_date", { ascending: false });
    if (interviewData) setInterviews(interviewData as any);

    const { data: bgvData } = await supabase
      .from("bgv_documents")
      .select("*")
      .eq("candidate_id", userData.id);
    if (bgvData) setBgvDocs(bgvData as any);

    const { data: notifs } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userData.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (notifs) setNotifications(notifs);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const getStageIndex = (stage: string) => stages.findIndex((s) => s.key === stage);

  const handleSidebarClick = (label: string) => {
    setActiveSidebar(label);
    if (label === "My Applications") document.getElementById("my-applications")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (label === "Messages") document.getElementById("messages")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (label === "Settings") document.getElementById("settings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (label === "Dashboard") document.getElementById("dashboard-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const viewResume = async (resumeRef: string | null | undefined) => {
    if (!resumeRef) return;
    if (resumeRef.startsWith("http")) {
      window.open(resumeRef, "_blank", "noopener,noreferrer");
      return;
    }
    const { data, error } = await supabase.storage.from("resumes").createSignedUrl(resumeRef, 60);
    if (error || !data?.signedUrl) return;
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar-background">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-extrabold text-foreground">
              Hire<span className="text-primary">Zap</span>
            </h1>
            <Zap className="h-5 w-5 text-primary fill-primary" />
          </div>
          <p className="text-xs text-primary font-medium">Candidate Portal</p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {sidebarLinks.map(({ icon: Icon, label }) => (
            <button
              key={label}
              onClick={() => handleSidebarClick(label)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                activeSidebar === label
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.full_name}</p>
              <p className="text-xs text-muted-foreground">Candidate</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top navbar */}
        <header className="flex items-center justify-between border-b border-border px-6 py-4 bg-card/50 backdrop-blur-sm">
          <h2 className="text-xl font-bold text-foreground">Candidate Dashboard</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" />
              {notifications.some((n) => !n.read) && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive border-2 border-card" />
              )}
            </div>
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Welcome */}
          <motion.div id="dashboard-top" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className="text-2xl font-bold text-foreground">
              Welcome back, <span className="text-primary">{user?.full_name?.split(" ")[0]}</span>
            </h3>
            <p className="text-muted-foreground mt-1">Track your application progress and upcoming steps.</p>
          </motion.div>

          {/* Progress Timeline for most recent application */}
          {applications.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <h4 className="text-lg font-bold text-foreground mb-1">Application Journey</h4>
              <p className="text-sm text-muted-foreground mb-6">
                {(applications[0] as any)?.jobs?.title} — {(applications[0] as any)?.jobs?.companies?.company_name}
              </p>

              <div className="relative">
                {/* Line */}
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

                <div className="space-y-4">
                  {stages.map((stage, idx) => {
                    const latestApplication = applications[0];
                    const rawStage = latestApplication.current_stage;
                    const hasSubmittedCurrentTest = submittedTestAppIds.has(latestApplication.id);
                    const normalizedStage = 
                      rawStage === "applied" || rawStage === "ai_scored" ? "resume_review" 
                      : rawStage === "test_completed" ? "video_intro"
                      : rawStage === "aptitude_test" && hasSubmittedCurrentTest ? "video_intro"
                      : rawStage === "shortlisted" ? "aptitude_test"
                      : rawStage === "video_submitted" ? "technical_round"
                      : rawStage === "technical_round" ? "technical_round"
                      : rawStage === "technical_test" ? "technical_round"
                      : rawStage === "technical_completed" ? "group_discussion"
                      : rawStage === "interview" ? "hr_interview"
                      : rawStage === "selected" ? "offer_letter"
                      : rawStage;
                    const currentIdx = getStageIndex(normalizedStage);
                    const isCompleted = idx < currentIdx;
                    const isCurrent = idx === currentIdx;

                    return (
                      <div key={stage.key} className="relative flex items-center gap-4 pl-2">
                        <div
                          className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                            isCompleted
                              ? "border-primary bg-primary/20"
                              : isCurrent
                              ? "border-yellow-500 bg-yellow-500/20 animate-pulse"
                              : "border-border bg-card"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          ) : isCurrent ? (
                            <Clock className="h-5 w-5 text-yellow-500" />
                          ) : (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-sm font-medium ${
                              isCompleted
                                ? "text-primary"
                                : isCurrent
                                ? "text-yellow-500"
                                : "text-muted-foreground"
                            }`}
                          >
                            {stage.label}
                          </span>
                          {isCurrent && stage.key === "aptitude_test" && !hasSubmittedCurrentTest && (
                            <Button
                              size="sm"
                              onClick={() => navigate("/aptitude-test")}
                              className="bg-primary text-primary-foreground h-7 px-3 text-xs"
                            >
                              🎯 Take Test
                            </Button>
                          )}
                          {isCurrent && stage.key === "video_intro" && (
                            <Button
                              size="sm"
                              onClick={() => navigate("/video-intro")}
                              className="bg-primary text-primary-foreground h-7 px-3 text-xs"
                            >
                              🎥 Record Video
                            </Button>
                          )}
                          {isCurrent && stage.key === "technical_round" && rawStage === "technical_test" && (
                            <Button
                              size="sm"
                              onClick={() => navigate("/technical-test")}
                              className="bg-primary text-primary-foreground h-7 px-3 text-xs"
                            >
                              💻 Take Technical Test
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Applications Table */}
          <motion.div
            id="my-applications"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <h4 className="text-lg font-bold text-foreground mb-4">My Applications</h4>

            {applications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No applications yet.</p>
                <Button
                  variant="ghost"
                  onClick={() => navigate("/jobs")}
                  className="mt-3 text-primary hover:text-primary/90"
                >
                  Browse Jobs
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-3 px-3 font-medium">Job Title</th>
                      <th className="text-left py-3 px-3 font-medium">Company</th>
                      <th className="text-left py-3 px-3 font-medium">Stage</th>
                      <th className="text-left py-3 px-3 font-medium">Status</th>
                      <th className="text-left py-3 px-3 font-medium">Resume</th>
                      <th className="text-left py-3 px-3 font-medium">Applied</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app) => (
                      <tr key={app.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-3 text-foreground font-medium">
                          {(app as any)?.jobs?.title || "—"}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">
                          {(app as any)?.jobs?.companies?.company_name || "—"}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">
                            {app.current_stage.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                              app.status === "active"
                                ? "bg-primary/10 text-primary"
                                : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            {app.status}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {app.resume_url ? (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-primary hover:text-primary" onClick={() => viewResume(app.resume_url)}>
                              View
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">
                          {new Date(app.applied_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>

          {/* Upcoming Interviews */}
          {interviews.filter(i => i.status === "scheduled").length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
              <h4 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">📅 Upcoming Interviews</h4>
              <div className="space-y-3">
                {interviews.filter(i => i.status === "scheduled").map(interview => (
                  <div key={interview.id} className="rounded-xl border border-border bg-card p-4">
                    <p className="font-medium text-foreground">{interview.round_type.replace(/_/g, " ")}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span>📅 {interview.scheduled_date}</span>
                      <span>⏰ {interview.scheduled_time}</span>
                      <span>⏱ {interview.duration} min</span>
                      <span>📍 {interview.mode.replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">With: {interview.interviewer_name}</p>
                    {interview.meeting_link && (
                      <a href={interview.meeting_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-sm text-primary hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" /> Join Meeting
                      </a>
                    )}
                    {interview.notes && <p className="text-xs text-muted-foreground mt-2 italic">{interview.notes}</p>}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Offer Letter Card */}
          {offerLetter && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }} className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-6">
              <h4 className="text-lg font-bold text-foreground mb-2">🎉 Congratulations!</h4>
              <p className="text-sm text-muted-foreground mb-4">You received an offer from <span className="font-semibold text-foreground">{companyName}</span>!</p>
              
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div><span className="text-muted-foreground">Role:</span> <span className="font-medium text-foreground">{offerLetter.designation}</span></div>
                <div><span className="text-muted-foreground">CTC:</span> <span className="font-medium text-foreground">₹{Number(offerLetter.ctc_total).toLocaleString()}/yr</span></div>
                <div><span className="text-muted-foreground">Joining:</span> <span className="font-medium text-foreground">{offerLetter.joining_date}</span></div>
                <div><span className="text-muted-foreground">Accept by:</span> <span className="font-medium text-foreground">{offerLetter.accept_by}</span></div>
                <div><span className="text-muted-foreground">Location:</span> <span className="font-medium text-foreground">{offerLetter.work_location}</span></div>
                <div><span className="text-muted-foreground">Type:</span> <span className="font-medium text-foreground">{offerLetter.work_type}</span></div>
              </div>

              {offerLetter.status === "sent" && (
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={async () => {
                    await supabase.from("offer_letters").update({ status: "accepted", accepted_at: new Date().toISOString() } as any).eq("id", offerLetter.id);
                    await supabase.from("applications").update({ current_stage: "hired", status: "hired" }).eq("id", offerLetter.application_id);
                    // Notify HR
                    const { data: hrUsers } = await supabase.from("users").select("id").eq("role", "hr").eq("company_id", offerLetter.company_id);
                    for (const hr of (hrUsers || [])) {
                      await supabase.from("notifications").insert({ user_id: hr.id, title: "🎉 Offer Accepted!", message: `${user?.full_name} accepted the offer! Joining: ${offerLetter.joining_date}` });
                    }
                    toast({ title: "🎉 Offer Accepted!", description: "Welcome aboard!" });
                    fetchData();
                  }} className="gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Accept Offer
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setNegotiationOpen(true)} className="gap-1">
                    💬 Negotiate
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeclineOpen(true)} className="text-destructive gap-1">
                    ❌ Decline
                  </Button>
                </div>
              )}
              {offerLetter.status === "accepted" && (
                <p className="text-sm font-semibold text-primary">✅ Offer Accepted</p>
              )}
              {offerLetter.status === "declined" && (
                <p className="text-sm font-semibold text-destructive">Offer Declined</p>
              )}
            </motion.div>
          )}

          {/* Decline Dialog */}
          {declineOpen && offerLetter && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-background/80 flex items-center justify-center p-4">
              <div className="rounded-2xl border border-border bg-card p-6 w-full max-w-sm space-y-4">
                <h4 className="text-lg font-bold text-foreground">Decline Offer</h4>
                <Select value={declineReason} onValueChange={setDeclineReason}>
                  <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Got better offer">Got better offer</SelectItem>
                    <SelectItem value="Personal reasons">Personal reasons</SelectItem>
                    <SelectItem value="Location issue">Location issue</SelectItem>
                    <SelectItem value="Salary not matching">Salary not matching</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDeclineOpen(false)} className="flex-1">Cancel</Button>
                  <Button variant="destructive" onClick={async () => {
                    await supabase.from("offer_letters").update({ status: "declined", decline_reason: declineReason } as any).eq("id", offerLetter.id);
                    const { data: hrUsers } = await supabase.from("users").select("id").eq("role", "hr").eq("company_id", offerLetter.company_id);
                    for (const hr of (hrUsers || [])) {
                      await supabase.from("notifications").insert({ user_id: hr.id, title: "❌ Offer Declined", message: `${user?.full_name} declined the offer. Reason: ${declineReason}` });
                    }
                    toast({ title: "Offer Declined" });
                    setDeclineOpen(false);
                    fetchData();
                  }} className="flex-1">Confirm Decline</Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* BGV Documents */}
          {applications[0]?.current_stage === "hired" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-2xl border border-border bg-card p-6">
              <h4 className="text-lg font-bold text-foreground mb-2">📋 Document Submission (BGV)</h4>
              <p className="text-sm text-muted-foreground mb-4">Please upload the following documents for verification.</p>

              {["Degree Certificate", "Experience Letter", "Last 3 Salary Slips", "Aadhaar Card", "PAN Card", "Bank Details"].map(docType => {
                const existing = bgvDocs.find(d => d.document_type === docType);
                return (
                  <div key={docType} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      {existing ? (
                        <CheckCircle2 className={`h-4 w-4 ${existing.verified ? "text-primary" : "text-amber-500"}`} />
                      ) : (
                        <div className="h-4 w-4 rounded border border-border" />
                      )}
                      <span className="text-sm text-foreground">{docType}</span>
                      {existing?.verified && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Verified</span>}
                    </div>
                    {existing ? (
                      <span className="text-xs text-primary">Uploaded</span>
                    ) : (
                      <label className="cursor-pointer">
                        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !user || !applications[0]) return;
                          setUploading(docType);
                          const path = `${user.id}/${docType.replace(/ /g, "_")}_${Date.now()}.${file.name.split(".").pop()}`;
                          const { error: uploadError } = await supabase.storage.from("bgv-documents").upload(path, file);
                          if (uploadError) { toast({ title: "Upload Error", description: uploadError.message, variant: "destructive" }); setUploading(null); return; }
                          await supabase.from("bgv_documents").insert({ application_id: applications[0].id, candidate_id: user.id, document_type: docType, file_url: path } as any);
                          toast({ title: "✅ Uploaded", description: `${docType} uploaded successfully.` });
                          setUploading(null);
                          fetchData();
                        }} />
                        <span className="text-xs text-primary hover:underline flex items-center gap-1">
                          {uploading === docType ? <span className="animate-spin">⏳</span> : <Upload className="h-3 w-3" />}
                          Upload
                        </span>
                      </label>
                    )}
                  </div>
                );
              })}

              <div className="mt-3">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${(bgvDocs.length / 6) * 100}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{bgvDocs.length}/6 documents uploaded</p>
              </div>
            </motion.div>
          )}

          {/* Onboarding */}
          {applications[0]?.current_stage === "onboarded" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6">
              <h4 className="text-lg font-bold text-foreground mb-2">🎉 Welcome to {companyName}!</h4>
              <p className="text-sm text-muted-foreground mb-4">Your Day 1 Schedule:</p>
              <div className="space-y-2">
                {[
                  { time: "9:00 AM", task: "Collect laptop & ID card" },
                  { time: "10:00 AM", task: "HR induction" },
                  { time: "11:00 AM", task: "Meet your team" },
                  { time: "2:00 PM", task: "System setup & access" },
                  { time: "4:00 PM", task: "30-60-90 day plan discussion" },
                ].map(item => (
                  <div key={item.time} className="flex items-center gap-3 text-sm">
                    <span className="font-mono text-xs text-muted-foreground w-20">{item.time}</span>
                    <span className="text-foreground">{item.task}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Messages */}
          <motion.div
            id="messages"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <h4 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Messages from HR
            </h4>

            {notifications.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No messages yet.</p>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      n.read ? "border-border bg-card" : "border-primary/30 bg-primary/5"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div id="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="rounded-2xl border border-border bg-card p-6">
            <h4 className="text-lg font-bold text-foreground mb-2">Settings</h4>
            <p className="text-sm text-muted-foreground">Profile and notification settings will appear here.</p>
          </motion.div>

          {/* Negotiation Chat */}
          {offerLetter && (
            <NegotiationChat
              offerId={offerLetter.id}
              currentUserId={user?.id || ""}
              currentUserRole="candidate"
              currentUserName={user?.full_name || ""}
              open={negotiationOpen}
              onOpenChange={setNegotiationOpen}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default CandidateDashboard;
