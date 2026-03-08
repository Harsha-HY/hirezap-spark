import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Zap, Bell, LogOut, Briefcase, Users, LayoutDashboard, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface JobRow {
  id: string;
  title: string;
  department: string;
  location: string;
  work_type: string;
  status: string;
  applications_count: number;
  created_at: string;
}

interface ApplicationRow {
  id: string;
  candidate_id: string;
  job_id: string;
  current_stage: string;
  status: string;
  experience_years: number;
  resume_score: number | null;
  test_score: number | null;
  applied_at: string;
  candidate_name?: string;
  job_title?: string;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Briefcase, label: "My Jobs" },
  { icon: Users, label: "Candidates" },
  { icon: ClipboardList, label: "Reviews" },
];

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [managerName, setManagerName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: user } = await supabase
        .from("users")
        .select("id, full_name, company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!user) return;
      setManagerName(user.full_name);

      if (user.company_id) {
        const { data: company } = await supabase
          .from("companies")
          .select("company_name")
          .eq("id", user.company_id)
          .maybeSingle();
        if (company) setCompanyName(company.company_name);

        // Jobs assigned to this manager
        const { data: jobsData } = await supabase
          .from("jobs")
          .select("*")
          .eq("manager_id", user.id)
          .order("created_at", { ascending: false });
        if (jobsData) setJobs(jobsData);

        // Applications for manager's jobs
        if (jobsData && jobsData.length > 0) {
          const jobIds = jobsData.map((j) => j.id);
          const { data: apps } = await supabase
            .from("applications")
            .select("*")
            .in("job_id", jobIds)
            .order("applied_at", { ascending: false });

          if (apps) {
            // Enrich with candidate names and job titles
            const candidateIds = [...new Set(apps.map((a) => a.candidate_id))];
            const { data: candidates } = await supabase
              .from("users")
              .select("id, full_name")
              .in("id", candidateIds);

            const enriched = apps.map((a) => ({
              ...a,
              candidate_name: candidates?.find((c) => c.id === a.candidate_id)?.full_name || "Unknown",
              job_title: jobsData.find((j) => j.id === a.job_id)?.title || "Unknown",
            }));
            setApplications(enriched);
          }
        }
      }
    };
    fetchData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const stats = [
    { icon: Briefcase, label: "Assigned Jobs", value: jobs.length, color: "text-primary" },
    { icon: Users, label: "Total Candidates", value: applications.length, color: "text-blue-400" },
    { icon: ClipboardList, label: "Pending Reviews", value: applications.filter((a) => a.current_stage === "video_intro" || a.current_stage === "test_completed").length, color: "text-amber-400" },
  ];

  const stageLabel = (stage: string) => {
    const map: Record<string, string> = {
      applied: "Applied",
      resume_screening: "Resume Screen",
      test_stage: "Aptitude Test",
      test_completed: "Test Done",
      video_intro: "Video Intro",
      interview: "Interview",
      offered: "Offered",
      rejected: "Rejected",
    };
    return map[stage] || stage;
  };

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
          {navItems.map(({ icon: Icon, label }) => (
            <button
              key={label}
              onClick={() => setActiveNav(label)}
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
          <p className="text-sm font-medium text-foreground truncate">{managerName || "Manager"}</p>
          <p className="text-xs text-muted-foreground mb-3">Hiring Manager</p>
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
          <h1 className="text-xl font-bold text-foreground">Hiring Manager Dashboard</h1>
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </button>
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
              {managerName?.charAt(0)?.toUpperCase() || "M"}
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
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

          {/* Jobs Table */}
          <div className="rounded-xl border border-border bg-card mb-6">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">My Assigned Jobs</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Applications</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No jobs assigned to you yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.title}</TableCell>
                      <TableCell>{job.department}</TableCell>
                      <TableCell>{job.location}</TableCell>
                      <TableCell>{job.work_type}</TableCell>
                      <TableCell>{job.applications_count}</TableCell>
                      <TableCell>
                        <Badge variant={job.status === "open" ? "default" : "secondary"}>
                          {job.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Candidates Table */}
          <div className="rounded-xl border border-border bg-card">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Candidates</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Candidate</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Resume Score</TableHead>
                  <TableHead>Test Score</TableHead>
                  <TableHead>Applied</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No candidates yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  applications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">{app.candidate_name}</TableCell>
                      <TableCell>{app.job_title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{stageLabel(app.current_stage)}</Badge>
                      </TableCell>
                      <TableCell>{app.experience_years} yrs</TableCell>
                      <TableCell>{app.resume_score ?? "—"}</TableCell>
                      <TableCell>{app.test_score ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(app.applied_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ManagerDashboard;
