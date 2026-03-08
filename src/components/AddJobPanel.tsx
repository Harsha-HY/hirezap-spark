import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, MapPin, DollarSign, Clock, Zap, X, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

interface AddJobPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  hrUserId: string;
  managers: { id: string; full_name: string }[];
  onJobCreated: () => void;
}

const workTypes = ["Onsite", "Remote", "Hybrid"];

const AddJobPanel = ({ open, onOpenChange, companyId, hrUserId, managers, onJobCreated }: AddJobPanelProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [form, setForm] = useState({
    title: "",
    department: "",
    managerId: "",
    salaryMin: "",
    salaryMax: "",
    location: "",
    workType: "Onsite",
    experienceMin: "",
    experienceMax: "",
    skills: [] as string[],
    description: "",
    aptitudeCutoff: 60,
  });

  const update = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const addSkill = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && skillInput.trim()) {
      e.preventDefault();
      if (!form.skills.includes(skillInput.trim())) {
        setForm((p) => ({ ...p, skills: [...p.skills, skillInput.trim()] }));
      }
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setForm((p) => ({ ...p, skills: p.skills.filter((s) => s !== skill) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("jobs").insert({
      title: form.title,
      department: form.department,
      manager_id: form.managerId || null,
      salary_min: form.salaryMin ? Number(form.salaryMin) : null,
      salary_max: form.salaryMax ? Number(form.salaryMax) : null,
      location: form.location,
      work_type: form.workType,
      experience_min: form.experienceMin ? Number(form.experienceMin) : null,
      experience_max: form.experienceMax ? Number(form.experienceMax) : null,
      skills_required: form.skills,
      job_description: form.description || null,
      posted_by: hrUserId,
      company_id: companyId,
      status: "open",
      aptitude_cutoff: form.aptitudeCutoff,
    } as any);

    if (error) {
      toast({ title: "Failed to post job", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Send notification to assigned manager
    if (form.managerId) {
      await supabase.from("notifications").insert({
        user_id: form.managerId,
        title: "New Job Posted",
        message: `New job posted for your team: ${form.title}`,
      });
    }

    toast({ title: "✅ Job posted successfully!" });
    setForm({
      title: "", department: "", managerId: "", salaryMin: "", salaryMax: "",
      location: "", workType: "Onsite", experienceMin: "", experienceMax: "",
      skills: [], description: "", aptitudeCutoff: 60,
    });
    onOpenChange(false);
    onJobCreated();
    setLoading(false);
  };

  const inputClass = "w-full rounded-lg border border-border bg-secondary/50 py-3 pl-11 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm";
  const simpleInputClass = "w-full rounded-lg border border-border bg-secondary/50 py-3 px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg bg-card border-border overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl font-bold text-foreground">Post New Job</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Job Title */}
          <div className="relative">
            <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Job Title" required value={form.title} onChange={(e) => update("title", e.target.value)} className={inputClass} />
          </div>

          {/* Department */}
          <div className="relative">
            <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Department" required value={form.department} onChange={(e) => update("department", e.target.value)} className={inputClass} />
          </div>

          {/* Assign Manager */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Assign Manager</label>
            <Select value={form.managerId} onValueChange={(v) => update("managerId", v)}>
              <SelectTrigger className="bg-secondary/50 border-border h-12">
                <SelectValue placeholder="Select a manager" />
              </SelectTrigger>
              <SelectContent>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                ))}
                {managers.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No managers available</div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Salary Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="number" placeholder="Salary Min" value={form.salaryMin} onChange={(e) => update("salaryMin", e.target.value)} className={inputClass} />
            </div>
            <div className="relative">
              <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="number" placeholder="Salary Max" value={form.salaryMax} onChange={(e) => update("salaryMax", e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Location */}
          <div className="relative">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Location" required value={form.location} onChange={(e) => update("location", e.target.value)} className={inputClass} />
          </div>

          {/* Work Type */}
          <Select value={form.workType} onValueChange={(v) => update("workType", v)}>
            <SelectTrigger className="bg-secondary/50 border-border h-12">
              <SelectValue placeholder="Work Type" />
            </SelectTrigger>
            <SelectContent>
              {workTypes.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Experience Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="number" placeholder="Exp Min (yrs)" value={form.experienceMin} onChange={(e) => update("experienceMin", e.target.value)} className={inputClass} />
            </div>
            <div className="relative">
              <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="number" placeholder="Exp Max (yrs)" value={form.experienceMax} onChange={(e) => update("experienceMax", e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Skills */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Skills Required</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.skills.map((skill) => (
                <span key={skill} className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {skill}
                  <button type="button" onClick={() => removeSkill(skill)} className="hover:text-destructive transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <Zap className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Type a skill and press Enter"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={addSkill}
                className={inputClass}
              />
            </div>
          </div>

          {/* Job Description */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Job Description</label>
            <textarea
              placeholder="Enter job description..."
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={4}
              className={`${simpleInputClass} resize-none`}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-6 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_hsl(160,100%,45%,0.2)] transition-all mt-2"
          >
            {loading ? "Posting..." : "Post Job"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default AddJobPanel;
