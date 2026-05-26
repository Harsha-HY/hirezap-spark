import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Zap, BarChart3, Settings, Bell, LogOut, Plus, Users, Briefcase,
  MessageSquare, UserCheck, UserCog, LayoutDashboard, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";
import AddUserPanel from "@/components/AddUserPanel";
import { useToast } from "@/hooks/use-toast";

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  department?: string | null;
  role: string;
  created_at: string;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: UserCheck, label: "HR Managers" },
  { icon: UserCog, label: "Hiring Managers" },
  { icon: Users, label: "Candidates" },
  { icon: Briefcase, label: "Jobs" },
  { icon: MessageSquare, label: "Messages" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Settings, label: "Settings" },
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
      }
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const openPanel = (type: "hr" | "manager") => {
    setPanelType(type);
    setPanelOpen(true);
  };

  const handleNavClick = (label: string) => {
    setActiveNav(label);

    // Map of navigation items to scroll section IDs
    const sectionMap: Record<string, string> = {
      Dashboard: "admin-dashboard-top",
      "HR Managers": "hr-managers-section",
      "Hiring Managers": "hiring-managers-section",
      Candidates: "candidates-section",
      Jobs: "jobs-section",
      Messages: "messages-section",
      Analytics: "analytics-section",
      Settings: "settings-section",
    };

    const sectionId = sectionMap[label];
    if (sectionId) {
      // Scroll to the section smoothly
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
      
      if (isMobile) setSidebarOpen(false);
    }
  };

  const stats = [
    { icon: UserCheck, label: "Total HR Managers", value: hrManagers.length, color: "text-primary" },
    { icon: UserCog, label: "Total Hiring Managers", value: hiringManagers.length, color: "text-blue-400" },
    { icon: Users, label: "Total Candidates", value: 0, color: "text-amber-400" },
    { icon: Briefcase, label: "Total Jobs Open", value: 0, color: "text-purple-400" },
  ];

  const ComingSoonSection = ({ id, title, icon: Icon }: { id: string; title: string; icon: React.FC<any> }) => (
    <div id={id} className="rounded-xl border border-border bg-card p-12 mb-6">
      <div className="flex flex-col items-center justify-center text-center">
        <Icon className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm">This section is coming soon. Stay tuned for updates!</p>
      </div>
    </div>
  );

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

        <main id="admin-dashboard-top" className="flex-1 p-4 md:p-8 overflow-y-auto">
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

          {/* HR Managers Section */}
          <div id="hr-managers-section" className="rounded-xl border border-border bg-card mb-6">
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
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">•••</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Hiring Managers Section */}
          <div id="hiring-managers-section" className="rounded-xl border border-border bg-card mb-6">
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
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">•••</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Coming Soon Sections */}
          <ComingSoonSection id="candidates-section" title="Candidates Management" icon={Users} />
          <ComingSoonSection id="jobs-section" title="Jobs Management" icon={Briefcase} />
          <ComingSoonSection id="messages-section" title="Messages" icon={MessageSquare} />
          <ComingSoonSection id="analytics-section" title="Analytics Dashboard" icon={BarChart3} />
          <ComingSoonSection id="settings-section" title="Settings" icon={Settings} />
        </main>
      </div>

      <AddUserPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        type={panelType}
        companyId={companyId}
        onUserCreated={fetchData}
      />
    </div>
  );
};

export default AdminDashboard;
