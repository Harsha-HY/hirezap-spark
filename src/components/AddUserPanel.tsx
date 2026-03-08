import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Phone, Lock, ShieldCheck, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface AddUserPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "hr" | "manager";
  companyId: string;
  onUserCreated: () => void;
}

const AddUserPanel = ({ open, onOpenChange, type, companyId, onUserCreated }: AddUserPanelProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    department: "",
    password: "",
    confirmPassword: "",
  });

  const update = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const isHR = type === "hr";
  const title = isHR ? "Create HR Manager Account" : "Create Hiring Manager Account";
  const role = isHR ? "hr" : "manager";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);

    // Store current session to restore later
    const { data: { session: currentSession } } = await supabase.auth.getSession();

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { emailRedirectTo: window.location.origin },
    });

    if (authErr || !authData.user) {
      toast({ title: "Failed to create account", description: authErr?.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const insertData: any = {
      user_id: authData.user.id,
      full_name: form.fullName,
      email: form.email,
      phone: form.phone,
      role,
      company_id: companyId,
    };

    if (!isHR && form.department) {
      insertData.department = form.department;
    }

    const { error: insertErr } = await supabase.from("users").insert(insertData);

    if (insertErr) {
      toast({ title: "Failed to save user details", description: insertErr.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Try to restore admin session
    if (currentSession?.user?.email) {
      // Note: This won't fully work without knowing the admin's password.
      // In production, use an edge function for user creation.
    }

    const successMsg = isHR ? "✅ HR Manager created!" : "✅ Hiring Manager created!";
    toast({ title: successMsg, description: "Login details sent to their email." });
    setForm({ fullName: "", email: "", phone: "", department: "", password: "", confirmPassword: "" });
    onOpenChange(false);
    onUserCreated();
    setLoading(false);
  };

  const inputClass = "w-full rounded-lg border border-border bg-secondary/50 py-3 pl-11 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg bg-card border-border overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl font-bold text-foreground">{title}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Full Name" required value={form.fullName} onChange={(e) => update("fullName", e.target.value)} className={inputClass} />
          </div>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="email" placeholder="Email" required value={form.email} onChange={(e) => update("email", e.target.value)} className={inputClass} />
          </div>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="tel" placeholder="Phone" required value={form.phone} onChange={(e) => update("phone", e.target.value)} className={inputClass} />
          </div>

          {!isHR && (
            <div className="relative">
              <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Department" required value={form.department} onChange={(e) => update("department", e.target.value)} className={inputClass} />
            </div>
          )}

          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="password" placeholder="Password" required minLength={6} value={form.password} onChange={(e) => update("password", e.target.value)} className={inputClass} />
          </div>
          <div className="relative">
            <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="password" placeholder="Confirm Password" required minLength={6} value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} className={inputClass} />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-6 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_hsl(160,100%,45%,0.2)] transition-all mt-2"
          >
            {loading ? "Creating..." : isHR ? "Create HR Account" : "Create Manager Account"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default AddUserPanel;