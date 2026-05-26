import { useEffect, useState } from "react";
import { X, Mail, Phone, MapPin, Briefcase, Calendar, Building2, Users, CheckCircle, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
}

interface CompanyData {
  company_name: string;
  industry: string;
  location: string;
}

interface CandidateStats {
  total: number;
  selected: number;
  pending: number;
}

interface HiringStats {
  jobsCreated: number;
  candidatesReviewed: number;
  selected: number;
}

const UserDetailsModal = ({ open, onOpenChange, user }: UserDetailsModalProps) => {
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [stats, setStats] = useState<any>(null);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchDetails();
    }
  }, [open, user]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      // Fetch company details
      if (user?.company_id) {
        const { data: company } = await supabase
          .from("companies")
          .select("company_name, industry, location")
          .eq("id", user.company_id)
          .maybeSingle();

        if (company) setCompanyData(company);

        // Fetch candidates managed by this HR/Manager
        const { data: candidates } = await supabase
          .from("candidate_applications")
          .select("id, status")
          .eq("created_by", user.id);

        // Fetch jobs created by this manager
        const { data: jobs } = await supabase
          .from("jobs")
          .select("id")
          .eq("created_by", user.id);

        if (candidates) {
          const selected = candidates.filter((c) => c.status === "selected").length;
          const pending = candidates.filter((c) => c.status === "pending").length;
          setStats({
            candidatesReviewed: candidates.length,
            candidatesSelected: selected,
            candidatesPending: pending,
            jobsCreated: jobs?.length || 0,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching details:", error);
      toast({ title: "Error", description: "Failed to fetch user details" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card shadow-lg"
          >
            {/* Header */}
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-6 py-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{user?.full_name}</h2>
                <p className="text-sm text-muted-foreground capitalize">{user?.role}</p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-lg hover:bg-secondary p-2 transition-colors"
              >
                <X className="h-5 w-5 text-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium text-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="text-sm font-medium text-foreground">{user?.phone || "Not provided"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Department</p>
                      <p className="text-sm font-medium text-foreground">{user?.department || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Joined</p>
                      <p className="text-sm font-medium text-foreground">
                        {new Date(user?.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Company Information */}
              {companyData && (
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Company Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Company Name</p>
                        <p className="text-sm font-medium text-foreground">{companyData.company_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Award className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Industry</p>
                        <p className="text-sm font-medium text-foreground">{companyData.industry || "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Location</p>
                        <p className="text-sm font-medium text-foreground">{companyData.location || "—"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Performance Stats */}
              {stats && (
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Performance Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="rounded-lg border border-border bg-background p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-primary" />
                        <p className="text-xs text-muted-foreground">Candidates Reviewed</p>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{stats.candidatesReviewed}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <p className="text-xs text-muted-foreground">Selected</p>
                      </div>
                      <p className="text-2xl font-bold text-green-500">{stats.candidatesSelected}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <p className="text-xs text-muted-foreground">Pending</p>
                      </div>
                      <p className="text-2xl font-bold text-amber-500">{stats.candidatesPending}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="h-4 w-4 text-blue-500" />
                        <p className="text-xs text-muted-foreground">Jobs Created</p>
                      </div>
                      <p className="text-2xl font-bold text-blue-500">{stats.jobsCreated}</p>
                    </div>
                  </div>
                </div>
              )}

              {loading && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading details...</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 border-t border-border bg-card px-6 py-4 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full md:w-auto"
              >
                Close
              </Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90 w-full md:w-auto"
                onClick={() => {
                  toast({ title: "Notification sent", description: `Notification sent to ${user?.full_name}` });
                }}
              >
                Send Notification
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Import Clock from lucide-react at the top
import { Clock } from "lucide-react";

export default UserDetailsModal;
