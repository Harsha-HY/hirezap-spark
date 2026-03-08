import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Zap, Building2, BarChart3, Shield, Settings, Bell, LogOut,
  Plus, Users, Briefcase, UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion } from "framer-motion";
import AddCompanyPanel from "@/components/AddCompanyPanel";

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

const navItems = [
  { icon: Building2, label: "Companies" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Shield, label: "Security" },
  { icon: Settings, label: "Settings" },
];

const OwnerDashboard = () => {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("Companies");
  const [ownerName, setOwnerName] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [adminMap, setAdminMap] = useState<Record<string, { full_name: string; email: string }>>({});

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: user } = await supabase
      .from("users")
      .select("full_name")
      .eq("user_id", session.user.id)
      .single();
    if (user) setOwnerName(user.full_name);

    const { data: comps } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    if (comps) {
      setCompanies(comps);
      // Fetch admins for these companies
      const companyIds = comps.map((c) => c.id);
      if (companyIds.length > 0) {
        const { data: admins } = await supabase
          .from("users")
          .select("full_name, email, company_id")
          .eq("role", "superadmin")
          .in("company_id", companyIds);
        if (admins) {
          const map: Record<string, { full_name: string; email: string }> = {};
          admins.forEach((a) => {
            if (a.company_id) map[a.company_id] = { full_name: a.full_name, email: a.email };
          });
          setAdminMap(map);
        }
      }
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const stats = [
    { icon: Building2, label: "Total Companies", value: companies.length, color: "text-primary" },
    { icon: UserCheck, label: "Total Super Admins", value: Object.keys(adminMap).length, color: "text-blue-400" },
    { icon: Briefcase, label: "Total Active Jobs", value: 0, color: "text-amber-400" },
    { icon: Users, label: "Total Candidates", value: 0, color: "text-purple-400" },
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
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-6 border-b border-border">
          <Zap className="h-7 w-7 text-primary fill-primary" />
          <span className="text-xl font-extrabold tracking-tight text-foreground">
            Hire<span className="text-primary">Zap</span>
          </span>
        </div>

        {/* Nav */}
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
              <Icon className="h-4.5 w-4.5" />
              {label}
            </button>
          ))}
        </nav>

        {/* Owner info */}
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

      {/* Main */}
      <div className="ml-60 flex-1 flex flex-col">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-8 py-4">
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </button>
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
              {ownerName?.charAt(0)?.toUpperCase() || "O"}
            </div>
          </div>
        </header>

        {/* Content */}
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

          {/* Companies Section */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Companies</h2>
              <Button
                onClick={() => setPanelOpen(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                Add Company
              </Button>
            </div>

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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      No companies yet. Click "+ Add Company" to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  companies.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.company_name}</TableCell>
                      <TableCell>{adminMap[c.id]?.full_name || "—"}</TableCell>
                      <TableCell>{adminMap[c.id]?.email || "—"}</TableCell>
                      <TableCell>
                        <span className="rounded bg-secondary px-2 py-1 text-xs font-mono">{c.company_code}</span>
                      </TableCell>
                      <TableCell>
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{c.plan}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.status === "active" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                          {c.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(c.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                          •••
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </main>
      </div>

      {/* Add Company Panel */}
      <AddCompanyPanel open={panelOpen} onOpenChange={setPanelOpen} onCompanyCreated={fetchData} />
    </div>
  );
};

export default OwnerDashboard;
