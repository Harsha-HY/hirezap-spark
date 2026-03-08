import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Zap, LayoutDashboard, Briefcase, MessageSquare, Settings,
  Bell, User, LogOut, CheckCircle2, Clock, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const stages = [
  { key: "applied", label: "Applied", icon: "✅" },
  { key: "resume_review", label: "Resume Review", icon: "⏳" },
  { key: "aptitude_test", label: "Aptitude Test", icon: "🔒" },
  { key: "video_intro", label: "Video Introduction", icon: "🔒" },
  { key: "group_discussion", label: "Group Discussion", icon: "🔒" },
  { key: "technical_round", label: "Technical Round", icon: "🔒" },
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
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSidebar, setActiveSidebar] = useState("Dashboard");
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

    if (apps) setApplications(apps as unknown as Application[]);

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
                    const rawStage = applications[0].current_stage;
                    const normalizedStage = rawStage === "applied" || rawStage === "ai_scored" ? "resume_review" : rawStage;
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
                          {isCurrent && stage.key === "aptitude_test" && (
                            <Button
                              size="sm"
                              onClick={() => navigate("/aptitude-test")}
                              className="bg-primary text-primary-foreground h-7 px-3 text-xs"
                            >
                              🎯 Take Test
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
                    <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
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
        </main>
      </div>
    </div>
  );
};

export default CandidateDashboard;
