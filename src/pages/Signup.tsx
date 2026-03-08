import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Zap, User, Mail, Phone, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import authBg from "@/assets/auth-bg.jpg";

const Signup = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { count, error: countError } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    if (countError) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    if (count && count > 0) {
      setError("Access restricted. Contact your administrator.");
      setLoading(false);
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });

    if (authError || !authData.user) {
      setError(authError?.message || "Failed to create account.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("users").insert({
      user_id: authData.user.id,
      full_name: fullName,
      email,
      phone,
      role: "owner",
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    toast({
      title: "Account created!",
      description: "Redirecting to your dashboard...",
    });

    setTimeout(() => navigate("/owner-dashboard"), 1500);
    setLoading(false);
  };

  const fields = [
    { icon: User, type: "text", placeholder: "Full Name", value: fullName, setter: setFullName, required: true },
    { icon: Mail, type: "email", placeholder: "Email address", value: email, setter: setEmail, required: true },
    { icon: Phone, type: "tel", placeholder: "Phone Number", value: phone, setter: setPhone, required: false },
    { icon: Lock, type: "password", placeholder: "Password", value: password, setter: setPassword, required: true, minLength: 6 },
    { icon: ShieldCheck, type: "password", placeholder: "Confirm Password", value: confirmPassword, setter: setConfirmPassword, required: true, minLength: 6 },
  ];

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background overflow-hidden py-12">
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: `url(${authBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/70 to-background/90" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center px-6">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10 text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <h1 className="text-5xl font-extrabold tracking-tight text-foreground">
              Hire<span className="text-primary">Zap</span>
            </h1>
            <motion.div
              animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Zap className="h-10 w-10 text-primary fill-primary drop-shadow-[0_0_12px_hsl(160,100%,45%)]" />
            </motion.div>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-1">Create Your Account</h2>
          <div className="mx-auto mt-3 h-px w-24 bg-gradient-to-r from-transparent via-primary to-transparent" />
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-5 w-full rounded-xl bg-destructive/10 border border-destructive/30 p-3.5 text-sm text-destructive text-center"
          >
            {error}
          </motion.div>
        )}

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          onSubmit={handleSignup}
          className="w-full space-y-4"
        >
          {fields.map(({ icon: Icon, type, placeholder, value, setter, required, minLength }, i) => (
            <motion.div
              key={placeholder}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
              className="group relative"
            >
              <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={(e) => setter(e.target.value)}
                required={required}
                minLength={minLength}
                className="w-full rounded-xl border border-border bg-card/60 backdrop-blur-sm py-3.5 pl-11 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </motion.div>
          ))}

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-6 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_hsl(160,100%,45%,0.3)] hover:shadow-[0_0_30px_hsl(160,100%,45%,0.5)] transition-all"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </Button>
        </motion.form>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-8 text-center text-sm text-muted-foreground"
        >
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-primary font-medium hover:underline underline-offset-4"
          >
            Login
          </Link>
        </motion.p>
      </div>
    </div>
  );
};

export default Signup;
