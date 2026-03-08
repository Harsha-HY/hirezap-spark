import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Zap, BarChart3, Settings, Bell, LogOut, Plus, Users, Briefcase,
  MessageSquare, Calendar, LayoutDashboard, Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";
import AddJobPanel from "@/components/AddJobPanel";
import { useToast } from "@/hooks/use-toast";

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

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Briefcase, label: "Jobs" },
  { icon: Users, label: "Candidates" },
  { icon: Calendar, label: "Interviews" },
  { icon: Users, label: "Group Discussion" },
  { icon: MessageSquare, label: "Messages" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Settings, label: "Settings" },
];

const HRDashboard = () => {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [hrName, setHrName] = useState("");
  const [hrUserId, setHrUserId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [managers, setManagers] = useState<{ id: string; full_name: string }[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; created_at: string; read: boolean }[]>([]);
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const [latestNotif, setLatestNotif] = useState<{ title: string; message: string } | null>(null);
  const [liveActivities, setLiveActivities] = useState<{ message: string; time: string }[]>([]);
  const { toast } = useToast();

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: user } = await supabase
      .from("users")
      .select("id, full_name, company_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!user) return;

    setHrName(user.full_name);
    setHrUserId(user.id);

    if (user.company_id) {
      setCompanyId(user.company_id);

      const { data: company } = await supabase
        .from("companies")
        .select("company_name")
        .eq("id", user.company_id)
        .maybeSingle();
      if (company) setCompanyName(company.company_name);

      const { data: jobsData } = await supabase
        .from("jobs")
        .select("*")
        .eq("company_id", user.company_id)
        .order("created_at", { ascending: false });
      if (jobsData) setJobs(jobsData as JobRow[]);

      const { data: mgrs } = await supabase
        .from("users")
        .select("id, full_name")
        .eq("role", "manager")
        .eq("company_id", user.company_id);
      if (mgrs) setManagers(mgrs);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!userData) return;

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userData.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) setNotifications(data as any);
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Subscribe to realtime notifications
  useEffect(() => {
    const channel = supabase
      .channel("hr-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const newNotif = payload.new as any;
          setNotifications((prev) => [newNotif, ...prev]);

          // Show popup
          setLatestNotif({ title: newNotif.title, message: newNotif.message });
          setTimeout(() => setLatestNotif(null), 8000);

          // Add to live activity
          setLiveActivities((prev) => [
            { message: newNotif.message, time: "Just now" },
            ...prev.slice(0, 9),
          ]);

          // Refresh jobs to update application counts
          fetchData();

          toast({
            title: `🔔 ${newNotif.title}`,
            description: newNotif.message.substring(0, 100) + "...",
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleNavClick = (label: string) => {
    setActiveNav(label);
    if (label === "Jobs") {
      document.getElementById("jobs-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (label === "Dashboard") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const getManagerName = (managerId: string | null) => {
    if (!managerId) return "—";
    return managers.find(m => m.id === managerId)?.full_name || "—";
  };

  const stats = [
    { icon: Briefcase, label: "Total Jobs Posted", value: jobs.length, color: "text-primary" },
    { icon: Users, label: "Total Applications", value: jobs.reduce((s, j) => s + j.applications_count, 0), color: "text-blue-400" },
    { icon: Users, label: "Shortlisted", value: 0, color: "text-amber-400" },
    { icon: Calendar, label: "Interviews Today", value: 0, color: "text-purple-400" },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -260 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r border-border bg-card"
      >
        <div className="px-5 py-6 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Zap className="h-7 w-7 text-primary fill-primary" />
            <span className="text-xl font-extrabold tracking-tight text-foreground">
              Hire<span className="text-primary">Zap</span>
            </span>
          </div>
          {companyName && (
            <p className="text-xs text-primary mt-2 truncate">{companyName}</p>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ icon: Icon, label, active }) => (
            <button
              key={label}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
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
          <p className="text-sm font-medium text-foreground truncate">{hrName || "HR Manager"}</p>
          <p className="text-xs text-muted-foreground mb-3">HR Manager</p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </motion.aside>

      {/* Main */}
      <div className="ml-60 flex-1 flex flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-8 py-4">
          <h1 className="text-xl font-bold text-foreground">HR Dashboard</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setShowNotifPopup(!showNotifPopup)}
                className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <Bell className="h-5 w-5 text-muted-foreground" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive flex items-center justify-center text-[10px] text-destructive-foreground font-bold">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
              {showNotifPopup && (
                <div className="absolute right-0 top-12 w-80 max-h-96 overflow-y-auto rounded-xl border border-border bg-card shadow-xl z-50">
                  <div className="p-3 border-b border-border">
                    <p className="text-sm font-semibold text-foreground">Notifications</p>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={`p-3 border-b border-border last:border-0 ${!n.read ? "bg-primary/5" : ""}`}>
                        <p className="text-sm font-medium text-foreground">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
              {hrName?.charAt(0)?.toUpperCase() || "H"}
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
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

          {/* Live Activity Feed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl border border-border bg-card p-6 mb-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold text-foreground">Live Activity</h2>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
                </span>
                <span className="text-xs font-semibold text-destructive uppercase tracking-wider">Live</span>
              </div>
            </div>
            {liveActivities.length === 0 ? (
              <p className="text-muted-foreground text-sm">No activity yet. Post a job to get started.</p>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {liveActivities.map((activity, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-3 text-sm"
                    >
                      <span className="text-primary">📄</span>
                      <div>
                        <p className="text-foreground">{activity.message}</p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>

          {/* Jobs Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl border border-border bg-card"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Posted Jobs</h2>
              <Button
                onClick={() => setPanelOpen(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                size="sm"
              >
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
                  <TableHead>Applications</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date Posted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      No jobs posted yet. Click "+ Post New Job" to get started.
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
                      <TableCell>{job.applications_count}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          job.status === "open"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(job.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">•••</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </motion.div>
        </main>
      </div>

      <AddJobPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        companyId={companyId}
        hrUserId={hrUserId}
        managers={managers}
        onJobCreated={fetchData}
      />

      {/* Floating notification popup */}
      <AnimatePresence>
        {latestNotif && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border border-primary/30 bg-card shadow-2xl shadow-primary/10 p-4"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">🔔</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{latestNotif.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{latestNotif.message}</p>
              </div>
              <button onClick={() => setLatestNotif(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HRDashboard;
