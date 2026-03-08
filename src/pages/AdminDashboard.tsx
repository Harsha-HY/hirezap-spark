import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Zap, BarChart3, Settings, Bell, LogOut, Plus, Users, Briefcase,
  MessageSquare, UserCheck, UserCog, LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion } from "framer-motion";
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
  const { toast } = useToast();

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

    const sectionMap: Record<string, string> = {
      Dashboard: "admin-dashboard-top",
      "HR Managers": "hr-managers-section",
      "Hiring Managers": "hiring-managers-section",
    };

    const sectionId = sectionMap[label];
    if (sectionId) {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    toast({ title: "Section unavailable", description: `${label} module is coming soon.` });
  };

  const stats = [
    { icon: UserCheck, label: "Total HR Managers", value: hrManagers.length, color: "text-primary" },
    { icon: UserCog, label: "Total Hiring Managers", value: hiringManagers.length, color: "text-blue-400" },
    { icon: Users, label: "Total Candidates", value: 0, color: "text-amber-400" },
    { icon: Briefcase, label: "Total Jobs Open", value: 0, color: "text-purple-400" },
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

      {/* Main */}
      <div className="ml-60 flex-1 flex flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-8 py-4">
          <h1 className="text-xl font-bold text-foreground">Super Admin Dashboard</h1>
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

          {/* HR Managers Section */}
          <div id="hr-managers-section" className="rounded-xl border border-border bg-card mb-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">HR Managers</h2>
              <Button
                onClick={() => openPanel("hr")}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                Add HR Manager
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
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
                      <TableCell>{u.phone || "—"}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">Active</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
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

          {/* Hiring Managers Section */}
          <div id="hiring-managers-section" className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Hiring Managers</h2>
              <Button
                onClick={() => openPanel("manager")}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                Add Hiring Manager
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
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
                      <TableCell>{u.phone || "—"}</TableCell>
                      <TableCell>{(u as any).department || "—"}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">Active</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
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