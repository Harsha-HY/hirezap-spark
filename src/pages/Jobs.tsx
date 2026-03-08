import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Search, MapPin, Briefcase, Clock, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import ApplicationPanel from "@/components/ApplicationPanel";

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  work_type: string;
  salary_min: number | null;
  salary_max: number | null;
  experience_min: number | null;
  experience_max: number | null;
  skills_required: string[] | null;
  job_description: string | null;
  created_at: string;
  company_id: string;
  companies?: { company_name: string } | null;
}

const Jobs = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [workTypeFilter, setWorkTypeFilter] = useState("All");
  const [expFilter, setExpFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    const { data } = await supabase
      .from("jobs")
      .select("*, companies(company_name)")
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (data) {
      setJobs(data as unknown as Job[]);
      const locs = [...new Set((data as unknown as Job[]).map((j) => j.location))];
      setLocations(locs);
    }
    setLoading(false);
  };

  const handleApply = async (job: Job) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Store job id for redirect after signup
      sessionStorage.setItem("applyJobId", job.id);
      navigate("/candidate-signup");
      return;
    }
    // Check if candidate
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (userData?.role !== "candidate") {
      navigate("/candidate-signup");
      return;
    }

    setSelectedJob(job);
    setPanelOpen(true);
  };

  const filtered = jobs.filter((j) => {
    const matchSearch =
      !search ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      (j.skills_required || []).some((s) => s.toLowerCase().includes(search.toLowerCase()));

    const matchLocation = !locationFilter || j.location === locationFilter;
    const matchWorkType = workTypeFilter === "All" || j.work_type === workTypeFilter;

    let matchExp = true;
    if (expFilter !== "All") {
      const min = j.experience_min || 0;
      if (expFilter === "0-1") matchExp = min <= 1;
      else if (expFilter === "1-3") matchExp = min >= 1 && min <= 3;
      else if (expFilter === "3-5") matchExp = min >= 3 && min <= 5;
      else if (expFilter === "5+") matchExp = min >= 5;
    }

    return matchSearch && matchLocation && matchWorkType && matchExp;
  });

  const selectClass = "rounded-lg border border-border bg-card/80 py-2.5 px-3 text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-foreground">
              Hire<span className="text-primary">Zap</span>
            </h1>
            <Zap className="h-6 w-6 text-primary fill-primary" />
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate("/login")} className="text-muted-foreground hover:text-foreground">
              Login
            </Button>
            <Button onClick={() => navigate("/candidate-signup")} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Sign Up
            </Button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-6 pt-12 pb-8 text-center">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-extrabold text-foreground mb-3"
        >
          Find Your <span className="text-primary">Dream Job</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground text-lg"
        >
          Discover opportunities that match your skills and ambition
        </motion.p>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap gap-3 p-4 rounded-2xl border border-border bg-card/60 backdrop-blur-sm"
        >
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by title or skill..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-card/80 py-2.5 pl-10 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
            />
          </div>
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className={selectClass}>
            <option value="">All Locations</option>
            {locations.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <select value={workTypeFilter} onChange={(e) => setWorkTypeFilter(e.target.value)} className={selectClass}>
            <option value="All">All Types</option>
            <option value="Onsite">Onsite</option>
            <option value="Remote">Remote</option>
            <option value="Hybrid">Hybrid</option>
          </select>
          <select value={expFilter} onChange={(e) => setExpFilter(e.target.value)} className={selectClass}>
            <option value="All">All Experience</option>
            <option value="0-1">0-1 years</option>
            <option value="1-3">1-3 years</option>
            <option value="3-5">3-5 years</option>
            <option value="5+">5+ years</option>
          </select>
        </motion.div>
      </div>

      {/* Job Cards */}
      <div className="max-w-7xl mx-auto px-6 pb-16">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="text-lg">No jobs found matching your criteria.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((job, i) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="rounded-2xl border border-border bg-card p-6 hover:border-primary/40 transition-all group"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{job.title}</h3>
                  <span className="shrink-0 ml-2 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                    {job.work_type}
                  </span>
                </div>

                <p className="text-sm text-primary font-medium mb-3">
                  {(job as any).companies?.company_name || "Company"}
                </p>

                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{job.location}</span>
                  </div>
                  {(job.salary_min || job.salary_max) && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>
                        {job.salary_min && job.salary_max
                          ? `₹${job.salary_min}L - ₹${job.salary_max}L`
                          : job.salary_min
                          ? `₹${job.salary_min}L+`
                          : `Up to ₹${job.salary_max}L`}
                      </span>
                    </div>
                  )}
                  {(job.experience_min !== null || job.experience_max !== null) && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {job.experience_min !== null && job.experience_max !== null
                          ? `${job.experience_min}-${job.experience_max} years`
                          : job.experience_min !== null
                          ? `${job.experience_min}+ years`
                          : `Up to ${job.experience_max} years`}
                      </span>
                    </div>
                  )}
                </div>

                {job.skills_required && job.skills_required.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {job.skills_required.slice(0, 5).map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded-md text-xs bg-secondary text-muted-foreground">
                        {s}
                      </span>
                    ))}
                    {job.skills_required.length > 5 && (
                      <span className="px-2 py-0.5 rounded-md text-xs bg-secondary text-muted-foreground">
                        +{job.skills_required.length - 5}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {new Date(job.created_at).toLocaleDateString()}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleApply(job)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_12px_hsl(160,100%,45%,0.2)]"
                  >
                    Apply Now
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <ApplicationPanel open={panelOpen} onOpenChange={setPanelOpen} job={selectedJob} onSuccess={fetchJobs} />
    </div>
  );
};

export default Jobs;
