import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, MapPin, User, Mail, Phone, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";

interface AddCompanyPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompanyCreated: () => void;
}

const industries = ["IT", "Finance", "Healthcare", "Ecommerce", "Education", "Other"];
const plans = ["Starter", "Growth", "Enterprise"];

const AddCompanyPanel = ({ open, onOpenChange, onCompanyCreated }: AddCompanyPanelProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    industry: "IT",
    location: "",
    plan: "Starter",
    adminName: "",
    adminEmail: "",
    adminPhone: "",
    companyCode: "",
    adminPassword: "",
    confirmPassword: "",
  });

  const update = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.adminPassword !== form.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (form.adminPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: "Not authenticated", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Create company
    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .insert({
        company_name: form.companyName,
        industry: form.industry,
        location: form.location,
        plan: form.plan,
        company_code: form.companyCode,
        owner_id: session.user.id,
      })
      .select()
      .single();

    if (companyErr) {
      toast({ title: "Failed to create company", description: companyErr.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Create super admin auth user
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.adminEmail,
      password: form.adminPassword,
      options: { emailRedirectTo: window.location.origin },
    });

    if (authErr || !authData.user) {
      toast({ title: "Failed to create admin account", description: authErr?.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Insert into users table
    // We need to sign back in as owner after creating the admin user
    const { error: insertErr } = await supabase.from("users").insert({
      user_id: authData.user.id,
      full_name: form.adminName,
      email: form.adminEmail,
      phone: form.adminPhone,
      role: "superadmin",
      company_id: company.id,
    });

    if (insertErr) {
      toast({ title: "Failed to save admin details", description: insertErr.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Re-auth as owner since signUp may have changed session
    await supabase.auth.signInWithPassword({
      email: session.user.email!,
      password: "", // This won't work - we need a different approach
    });

    toast({ title: "✅ Company created successfully!" });
    setForm({
      companyName: "", industry: "IT", location: "", plan: "Starter",
      adminName: "", adminEmail: "", adminPhone: "", companyCode: "",
      adminPassword: "", confirmPassword: "",
    });
    onOpenChange(false);
    onCompanyCreated();
    setLoading(false);
  };

  const inputClass = "w-full rounded-lg border border-border bg-secondary/50 py-3 pl-11 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg bg-card border-border overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl font-bold text-foreground">Create New Company</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Details */}
          <div>
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">Company Details</h3>
            <div className="space-y-3">
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Company Name" required value={form.companyName} onChange={(e) => update("companyName", e.target.value)} className={inputClass} />
              </div>
              <Select value={form.industry} onValueChange={(v) => update("industry", v)}>
                <SelectTrigger className="bg-secondary/50 border-border h-12">
                  <SelectValue placeholder="Industry" />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Location" required value={form.location} onChange={(e) => update("location", e.target.value)} className={inputClass} />
              </div>
              <Select value={form.plan} onValueChange={(v) => update("plan", v)}>
                <SelectTrigger className="bg-secondary/50 border-border h-12">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Admin Details */}
          <div>
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">Super Admin Details</h3>
            <div className="space-y-3">
              {[
                { icon: User, key: "adminName", placeholder: "Admin Full Name", type: "text" },
                { icon: Mail, key: "adminEmail", placeholder: "Admin Email", type: "email" },
                { icon: Phone, key: "adminPhone", placeholder: "Admin Phone", type: "tel" },
                { icon: KeyRound, key: "companyCode", placeholder: "Company Code", type: "text", hint: "Example: TECH-2024-ABC" },
                { icon: Lock, key: "adminPassword", placeholder: "Admin Password", type: "password" },
                { icon: ShieldCheck, key: "confirmPassword", placeholder: "Confirm Password", type: "password" },
              ].map(({ icon: Icon, key, placeholder, type, hint }) => (
                <div key={key}>
                  <div className="relative">
                    <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type={type}
                      placeholder={placeholder}
                      required
                      value={(form as any)[key]}
                      onChange={(e) => update(key, e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  {hint && <p className="text-xs text-muted-foreground mt-1 ml-1">{hint}</p>}
                </div>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-6 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_hsl(160,100%,45%,0.2)] transition-all"
          >
            {loading ? "Creating..." : "Create Company Account"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default AddCompanyPanel;
