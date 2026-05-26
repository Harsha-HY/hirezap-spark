import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  LockKeyhole,
  LogOut,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  RotateCcw,
  Settings,
  Shield,
  Trash2,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";
import AddCompanyPanel from "@/components/AddCompanyPanel";
import { useToast } from "@/hooks/use-toast";

interface Company {
  id: string;
  company_name: string;
  industry: string;
  location: string;
  plan: string;
  company_code: string;
  status: string;
  created_at: string;
}

interface JobRecord {
  id: string;
  company_id: string;
  status: string;
}

interface ApplicationRecord {
  id: string;
  job_id: string;
  status: string;
  current_stage: string;
}

interface UserRecord {
  id: string;
  full_name: string;
  email: string;
  role: string;
  company_id: string | null;
}

const navItems = [
  { icon: Building2, label: "Companies" },
  { icon: RotateCcw, label: "Restore Company" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Shield, label: "Security" },
  { icon: Settings, label: "Settings" },
];

const OwnerDashboard = () => {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("Companies");
  const [ownerName, setOwnerName] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [companyToPermanentDelete, setCompanyToPermanentDelete] = useState<Company | null>(null);
  const [busyCompanyId, setBusyCompanyId] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const { toast } = useToast();

  const activeCompanies = useMemo(
    () => companies.filter((company) => company.status !== "deleted" && company.status !== "removed"),
    [companies],
  );

  const deletedCompanies = useMemo(
    () => companies.filter((company) => company.status === "deleted"),
    [companies],
  );

  const adminMap = useMemo(() => {
    const map: Record<string, { full_name: string; email: string }> = {};
    users
      .filter((user) => user.role === "superadmin" && user.company_id)
      .forEach((user) => {
        map[user.company_id!] = { full_name: user.full_name, email: user.email };
      });
    return map;
  }, [users]);

  const fetchData = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    setOwnerUserId(session.user.id);

    const { data: user } = await supabase
      .from("users")
      .select("full_name")
      .eq("user_id", session.user.id)
      .single();
    if (user) setOwnerName(user.full_name);

    const { data: comps } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    const companyRows = (comps || []) as Company[];
    setCompanies(companyRows);

    const companyIds = companyRows.map((company) => company.id);
    if (companyIds.length === 0) {
      setJobs([]);
      setApplications([]);
      setUsers([]);
      return;
    }

    const [{ data: userRows }, { data: jobRows }] =
      await Promise.all([
        supabase.from("users").select("id, full_name, email, role, company_id").in("company_id", companyIds),
        supabase.from("jobs").select("id, company_id, status").in("company_id", companyIds),
      ]);

    const jobRowsSafe = (jobRows || []) as JobRecord[];
    const jobIds = jobRowsSafe.map((job) => job.id);
    const { data: applicationRows } = jobIds.length
      ? await supabase.from("applications").select("id, job_id, status, current_stage").in("job_id", jobIds)
      : { data: [] };

    setUsers((userRows || []) as UserRecord[]);
    setJobs(jobRowsSafe);
    setApplications((applicationRows || []) as ApplicationRecord[]);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({ title: "New password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setChangingPassword(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      toast({ title: "Could not verify account email", variant: "destructive" });
      setChangingPassword(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: passwordForm.currentPassword,
    });

    if (verifyError) {
      toast({ title: "Old password is incorrect", variant: "destructive" });
      setChangingPassword(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: passwordForm.newPassword,
    });

    if (updateError) {
      toast({ title: "Could not update password", description: updateError.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated successfully" });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    }

    setChangingPassword(false);
  };

  const updateCompanyStatus = async (company: Company, status: "active" | "deleted") => {
    setBusyCompanyId(company.id);
    const { error } = await supabase
      .from("companies")
      .update({ status })
      .eq("id", company.id)
      .eq("owner_id", ownerUserId);

    if (error) {
      toast({
        title: status === "deleted" ? "Could not delete company" : "Could not restore company",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: status === "deleted" ? "Company moved to restore list" : "Company restored",
        description:
          status === "deleted"
            ? `${company.company_name} is hidden from active companies.`
            : `${company.company_name} is active again.`,
      });
      setCompanyToDelete(null);
      await fetchData();
    }
    setBusyCompanyId(null);
  };

  const removeCompanyFromRestore = async (company: Company) => {
    setBusyCompanyId(company.id);
    const { error } = await supabase
      .from("companies")
      .update({ status: "removed" })
      .eq("id", company.id)
      .eq("owner_id", ownerUserId);

    if (error) {
      toast({
        title: "Could not delete company",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Company deleted", description: `${company.company_name} was removed from restore.` });
      setCompanyToPermanentDelete(null);
      await fetchData();
    }

    setBusyCompanyId(null);
  };

  const jobsByCompany = useMemo(() => {
    return jobs.reduce<Record<string, JobRecord[]>>((acc, job) => {
      acc[job.company_id] = [...(acc[job.company_id] || []), job];
      return acc;
    }, {});
  }, [jobs]);

  const applicationsByCompany = useMemo(() => {
    const jobCompanyMap = jobs.reduce<Record<string, string>>((acc, job) => {
      acc[job.id] = job.company_id;
      return acc;
    }, {});

    return applications.reduce<Record<string, ApplicationRecord[]>>((acc, application) => {
      const companyId = jobCompanyMap[application.job_id];
      if (!companyId) return acc;
      acc[companyId] = [...(acc[companyId] || []), application];
      return acc;
    }, {});
  }, [applications, jobs]);

  const activeCompanyIds = useMemo(() => new Set(activeCompanies.map((company) => company.id)), [activeCompanies]);
  const activeCompanyJobs = useMemo(
    () => jobs.filter((job) => activeCompanyIds.has(job.company_id)),
    [activeCompanyIds, jobs],
  );
  const activeCompanyJobIds = useMemo(() => new Set(activeCompanyJobs.map((job) => job.id)), [activeCompanyJobs]);
  const activeCompanyApplications = useMemo(
    () => applications.filter((application) => activeCompanyJobIds.has(application.job_id)),
    [activeCompanyJobIds, applications],
  );
  const activeJobs = activeCompanyJobs.filter((job) => job.status === "open" || job.status === "active").length;
  const hiredCandidates = activeCompanyApplications.filter(
    (application) => application.current_stage === "hired",
  ).length;

  const stats = [
    { icon: Building2, label: "Total Companies", value: activeCompanies.length, color: "text-primary" },
    { icon: UserCheck, label: "Super Admins", value: Object.keys(adminMap).length, color: "text-sky-400" },
    { icon: Briefcase, label: "Active Jobs", value: activeJobs, color: "text-amber-400" },
    { icon: Users, label: "Candidates", value: activeCompanyApplications.length, color: "text-violet-400" },
  ];

  const companyAnalytics = activeCompanies.map((company) => {
    const companyJobs = jobsByCompany[company.id] || [];
    const companyApplications = applicationsByCompany[company.id] || [];
    const admins = users.filter((user) => user.company_id === company.id && user.role === "superadmin").length;
    return {
      ...company,
      admins,
      jobs: companyJobs.length,
      activeJobs: companyJobs.filter((job) => job.status === "open" || job.status === "active").length,
      applications: companyApplications.length,
    };
  });

  const renderCompanyTable = (rows: Company[], mode: "active" | "deleted") => (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Company Name</TableHead>
          <TableHead>Admin Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Company Code</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
              {mode === "active"
                ? 'No companies yet. Click "Add Company" to get started.'
                : "No deleted companies to restore."}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((company) => (
            <TableRow key={company.id}>
              <TableCell className="font-medium">{company.company_name}</TableCell>
              <TableCell>{adminMap[company.id]?.full_name || "-"}</TableCell>
              <TableCell>{adminMap[company.id]?.email || "-"}</TableCell>
              <TableCell>
                <span className="rounded bg-secondary px-2 py-1 text-xs font-mono">{company.company_code}</span>
              </TableCell>
              <TableCell>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {company.plan}
                </span>
              </TableCell>
              <TableCell>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    company.status === "active" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {company.status}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {new Date(company.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                {mode === "active" ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setCompanyToDelete(company)}
                        className="gap-2 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete company
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyCompanyId === company.id}
                      onClick={() => updateCompanyStatus(company, "active")}
                      className="gap-2"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyCompanyId === company.id}
                      onClick={() => setCompanyToPermanentDelete(company)}
                      className="gap-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  const renderContent = () => {
    if (activeNav === "Restore Company") {
      return (
        <section className="rounded-lg border border-border bg-card">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Restore Company</h2>
            <p className="text-sm text-muted-foreground mt-1">Deleted companies stay here until you restore them.</p>
          </div>
          {renderCompanyTable(deletedCompanies, "deleted")}
        </section>
      );
    }

    if (activeNav === "Analytics") {
      return (
        <section className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { label: "Applications per Company", value: activeCompanies.length ? (activeCompanyApplications.length / activeCompanies.length).toFixed(1) : "0" },
              { label: "Jobs per Company", value: activeCompanies.length ? (activeCompanyJobs.length / activeCompanies.length).toFixed(1) : "0" },
              { label: "Hire Conversion", value: activeCompanyApplications.length ? `${Math.round((hiredCandidates / activeCompanyApplications.length) * 100)}%` : "0%" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border bg-card p-5">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="text-3xl font-bold text-foreground mt-2">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border bg-card">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Company Analytics</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Company</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Admins</TableHead>
                  <TableHead>Jobs</TableHead>
                  <TableHead>Active Jobs</TableHead>
                  <TableHead>Applications</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyAnalytics.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.company_name}</TableCell>
                    <TableCell>{company.industry}</TableCell>
                    <TableCell>{company.admins}</TableCell>
                    <TableCell>{company.jobs}</TableCell>
                    <TableCell>{company.activeJobs}</TableCell>
                    <TableCell>{company.applications}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      );
    }

    if (activeNav === "Security") {
      const securityItems = [
        { icon: LockKeyhole, label: "Owner-only company control", value: "Enabled" },
        { icon: Shield, label: "Supabase RLS policies", value: "Active" },
        { icon: Users, label: "Company admins", value: Object.keys(adminMap).length.toString() },
        { icon: Activity, label: "Deleted companies", value: deletedCompanies.length.toString() },
      ];

      return (
        <section className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {securityItems.map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-lg border border-border bg-card p-5">
                <Icon className="h-5 w-5 text-primary mb-3" />
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-xl font-semibold text-foreground mt-1">{value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Access Rules</h2>
            <div className="mt-4 grid gap-3">
              {[
                "Owners can create, delete, and restore only their own companies.",
                "Company users remain scoped to their assigned company_id.",
                "Restore keeps the same company code, admins, jobs, and pipeline history.",
              ].map((rule) => (
                <div key={rule} className="flex items-center gap-3 rounded-md bg-secondary/50 px-4 py-3 text-sm">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    if (activeNav === "Settings") {
      return (
        <section className="max-w-xl rounded-lg border border-border bg-card p-6">
          <Settings className="h-6 w-6 text-primary mb-4" />
          <h2 className="text-lg font-semibold text-foreground">Change Password</h2>
          <form onSubmit={handlePasswordChange} className="mt-6 space-y-4">
            {[
              { key: "currentPassword", label: "Old Password" },
              { key: "newPassword", label: "New Password" },
              { key: "confirmPassword", label: "Confirm New Password" },
            ].map(({ key, label }) => (
              <label key={key} className="block">
                <span className="text-sm font-medium text-foreground">{label}</span>
                <input
                  type="password"
                  required
                  value={passwordForm[key as keyof typeof passwordForm]}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, [key]: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </label>
            ))}
            <Button type="submit" disabled={changingPassword} className="w-full">
              {changingPassword ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </section>
      );
    }

    return (
      <section id="companies-section" className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Companies</h2>
            <p className="text-sm text-muted-foreground mt-1">Create company accounts and manage their super admins.</p>
          </div>
          <Button
            onClick={() => setPanelOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            Add Company
          </Button>
        </div>
        {renderCompanyTable(activeCompanies, "active")}
      </section>
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      <motion.aside
        initial={{ x: -260 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r border-border bg-card"
      >
        <div className="flex items-center gap-2.5 px-5 py-6 border-b border-border">
          <Zap className="h-7 w-7 text-primary fill-primary" />
          <span className="text-xl font-extrabold tracking-tight text-foreground">
            Hire<span className="text-primary">Zap</span>
          </span>
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
              <span className="truncate">{label}</span>
              {label === "Restore Company" && deletedCompanies.length > 0 && (
                <span className="ml-auto rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                  {deletedCompanies.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="border-t border-border px-4 py-4">
          <p className="text-sm font-medium text-foreground truncate">{ownerName || "Owner"}</p>
          <p className="text-xs text-muted-foreground mb-3">Owner</p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </motion.aside>

      <div className="ml-60 flex-1 flex flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-8 py-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{activeNav}</h1>
            <p className="text-sm text-muted-foreground">Owner control center</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </button>
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
              {ownerName?.charAt(0)?.toUpperCase() || "O"}
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {stats.map(({ icon: Icon, label, value, color }, index) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="rounded-lg border border-border bg-card p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <p className="text-3xl font-bold text-foreground">{value}</p>
              </motion.div>
            ))}
          </div>

          {renderContent()}
        </main>
      </div>

      <AddCompanyPanel open={panelOpen} onOpenChange={setPanelOpen} onCompanyCreated={fetchData} />

      <AlertDialog open={!!companyToDelete} onOpenChange={(open) => !open && setCompanyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete company?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move {companyToDelete?.company_name} to Restore Company. Its admins, jobs, and hiring data stay
              connected in Supabase.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => companyToDelete && updateCompanyStatus(companyToDelete, "deleted")}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!companyToPermanentDelete}
        onOpenChange={(open) => !open && setCompanyToPermanentDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete company from restore?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {companyToPermanentDelete?.company_name} from the restore list while keeping connected
              hiring records stable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => companyToPermanentDelete && removeCompanyFromRestore(companyToPermanentDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OwnerDashboard;
