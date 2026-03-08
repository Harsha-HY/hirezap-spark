import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  application: any;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: () => void;
  currentUser: any;
}

const OfferLetterPanel = ({ application, candidateName, candidateEmail, jobTitle, open, onOpenChange, onGenerated, currentUser }: Props) => {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [designation, setDesignation] = useState(jobTitle || "");
  const [department, setDepartment] = useState("");
  const [ctcTotal, setCtcTotal] = useState("");
  const [basicSalary, setBasicSalary] = useState("");
  const [hra, setHra] = useState("");
  const [performanceBonus, setPerformanceBonus] = useState("");
  const [otherAllowances, setOtherAllowances] = useState("");
  const [esops, setEsops] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [acceptBy, setAcceptBy] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [workType, setWorkType] = useState("Onsite");
  const [probation, setProbation] = useState("3 months");

  useEffect(() => {
    if (open) setDesignation(jobTitle || "");
  }, [open, jobTitle]);

  const handleGenerate = async () => {
    if (!designation || !ctcTotal || !joiningDate || !acceptBy || !workLocation) {
      toast({ title: "Missing Fields", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("offer_letters").insert({
        application_id: application.id,
        candidate_id: application.candidate_id,
        job_id: application.job_id,
        company_id: currentUser.company_id,
        designation,
        department,
        ctc_total: parseFloat(ctcTotal),
        basic_salary: parseFloat(basicSalary || "0"),
        hra: parseFloat(hra || "0"),
        performance_bonus: parseFloat(performanceBonus || "0"),
        other_allowances: parseFloat(otherAllowances || "0"),
        esops: parseFloat(esops || "0"),
        joining_date: joiningDate,
        accept_by: acceptBy,
        work_location: workLocation,
        work_type: workType,
        probation_period: probation,
        status: "sent",
      } as any);

      if (error) throw error;

      // Update application stage
      await supabase.from("applications").update({ current_stage: "offer_sent" }).eq("id", application.id);

      // Notify candidate
      const { data: company } = await supabase.from("companies").select("company_name").eq("id", currentUser.company_id).maybeSingle();
      await supabase.from("notifications").insert({
        user_id: application.candidate_id,
        title: "🎉 Offer Letter Received!",
        message: `Congratulations! You have received an offer from ${company?.company_name || "the company"}!\n\nRole: ${designation}\nCTC: ₹${parseFloat(ctcTotal).toLocaleString()} per annum\nJoining: ${joiningDate}\nAccept by: ${acceptBy}\n\nLogin to view your complete offer letter and accept, negotiate, or decline.`,
      });

      // Notify manager
      const { data: managers } = await supabase.from("users").select("id").eq("role", "manager").eq("company_id", currentUser.company_id);
      for (const mgr of (managers || [])) {
        await supabase.from("notifications").insert({
          user_id: mgr.id,
          title: "📄 Offer Letter Sent",
          message: `${currentUser.full_name} sent an offer letter to ${candidateName} for ${designation} at ₹${parseFloat(ctcTotal).toLocaleString()}/yr.`,
        });
      }

      toast({ title: "✅ Offer Letter Generated!", description: `${candidateName} has been notified.` });
      onGenerated();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Generate Offer Letter</DialogTitle>
        </DialogHeader>

        <div className="bg-muted/50 rounded-lg p-3 mb-2 text-sm">
          <p><span className="text-muted-foreground">Candidate:</span> <span className="font-medium text-foreground">{candidateName}</span></p>
          <p><span className="text-muted-foreground">Email:</span> <span className="font-medium text-foreground">{candidateEmail}</span></p>
          <p><span className="text-muted-foreground">Job:</span> <span className="font-medium text-foreground">{jobTitle}</span></p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Designation *</Label>
              <Input value={designation} onChange={e => setDesignation(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input value={department} onChange={e => setDepartment(e.target.value)} />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-semibold text-foreground mb-3">Compensation Details</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>CTC Total (₹/year) *</Label>
                <Input type="number" value={ctcTotal} onChange={e => setCtcTotal(e.target.value)} placeholder="e.g. 1200000" />
              </div>
              <div className="space-y-1.5">
                <Label>Basic Salary (₹)</Label>
                <Input type="number" value={basicSalary} onChange={e => setBasicSalary(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>HRA (₹)</Label>
                <Input type="number" value={hra} onChange={e => setHra(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Performance Bonus (₹)</Label>
                <Input type="number" value={performanceBonus} onChange={e => setPerformanceBonus(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Other Allowances (₹)</Label>
                <Input type="number" value={otherAllowances} onChange={e => setOtherAllowances(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>ESOPs (₹, optional)</Label>
                <Input type="number" value={esops} onChange={e => setEsops(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-semibold text-foreground mb-3">Joining Details</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Joining Date *</Label>
                <Input type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Accept By Date *</Label>
                <Input type="date" value={acceptBy} onChange={e => setAcceptBy(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Work Location *</Label>
                <Input value={workLocation} onChange={e => setWorkLocation(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Work Type</Label>
                <Select value={workType} onValueChange={setWorkType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Onsite">Onsite</SelectItem>
                    <SelectItem value="Remote">Remote</SelectItem>
                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Probation Period</Label>
                <Select value={probation} onValueChange={setProbation}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3 months">3 months</SelectItem>
                    <SelectItem value="6 months">6 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={submitting} className="w-full gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {submitting ? "Generating..." : "Generate Offer Letter"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OfferLetterPanel;
