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
  { icon: LayoutDashboard, label: "Dashboard", active: true },
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
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
            <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
            </button>
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
            <p className="text-muted-foreground text-sm">No activity yet. Post a job to get started.</p>
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
    </div>
  );
};

export default HRDashboard;
