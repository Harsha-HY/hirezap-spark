import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Zap, BarChart3, Settings, Bell, LogOut, Plus, Users, Briefcase,
  MessageSquare, UserCheck, UserCog, LayoutDashboard, Menu, X, Eye, CheckCircle,
  ArrowLeft, Clock, Award, BookOpen, Play, Code2, CheckCheck, AlertTriangle, FileText,
  XCircle, Trash2, RotateCcw, MapPin, Mail, Phone, ArrowRight, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";
import AddUserPanel from "@/components/AddUserPanel";
import UserDetailsModal from "@/components/UserDetailsModal";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  department?: string | null;
  role: string;
  created_at: string;
  company_id?: string;
}

const stageLabel: Record<string, string> = {
  applied: "Applied",
  ai_scored: "AI Scored",
  shortlisted: "Shortlisted",
  aptitude_test: "Aptitude Test",
  test_completed: "Test Done",
  video_intro: "Video Intro",
  video_submitted: "Video Done",
  technical_round: "Technical Round",
  technical_test: "Technical Test",
  technical_completed: "Technical Done",
  group_discussion: "Group Discussion",
  gd_completed: "GD Completed",
  hr_interview: "HR Interview",
  interview: "HR Interview",
  offer_sent: "Offer Sent",
  hired: "Hired",
  bgv: "BGV Pending",
  onboarded: "Onboarded",
  selected: "Selected",
  rejected: "Rejected",
};

const stageBadgeClass: Record<string, string> = {
  applied: "bg-muted text-muted-foreground",
  ai_scored: "bg-blue-500/10 text-blue-500",
  shortlisted: "bg-amber-500/10 text-amber-500",
  aptitude_test: "bg-purple-500/10 text-purple-500",
  test_completed: "bg-primary/10 text-primary",
  video_intro: "bg-pink-500/10 text-pink-500",
  video_submitted: "bg-emerald-500/10 text-emerald-500",
  technical_round: "bg-orange-500/10 text-orange-500",
  technical_test: "bg-orange-500/10 text-orange-500",
  technical_completed: "bg-teal-500/10 text-teal-500",
  group_discussion: "bg-cyan-500/10 text-cyan-500",
  gd_completed: "bg-cyan-500/10 text-cyan-500",
  hr_interview: "bg-indigo-500/10 text-indigo-500",
  interview: "bg-indigo-500/10 text-indigo-500",
  offer_sent: "bg-emerald-500/10 text-emerald-500",
  hired: "bg-primary/10 text-primary",
  bgv: "bg-amber-500/10 text-amber-500",
  onboarded: "bg-primary/10 text-primary",
  selected: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
};

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: UserCheck, label: "HR Managers" },
  { icon: UserCog, label: "Hiring Managers" },
  { icon: Bell, label: "Team Activity" },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [adminName, setAdminName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [hrManagers, setHrManagers] = useState<UserRow[]>([]);
  const [hiringManagers, setHiringManagers] = useState<UserRow[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelType, setPanelType] = useState<"hr" | "manager">("hr");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Dynamic stats & Activity states
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [totalJobsOpen, setTotalJobsOpen] = useState(0);
  const [totalSelected, setTotalSelected] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Manager Dashboard Impersonation States
  const [viewingManager, setViewingManager] = useState<UserRow | null>(null);
  const [managerJobs, setManagerJobs] = useState<any[]>([]);
  const [managerApplications, setManagerApplications] = useState<any[]>([]);
  const [managerStats, setManagerStats] = useState({
    jobsCount: 0,
    candidatesCount: 0,
    selectedCount: 0,
    pendingCount: 0,
  });
  const [managerActiveTab, setManagerActiveTab] = useState<"overview" | "jobs" | "candidates">("overview");

  // Candidate Inspection States
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [testResultDialog, setTestResultDialog] = useState<any>(null);
  const [testAnswers, setTestAnswers] = useState<any[]>([]);
  const [testViolations, setTestViolations] = useState<any[]>([]);
  const [testQuestions, setTestQuestions] = useState<any[]>([]);
  const [testSections, setTestSections] = useState<any[]>([]);
  const [candidatePhotoUrl, setCandidatePhotoUrl] = useState<string | null>(null);
  const [videoDialog, setVideoDialog] = useState<any>(null);
  const [videoSignedUrl, setVideoSignedUrl] = useState<string | null>(null);
  const [technicalReportDialog, setTechnicalReportDialog] = useState<any>(null);
  const [technicalAssessment, setTechnicalAssessment] = useState<any>(null);
  const [techViolations, setTechViolations] = useState<any[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: user } = await supabase
      .from("users")
      .select("full_name, company_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (user) {
      setAdminName(user.full_name);
      if (user.company_id) {
        setCompanyId(user.company_id);
        const { data: company } = await supabase
          .from("companies")
          .select("company_name")
          .eq("id", user.company_id)
          .maybeSingle();
        if (company) setCompanyName(company.company_name);

        const { data: hrs } = await supabase
          .from("users")
          .select("*")
          .eq("role", "hr")
          .eq("company_id", user.company_id)
          .order("created_at", { ascending: false });
        if (hrs) setHrManagers(hrs);

        const { data: managers } = await supabase
          .from("users")
          .select("*")
          .eq("role", "manager")
          .eq("company_id", user.company_id)
          .order("created_at", { ascending: false });
        if (managers) setHiringManagers(managers);

        // Fetch jobs for stats
        const { data: jobs } = await supabase
          .from("jobs")
          .select("id, status")
          .eq("company_id", user.company_id);

        if (jobs) {
          setTotalJobsOpen(jobs.filter(j => j.status === "open").length);
          const jobIds = jobs.map(j => j.id);
          
          if (jobIds.length > 0) {
            const { data: apps } = await supabase
              .from("applications")
              .select("id, current_stage")
              .in("job_id", jobIds);

            if (apps) {
              setTotalCandidates(apps.length);
              setTotalSelected(apps.filter(a => a.current_stage === "hired" || a.current_stage === "selected").length);
            }
          }
        }

        // Fetch Superadmin's notifications representing team activities
        const { data: adminNotifs } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });
        if (adminNotifs) {
          setNotifications(adminNotifs);
        }
      }
    }
  };

  const fetchManagerDashboardData = async (manager: UserRow) => {
    try {
      let jobsQuery = supabase.from("jobs").select("*").eq("company_id", companyId);
      if (manager.role === "hr") {
        jobsQuery = jobsQuery.eq("posted_by", manager.id);
      } else {
        jobsQuery = jobsQuery.eq("manager_id", manager.id);
      }
      
      const { data: jobsData, error: jobsErr } = await jobsQuery.order("created_at", { ascending: false });
      if (jobsErr) throw jobsErr;
      
      const jobsList = jobsData || [];
      setManagerJobs(jobsList);
      
      if (jobsList.length === 0) {
        setManagerApplications([]);
        setManagerStats({ jobsCount: 0, candidatesCount: 0, selectedCount: 0, pendingCount: 0 });
        return;
      }
      
      const jobIds = jobsList.map(j => j.id);
      const jobMap = Object.fromEntries(jobsList.map(j => [j.id, j.title]));
      
      const { data: appsData, error: appsErr } = await supabase
        .from("applications")
        .select("*")
        .in("job_id", jobIds)
        .order("applied_at", { ascending: false });
        
      if (appsErr) throw appsErr;
      
      const appsList = appsData || [];
      
      const candidateIds = [...new Set(appsList.map(a => a.candidate_id))];
      let enrichedApps: any[] = [];
      
      if (candidateIds.length > 0) {
        const { data: candidates, error: candErr } = await supabase
          .from("users")
          .select("id, full_name, email")
          .in("id", candidateIds);
          
        if (!candErr && candidates) {
          const candidateMap = Object.fromEntries(candidates.map(c => [c.id, { name: c.full_name, email: c.email }]));
          enrichedApps = appsList.map(a => ({
            ...a,
            candidate_name: candidateMap[a.candidate_id]?.name || "Unknown",
            candidate_email: candidateMap[a.candidate_id]?.email || "",
            job_title: jobMap[a.job_id] || "Unknown Job",
          }));
        }
      } else {
        enrichedApps = appsList.map(a => ({
          ...a,
          candidate_name: "Unknown",
          candidate_email: "",
          job_title: jobMap[a.job_id] || "Unknown Job",
        }));
      }
      
      setManagerApplications(enrichedApps);
      
      const selected = enrichedApps.filter(a => a.current_stage === "hired" || a.current_stage === "selected" || a.status === "hired" || a.status === "selected").length;
      const pending = enrichedApps.filter(a => a.status === "active" && a.current_stage !== "hired" && a.current_stage !== "selected").length;
      
      setManagerStats({
        jobsCount: jobsList.length,
        candidatesCount: enrichedApps.length,
        selectedCount: selected,
        pendingCount: pending,
      });
      
    } catch (err) {
      console.error("Error fetching manager dashboard data:", err);
      toast({ title: "Error", description: "Failed to fetch manager dashboard stats", variant: "destructive" });
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (viewingManager && companyId) {
      fetchManagerDashboardData(viewingManager);
    }
  }, [viewingManager, companyId]);

  // Candidate Inspection Handlers
  const handleViewResume = async (url: string | null) => {
    if (!url) {
      toast({ title: "No Resume", description: "This candidate did not upload a resume." });
      return;
    }

    let storagePath = url;

    if (url.startsWith("http")) {
      const marker = "/object/public/resumes/";
      const markerAlt = "/object/sign/resumes/";
      let idx = url.indexOf(marker);
      if (idx !== -1) {
        storagePath = decodeURIComponent(url.substring(idx + marker.length));
      } else {
        idx = url.indexOf(markerAlt);
        if (idx !== -1) {
          storagePath = decodeURIComponent(url.substring(idx + markerAlt.length));
        }
      }
    }

    const { data, error } = await supabase.storage.from("resumes").createSignedUrl(storagePath, 3600);
    if (data?.signedUrl) {
      setResumeUrl(data.signedUrl);
      setResumeDialogOpen(true);
    } else {
      console.error("Signed URL error:", error, "path:", storagePath);
      toast({ title: "Error", description: "Could not load resume.", variant: "destructive" });
    }
  };

  const handleViewTestResults = async (app: any) => {
    setTestResultDialog(app);
    setTestQuestions([]);
    setTestSections([]);
    setCandidatePhotoUrl(null);

    const [answersRes, violsRes, assessmentRes] = await Promise.all([
      supabase.from("test_answers").select("*").eq("application_id", app.id).order("question_index", { ascending: true }),
      supabase.from("test_violations").select("*").eq("application_id", app.id).order("created_at", { ascending: true }),
      supabase.from("assessments").select("questions").eq("application_id", app.id).maybeSingle(),
    ]);

    setTestAnswers(answersRes.data || []);
    setTestViolations(violsRes.data || []);

    if (assessmentRes.data?.questions) {
      const q = assessmentRes.data.questions as any;
      if (q.sections) {
        setTestSections(q.sections);
        const flat: any[] = [];
        q.sections.forEach((sec: any) => {
          sec.questions.forEach((question: any) => {
            flat.push({ ...question, section: sec.name });
          });
        });
        setTestQuestions(flat);
      }
    }

    if (app.photo_url) {
      if (app.photo_url.startsWith("http")) {
        setCandidatePhotoUrl(app.photo_url);
      } else {
        const { data: photoData } = await supabase.storage.from("photos").getPublicUrl(app.photo_url);
        if (photoData?.publicUrl) setCandidatePhotoUrl(photoData.publicUrl);
      }
    }
  };

  const handleViewVideo = async (app: any) => {
    setVideoDialog(app);
    setVideoSignedUrl(null);
    if (app.video_url) {
      const { data } = await supabase.storage.from("videos").createSignedUrl(app.video_url, 3600);
      if (data?.signedUrl) {
        setVideoSignedUrl(data.signedUrl);
      }
    }
  };

  const handleViewTechReport = async (app: any) => {
    setTechnicalReportDialog(app);
    setTechnicalAssessment(null);
    setTechViolations([]);

    const [assessmentRes, violationsRes] = await Promise.all([
      supabase.from("assessments").select("questions").eq("application_id", app.id).eq("type", "technical").maybeSingle(),
      supabase.from("test_violations").select("*").eq("application_id", app.id).order("created_at", { ascending: true }),
    ]);
    setTechnicalAssessment(assessmentRes.data?.questions || null);
    setTechViolations(violationsRes.data || []);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const openPanel = (type: "hr" | "manager") => {
    setPanelType(type);
    setPanelOpen(true);
  };

  const handleViewDetails = (user: UserRow) => {
    setSelectedUser({ ...user, company_id: companyId });
    setDetailsModalOpen(true);
  };

  const handleNavClick = (label: string) => {
    setActiveNav(label);
    setViewingManager(null);
  };

  const stats = [
    { icon: UserCheck, label: "Total HR Managers", value: hrManagers.length, color: "text-primary" },
    { icon: UserCog, label: "Total Hiring Managers", value: hiringManagers.length, color: "text-blue-400" },
    { icon: Users, label: "Total Candidates", value: totalCandidates, color: "text-amber-400" },
    { icon: Briefcase, label: "Total Jobs Open", value: totalJobsOpen, color: "text-purple-400" },
    { icon: CheckCircle, label: "Selected Students", value: totalSelected, color: "text-emerald-400" },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {sidebarOpen && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-20 bg-black/50"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        <motion.aside
          initial={{ x: -260 }}
          animate={{ x: sidebarOpen ? 0 : -260 }}
          exit={{ x: -260 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r border-border bg-card ${
            sidebarOpen ? "visible" : "invisible"
          }`}
        >
          <div className="px-5 py-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Zap className="h-7 w-7 text-primary fill-primary" />
                <span className="text-xl font-extrabold tracking-tight text-foreground">
                  Hire<span className="text-primary">Zap</span>
                </span>
              </div>
              {isMobile && (
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-lg hover:bg-secondary p-2 transition-colors"
                >
                  <X className="h-5 w-5 text-foreground" />
                </button>
              )}
            </div>
            {companyName && (
              <p className="text-xs text-primary mt-2 truncate">{companyName}</p>
            )}
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            {navItems.map(({ icon: Icon, label }) => (
              <button
                key={label}
                onClick={() => handleNavClick(label)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeNav === label
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>

          <div className="border-t border-border px-4 py-4">
            <p className="text-sm font-medium text-foreground truncate">{adminName || "Admin"}</p>
            <p className="text-xs text-muted-foreground mb-3">Super Admin</p>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </motion.aside>
      </AnimatePresence>

      {/* Main */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        sidebarOpen && !isMobile ? "md:ml-60" : ""
      }`}>
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-4 md:px-8 py-4">
          <div className="flex items-center gap-4">
            {(!sidebarOpen || isMobile) && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="rounded-lg hover:bg-secondary p-2 transition-colors md:hidden"
              >
                <Menu className="h-5 w-5 text-foreground" />
              </button>
            )}
            <h1 className="text-xl font-bold text-foreground">Super Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
            </button>
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
              {adminName?.charAt(0)?.toUpperCase() || "A"}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {viewingManager ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Back Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-border gap-4">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={() => setViewingManager(null)} className="h-9 w-9">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Viewing: {viewingManager.full_name}</h2>
                    <p className="text-xs text-muted-foreground capitalize">
                      {viewingManager.role === "hr" ? "HR Manager" : "Hiring Manager"} Dashboard • {viewingManager.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleViewDetails(viewingManager)}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View Profile
                  </Button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-muted-foreground">Jobs Posted/Managed</span>
                    <Briefcase className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{managerStats.jobsCount}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-muted-foreground">Total Candidates</span>
                    <Users className="h-4 w-4 text-blue-400" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{managerStats.candidatesCount}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-muted-foreground">Selected Candidates</span>
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                  </div>
                  <p className="text-2xl font-bold text-emerald-400">{managerStats.selectedCount}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-muted-foreground">Pending Candidates</span>
                    <Clock className="h-4 w-4 text-amber-400" />
                  </div>
                  <p className="text-2xl font-bold text-amber-400">{managerStats.pendingCount}</p>
                </div>
              </div>

              {/* Sub Navigation */}
              <div className="flex border-b border-border">
                <button
                  onClick={() => setManagerActiveTab("overview")}
                  className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
                    managerActiveTab === "overview"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Overview & Activities
                </button>
                <button
                  onClick={() => setManagerActiveTab("jobs")}
                  className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
                    managerActiveTab === "jobs"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Jobs ({managerJobs.length})
                </button>
                <button
                  onClick={() => setManagerActiveTab("candidates")}
                  className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
                    managerActiveTab === "candidates"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Candidate Pipeline ({managerApplications.length})
                </button>
              </div>

              {/* Tab Contents */}
              {managerActiveTab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
                    <h3 className="text-lg font-bold text-foreground mb-4">Recent Actions by {viewingManager.full_name}</h3>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                      {notifications.filter(n => n.message?.includes(viewingManager.full_name) || n.title?.includes(viewingManager.full_name)).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-10">No recent actions logged for this manager.</p>
                      ) : (
                        notifications
                          .filter(n => n.message?.includes(viewingManager.full_name) || n.title?.includes(viewingManager.full_name))
                          .map((n) => (
                            <div key={n.id} className="rounded-lg border border-border bg-secondary/15 p-3 flex flex-col gap-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-foreground">{n.title}</span>
                                <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{n.message}</p>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="text-lg font-bold text-foreground mb-4">Pipeline Status Funnel</h3>
                    <div className="space-y-3">
                      {(() => {
                        const stages = ["applied", "shortlisted", "test_completed", "video_submitted", "technical_completed", "gd_completed", "hired", "rejected"];
                        const stageCounts = stages.map(st => ({
                          stage: st,
                          count: managerApplications.filter(a => a.current_stage === st || (st === "hired" && (a.current_stage === "hired" || a.status === "hired")) || (st === "rejected" && (a.current_stage === "rejected" || a.status === "rejected"))).length
                        }));
                        const maxCount = Math.max(...stageCounts.map(s => s.count), 1);
                        return stageCounts.map(({ stage, count }) => {
                          const percentage = Math.round((count / maxCount) * 100);
                          return (
                            <div key={stage} className="space-y-1">
                              <div className="flex justify-between text-xs font-semibold">
                                <span className="capitalize">{stageLabel[stage] || stage}</span>
                                <span>{count}</span>
                              </div>
                              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    stage === "hired" ? "bg-primary" : stage === "rejected" ? "bg-destructive" : "bg-blue-400"
                                  }`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {managerActiveTab === "jobs" && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Job Title</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Aptitude Cutoff</TableHead>
                        <TableHead>Experience Range</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {managerJobs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                            No jobs posted/managed by this manager yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        managerJobs.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell className="font-medium text-foreground">{job.title}</TableCell>
                            <TableCell>{job.department}</TableCell>
                            <TableCell>{job.location}</TableCell>
                            <TableCell>{job.work_type}</TableCell>
                            <TableCell className="font-semibold text-primary">{job.aptitude_cutoff}%</TableCell>
                            <TableCell>{job.experience_min ?? 0} - {job.experience_max ?? "5+"} yrs</TableCell>
                            <TableCell>
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                job.status === "open" || job.status === "active"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }`}>
                                {job.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(job.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {managerActiveTab === "candidates" && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Candidate</TableHead>
                          <TableHead>Job Applied</TableHead>
                          <TableHead>AI Resume Score</TableHead>
                          <TableHead>Aptitude Score</TableHead>
                          <TableHead>Video Score</TableHead>
                          <TableHead>Tech Score</TableHead>
                          <TableHead>Current Stage</TableHead>
                          <TableHead className="text-right">Inspection Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {managerApplications.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                              No candidates in this manager's pipeline yet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          managerApplications.map((app) => {
                            const hasTest = app.test_score !== null;
                            const hasVideo = app.video_url || app.current_stage === "video_submitted";
                            const hasTech = app.technical_score !== null || app.current_stage === "technical_completed";

                            return (
                              <TableRow key={app.id}>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-foreground">{app.candidate_name}</span>
                                    <span className="text-xs text-muted-foreground">{app.candidate_email}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm">{app.job_title}</TableCell>
                                <TableCell>
                                  {app.resume_score !== null ? (
                                    <span className={`font-bold ${app.resume_score >= 70 ? "text-primary" : app.resume_score >= 50 ? "text-amber-500" : "text-destructive"}`}>
                                      {app.resume_score}
                                    </span>
                                  ) : "—"}
                                </TableCell>
                                <TableCell>
                                  {app.test_score !== null ? (
                                    <span className={`font-bold ${app.test_score >= 70 ? "text-primary" : app.test_score >= 50 ? "text-amber-500" : "text-destructive"}`}>
                                      {app.test_score}%
                                    </span>
                                  ) : "—"}
                                </TableCell>
                                <TableCell>
                                  {app.video_score !== null ? (
                                    <span className={`font-bold ${app.video_score >= 70 ? "text-primary" : app.video_score >= 50 ? "text-amber-500" : "text-destructive"}`}>
                                      {app.video_score}/100
                                    </span>
                                  ) : "—"}
                                </TableCell>
                                <TableCell>
                                  {app.technical_score !== null ? (
                                    <span className={`font-bold ${app.technical_score >= 70 ? "text-primary" : app.technical_score >= 50 ? "text-amber-500" : "text-destructive"}`}>
                                      {app.technical_score}%
                                    </span>
                                  ) : "—"}
                                </TableCell>
                                <TableCell>
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    stageBadgeClass[app.current_stage] || "bg-muted text-muted-foreground"
                                  }`}>
                                    {stageLabel[app.current_stage] || app.current_stage}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1 flex-wrap">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleViewResume(app.resume_url)}
                                      className="text-muted-foreground hover:text-foreground gap-1 text-xs"
                                      title="Inspect Resume"
                                    >
                                      <FileText className="h-3.5 w-3.5" />
                                      Resume
                                    </Button>
                                    
                                    {hasTest && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleViewTestResults(app)}
                                        className="text-primary hover:text-primary gap-1 text-xs"
                                        title="Inspect Aptitude Test"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        Test
                                      </Button>
                                    )}
                                    
                                    {hasVideo && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleViewVideo(app)}
                                        className="text-pink-500 hover:text-pink-600 gap-1 text-xs"
                                        title="Inspect Video Intro"
                                      >
                                        <Play className="h-3.5 w-3.5" />
                                        Video
                                      </Button>
                                    )}
                                    
                                    {hasTech && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleViewTechReport(app)}
                                        className="text-teal-500 hover:text-teal-600 gap-1 text-xs"
                                        title="Inspect Technical Report"
                                      >
                                        <Code2 className="h-3.5 w-3.5" />
                                        Tech
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <>
              {/* Stat Cards */}
              {activeNav === "Dashboard" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
                    {stats.map(({ icon: Icon, label, value, color }, i) => (
                      <motion.div
                        key={label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="rounded-xl border border-border bg-card p-5"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-muted-foreground">{label}</span>
                          <Icon className={`h-5 w-5 ${color}`} />
                        </div>
                        <p className="text-3xl font-bold text-foreground">{value}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Recent Team Activities Feed on Main Dashboard */}
                  <div className="space-y-6 mt-8">
                    <div className="rounded-xl border border-border bg-card p-6">
                      <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                        <Zap className="h-5 w-5 text-primary" />
                        Recent Team Activities
                      </h3>
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {notifications.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-6">No recent activity.</p>
                        ) : (
                          notifications.slice(0, 15).map((n) => (
                            <div key={n.id} className="rounded-lg border border-border bg-secondary/10 p-3.5 flex flex-col gap-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-foreground">{n.title}</span>
                                <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">{n.message}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Team Activity Section */}
              {activeNav === "Team Activity" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl border border-border bg-card p-6 space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Team Activity Logs</h2>
                      <p className="text-sm text-muted-foreground mt-1">Real-time audit log of actions taken by HR and Hiring Managers.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session) {
                          await supabase.from("notifications").update({ read: true }).eq("user_id", session.user.id);
                          fetchData();
                          toast({ title: "Logs cleared" });
                        }
                      }}
                    >
                      Clear Logs
                    </Button>
                  </div>

                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {notifications.length === 0 ? (
                      <p className="text-center text-muted-foreground py-12">No activity logged yet.</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`flex flex-col gap-1 rounded-lg border border-border p-4 transition-colors ${
                            !n.read ? "bg-primary/5 border-primary/30" : "bg-secondary/20"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                              <Zap className="h-4 w-4 text-primary" />
                              {n.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(n.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}

              {/* HR Managers Section */}
              {activeNav === "HR Managers" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl border border-border bg-card"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between px-4 md:px-6 py-4 border-b border-border gap-4">
                    <h2 className="text-lg font-semibold text-foreground">HR Managers</h2>
                    <Button
                      onClick={() => openPanel("hr")}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 w-full md:w-auto"
                      size="sm"
                    >
                      <Plus className="h-4 w-4" />
                      Add HR Manager
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="hidden sm:table-cell">Phone</TableHead>
                          <TableHead className="hidden md:table-cell">Status</TableHead>
                          <TableHead className="hidden lg:table-cell">Created</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {hrManagers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                              No HR managers yet. Click "+ Add HR Manager" to get started.
                            </TableCell>
                          </TableRow>
                        ) : (
                          hrManagers.map((u) => (
                            <TableRow key={u.id}>
                              <TableCell className="font-medium">{u.full_name}</TableCell>
                              <TableCell>{u.email}</TableCell>
                              <TableCell className="hidden sm:table-cell">{u.phone || "—"}</TableCell>
                              <TableCell className="hidden md:table-cell">
                                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">Active</span>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                                {new Date(u.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    onClick={() => handleViewDetails(u)}
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-foreground gap-1"
                                  >
                                    <Eye className="h-4 w-4" />
                                    Details
                                  </Button>
                                  <Button
                                    onClick={() => setViewingManager(u)}
                                    variant="outline"
                                    size="sm"
                                    className="text-primary hover:text-primary-foreground hover:bg-primary gap-1"
                                  >
                                    <LayoutDashboard className="h-4 w-4" />
                                    Dashboard
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </motion.div>
              )}

              {/* Hiring Managers Section */}
              {activeNav === "Hiring Managers" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl border border-border bg-card"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between px-4 md:px-6 py-4 border-b border-border gap-4">
                    <h2 className="text-lg font-semibold text-foreground">Hiring Managers</h2>
                    <Button
                      onClick={() => openPanel("manager")}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 w-full md:w-auto"
                      size="sm"
                    >
                      <Plus className="h-4 w-4" />
                      Add Hiring Manager
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="hidden sm:table-cell">Phone</TableHead>
                          <TableHead className="hidden md:table-cell">Department</TableHead>
                          <TableHead className="hidden lg:table-cell">Status</TableHead>
                          <TableHead className="hidden xl:table-cell">Created</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {hiringManagers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                              No hiring managers yet. Click "+ Add Hiring Manager" to get started.
                            </TableCell>
                          </TableRow>
                        ) : (
                          hiringManagers.map((u) => (
                            <TableRow key={u.id}>
                              <TableCell className="font-medium">{u.full_name}</TableCell>
                              <TableCell>{u.email}</TableCell>
                              <TableCell className="hidden sm:table-cell">{u.phone || "—"}</TableCell>
                              <TableCell className="hidden md:table-cell">{(u as any).department || "—"}</TableCell>
                              <TableCell className="hidden lg:table-cell">
                                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">Active</span>
                              </TableCell>
                              <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">
                                {new Date(u.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    onClick={() => handleViewDetails(u)}
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-foreground gap-1"
                                  >
                                    <Eye className="h-4 w-4" />
                                    Details
                                  </Button>
                                  <Button
                                    onClick={() => setViewingManager(u)}
                                    variant="outline"
                                    size="sm"
                                    className="text-primary hover:text-primary-foreground hover:bg-primary gap-1"
                                  >
                                    <LayoutDashboard className="h-4 w-4" />
                                    Dashboard
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </main>
      </div>

      <AddUserPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        type={panelType}
        companyId={companyId}
        onUserCreated={fetchData}
      />

      <UserDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        user={selectedUser}
      />

      {/* Resume Viewer Dialog */}
      <Dialog open={resumeDialogOpen} onOpenChange={setResumeDialogOpen}>
        <DialogContent className="max-w-4xl h-[85vh]">
          <DialogHeader>
            <DialogTitle>Resume</DialogTitle>
          </DialogHeader>
          {resumeUrl && (() => {
            const lower = resumeUrl.toLowerCase();
            const isImage = ['.jpg', '.jpeg', '.png', '.webp'].some(ext => lower.includes(ext));
            const isPdf = lower.includes('.pdf');

            if (isImage) {
              return (
                <div className="w-full flex-1 overflow-auto rounded-lg border border-border" style={{ height: "calc(85vh - 80px)" }}>
                  <img src={resumeUrl} alt="Resume" className="w-full h-auto object-contain" />
                </div>
              );
            }

            const viewerUrl = isPdf
              ? resumeUrl
              : `https://docs.google.com/gview?url=${encodeURIComponent(resumeUrl)}&embedded=true`;
            return (
              <iframe 
                src={viewerUrl} 
                className="w-full flex-1 rounded-lg border border-border" 
                style={{ height: "calc(85vh - 80px)" }}
                title="Resume Viewer"
              />
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Test Results Dialog */}
      <Dialog open={!!testResultDialog} onOpenChange={() => setTestResultDialog(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Test Results — {testResultDialog?.candidate_name}</DialogTitle>
          </DialogHeader>
          {testResultDialog && (
            <div className="space-y-6">
              {/* Candidate Info + Photo */}
              <div className="flex items-start gap-4">
                {candidatePhotoUrl && (
                  <div className="shrink-0">
                    <img
                      src={candidatePhotoUrl}
                      alt={testResultDialog.candidate_name}
                      className="h-20 w-20 rounded-xl object-cover border-2 border-border"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-lg font-bold text-foreground">{testResultDialog.candidate_name}</p>
                  <p className="text-sm text-muted-foreground">{testResultDialog.candidate_email}</p>
                  <p className="text-sm text-muted-foreground">Job: {testResultDialog.job_title}</p>
                </div>
              </div>

              {/* Score Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{testResultDialog.test_score ?? "—"}/100</p>
                  <p className="text-xs text-muted-foreground">Score</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {testAnswers.filter(a => a.selected_option !== null).length}/{testQuestions.length || 40}
                  </p>
                  <p className="text-xs text-muted-foreground">Answered</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {testAnswers.length > 0 ? Math.round(testAnswers.reduce((s, a) => s + (a.time_spent_seconds || 0), 0) / 60) : 0}m
                  </p>
                  <p className="text-xs text-muted-foreground">Total Time</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                  <p className={`text-2xl font-bold ${testViolations.length > 0 ? "text-destructive" : "text-primary"}`}>
                    {testViolations.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Violations</p>
                </div>
              </div>

              {/* Violations */}
              {testViolations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">⚠️ Proctoring Violations ({testViolations.length})</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {testViolations.map((v: any) => (
                      <div key={v.id} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                        <span className="text-destructive text-xs font-medium uppercase shrink-0">{v.violation_type}</span>
                        <span className="text-muted-foreground">—</span>
                        <span className="text-foreground flex-1">{v.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Question-by-Question Breakdown */}
              {testQuestions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">📝 Question-by-Question Breakdown</h3>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {testQuestions.map((q: any, idx: number) => {
                      const answer = testAnswers.find(a => a.question_index === idx);
                      const selectedOption = answer?.selected_option;
                      const correctIdx = q.correct_answer ? q.correct_answer.charCodeAt(0) - 65 : -1;
                      const isCorrect = selectedOption === correctIdx;
                      const isUnanswered = selectedOption === null || selectedOption === undefined;

                      return (
                        <div key={idx} className={`p-3 rounded-lg border ${isUnanswered ? "border-muted bg-muted/30" : isCorrect ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isUnanswered ? "bg-muted text-muted-foreground" : isCorrect ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                                Q{idx + 1}
                              </span>
                              <span className="text-[10px] text-muted-foreground">{q.section}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                              {isUnanswered ? (
                                <span className="text-muted-foreground font-medium">Skipped</span>
                              ) : isCorrect ? (
                                <span className="text-primary font-medium">✓ Correct</span>
                              ) : (
                                <span className="text-destructive font-medium">✗ Wrong</span>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-foreground mb-2">{q.question}</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {q.options?.map((opt: string, oIdx: number) => {
                              const isSelected = selectedOption === oIdx;
                              const isCorrectOpt = oIdx === correctIdx;
                              let optClass = "border-border text-muted-foreground";
                              if (isCorrectOpt) optClass = "border-primary bg-primary/10 text-primary";
                              if (isSelected && !isCorrect) optClass = "border-destructive bg-destructive/10 text-destructive";
                              if (isSelected && isCorrect) optClass = "border-primary bg-primary/10 text-primary";

                              return (
                                <div key={oIdx} className={`text-xs px-2 py-1.5 rounded border ${optClass}`}>
                                  <span className="font-bold mr-1">{String.fromCharCode(65 + oIdx)}.</span>
                                  {opt}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Video Viewer Dialog */}
      <Dialog open={!!videoDialog} onOpenChange={() => setVideoDialog(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Video Introduction — {videoDialog?.candidate_name}</DialogTitle>
          </DialogHeader>
          {videoDialog && (
            <div className="space-y-4">
              {videoSignedUrl ? (
                <video
                  src={videoSignedUrl}
                  controls
                  className="w-full rounded-lg border border-border aspect-video bg-black"
                />
              ) : (
                <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">Loading video...</p>
                </div>
              )}

              {/* AI Video Analysis */}
              {videoDialog.video_analysis && videoDialog.video_analysis.status !== "processing" && videoDialog.video_analysis.status !== "failed" && (() => {
                const va = videoDialog.video_analysis;
                const metrics = [
                  { key: "energy_level", label: "⚡ Energy Level" },
                  { key: "eye_contact", label: "👁️ Eye Contact" },
                  { key: "english_fluency", label: "🗣️ English Fluency" },
                  { key: "vocabulary", label: "📚 Vocabulary" },
                  { key: "communication_skills", label: "💬 Communication" },
                  { key: "confidence", label: "💪 Confidence" },
                  { key: "body_language", label: "🧍 Body Language" },
                  { key: "content_quality", label: "📝 Content Quality" },
                  { key: "professionalism", label: "👔 Professionalism" },
                  { key: "overall_impression", label: "⭐ Overall Impression" },
                ];

                const verdictColors: Record<string, string> = {
                  strong: "bg-primary/10 text-primary border-primary/30",
                  average: "bg-amber-500/10 text-amber-500 border-amber-500/30",
                  weak: "bg-destructive/10 text-destructive border-destructive/30",
                };

                return (
                  <div className="space-y-4">
                    {/* Overall Score Header */}
                    <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">AI Video Score</p>
                        <p className="text-3xl font-bold text-foreground">{va.overall_score}<span className="text-lg text-muted-foreground">/100</span></p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${verdictColors[va.verdict] || verdictColors.average}`}>
                        {va.verdict?.toUpperCase()}
                      </span>
                    </div>

                    {/* Summary */}
                    {va.summary && (
                      <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-sm font-semibold text-foreground mb-1">📋 AI Summary</p>
                        <p className="text-sm text-muted-foreground">{va.summary}</p>
                      </div>
                    )}

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {metrics.map(({ key, label }) => {
                        const m = va[key];
                        if (!m) return null;
                        const score = m.score ?? 0;
                        const barColor = score >= 7 ? "bg-primary" : score >= 5 ? "bg-amber-500" : "bg-destructive";
                        return (
                          <div key={key} className="rounded-lg border border-border bg-card/60 p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-foreground">{label}</span>
                              <span className="text-sm font-bold text-foreground">{score}/10</span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score * 10}%` }} />
                            </div>
                            <p className="text-xs text-muted-foreground">{m.feedback}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Strengths & Improvements */}
                    <div className="grid grid-cols-2 gap-3">
                      {va.strengths?.length > 0 && (
                        <div className="rounded-lg border border-border bg-card/60 p-3">
                          <p className="text-xs font-semibold text-primary mb-2">✅ Strengths</p>
                          <ul className="space-y-1">
                            {va.strengths.map((s: string, i: number) => (
                              <li key={i} className="text-xs text-muted-foreground">• {s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {va.improvements?.length > 0 && (
                        <div className="rounded-lg border border-border bg-card/60 p-3">
                          <p className="text-xs font-semibold text-amber-500 mb-2">🔧 Areas to Improve / Gaps</p>
                          <ul className="space-y-1">
                            {va.improvements.map((s: string, i: number) => (
                              <li key={i} className="text-xs text-muted-foreground">• {s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Technical Report Dialog */}
      <Dialog open={!!technicalReportDialog} onOpenChange={() => setTechnicalReportDialog(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>💻 Technical Round Report — {technicalReportDialog?.candidate_name}</DialogTitle>
          </DialogHeader>
          {technicalReportDialog && (() => {
            const codeAnswers = technicalReportDialog.code_answers;
            const report = codeAnswers?.ai_report;
            const dsaAnswers = codeAnswers?.dsa_answers || {};
            const codingAnswers = codeAnswers?.coding_answers || {};
            const questions = technicalAssessment as any;

            if (!report && !codeAnswers) {
              return (
                <div className="py-8 text-center text-muted-foreground">
                  <p>No technical round data available yet.</p>
                </div>
              );
            }

            return (
              <div className="space-y-6">
                {/* Score Overview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                    <p className={`text-2xl font-bold ${(report?.overall_score ?? 0) >= 70 ? "text-primary" : (report?.overall_score ?? 0) >= 50 ? "text-amber-500" : "text-destructive"}`}>
                      {report?.overall_score ?? technicalReportDialog.technical_score ?? "—"}/100
                    </p>
                    <p className="text-xs text-muted-foreground">Overall Score</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{report?.dsa_score ?? "—"}/100</p>
                    <p className="text-xs text-muted-foreground">DSA Score</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{report?.coding_score ?? "—"}/100</p>
                    <p className="text-xs text-muted-foreground">Coding Score</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{report?.mcq_score ?? "—"}/100</p>
                    <p className="text-xs text-muted-foreground">MCQ Score</p>
                  </div>
                </div>

                {/* DSA Problems Results */}
                {report?.dsa_results?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">🧩 DSA Problems</h3>
                    <div className="space-y-3">
                      {report.dsa_results.map((r: any, i: number) => {
                        const candidateCode = dsaAnswers[i] || "";
                        return (
                          <div key={i} className={`rounded-lg border p-4 ${r.correctness ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <span className="text-sm font-semibold text-foreground">#{r.problem_number} {r.title}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-sm font-bold ${r.score >= 70 ? "text-primary" : r.score >= 40 ? "text-amber-500" : "text-destructive"}`}>
                                  {r.score}/100
                                </span>
                                <span className={`text-xs font-medium ${r.correctness ? "text-primary" : "text-destructive"}`}>
                                  {r.correctness ? "✓ Correct" : "✗ Incorrect"}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-4 text-xs text-muted-foreground mb-2">
                              <span>⏱ Time: {r.time_complexity || "N/A"}</span>
                              <span>💾 Space: {r.space_complexity || "N/A"}</span>
                              <span>⭐ Code Quality: {r.code_quality}/10</span>
                            </div>
                            {candidateCode && (
                              <details className="mb-2">
                                <summary className="text-xs font-medium text-foreground cursor-pointer hover:text-primary">View Candidate's Code</summary>
                                <pre className="mt-2 p-3 rounded-lg bg-muted text-xs overflow-x-auto max-h-48 overflow-y-auto font-mono text-foreground border border-border">
                                  {candidateCode}
                                </pre>
                              </details>
                            )}
                            {r.feedback && (
                              <div className="mt-2 p-2 rounded bg-muted/50 border border-border">
                                <p className="text-xs font-medium text-foreground mb-1">🤖 AI Feedback:</p>
                                <p className="text-xs text-muted-foreground">{r.feedback}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Coding Tasks Results */}
                {report?.coding_results?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">💻 Coding Tasks</h3>
                    <div className="space-y-3">
                      {report.coding_results.map((r: any, i: number) => {
                        const candidateCode = codingAnswers[i] || "";
                        return (
                          <div key={i} className={`rounded-lg border p-4 ${r.correctness ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <span className="text-sm font-semibold text-foreground">#{r.task_number} {r.title}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-sm font-bold ${r.score >= 70 ? "text-primary" : r.score >= 40 ? "text-amber-500" : "text-destructive"}`}>
                                  {r.score}/100
                                </span>
                                <span className={`text-xs font-medium ${r.correctness ? "text-primary" : "text-destructive"}`}>
                                  {r.correctness ? "✓ Correct" : "✗ Incorrect"}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-4 text-xs text-muted-foreground mb-2">
                              <span>⏱ Time: {r.time_complexity || "N/A"}</span>
                              <span>💾 Space: {r.space_complexity || "N/A"}</span>
                              <span>⭐ Code Quality: {r.code_quality}/10</span>
                            </div>
                            {candidateCode && (
                              <details className="mb-2">
                                <summary className="text-xs font-medium text-foreground cursor-pointer hover:text-primary">View Candidate's Code</summary>
                                <pre className="mt-2 p-3 rounded-lg bg-muted text-xs overflow-x-auto max-h-48 overflow-y-auto font-mono text-foreground border border-border">
                                  {candidateCode}
                                </pre>
                              </details>
                            )}
                            {r.feedback && (
                              <div className="mt-2 p-2 rounded bg-muted/50 border border-border">
                                <p className="text-xs font-medium text-foreground mb-1">🤖 AI Feedback:</p>
                                <p className="text-xs text-muted-foreground">{r.feedback}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Violations during technical test */}
                {techViolations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">⚠️ Proctoring Violations ({techViolations.length})</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {techViolations.map((v: any) => (
                        <div key={v.id} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                          <span className="text-destructive text-xs font-medium uppercase shrink-0">{v.violation_type}</span>
                          <span className="text-muted-foreground">—</span>
                          <span className="text-foreground flex-1">{v.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
