import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, ArrowRight, Clock, AlertTriangle, Send } from "lucide-react";

const TechnicalTest = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [application, setApplication] = useState<any>(null);
  const [assessment, setAssessment] = useState<any>(null);

  const [dsaProblems, setDsaProblems] = useState<any[]>([]);
  const [codingTasks, setCodingTasks] = useState<any[]>([]);
  const [mcqQuestions, setMcqQuestions] = useState<any[]>([]);

  // Answers
  const [dsaAnswers, setDsaAnswers] = useState<Record<number, string>>({});
  const [codingAnswers, setCodingAnswers] = useState<Record<number, string>>({});
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, number | null>>({});

  // Current indexes
  const [currentMcq, setCurrentMcq] = useState(0);

  // Timer
  const [timeLeft, setTimeLeft] = useState(90 * 60); // 90 minutes

  // Tab switch detection
  const [violations, setViolations] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  // Timer
  useEffect(() => {
    if (submitted || loading) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [submitted, loading]);

  // Tab switch detection
  useEffect(() => {
    if (submitted) return;
    const handleVisibility = () => {
      if (document.hidden) {
        const msg = `Tab switch detected at ${new Date().toLocaleTimeString()}`;
        setViolations((prev) => [...prev, msg]);
        toast({ title: "⚠️ Warning!", description: "Tab switching detected. This will be reported.", variant: "destructive" });
        reportViolation("tab_switch", "Candidate switched tabs during technical test");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [submitted]);

  // Block copy/paste
  useEffect(() => {
    if (submitted) return;
    const handleCopy = (e: Event) => {
      e.preventDefault();
      toast({ title: "⚠️ Copy/Paste Blocked", description: "This action is not allowed during the test.", variant: "destructive" });
      reportViolation("copy_paste", "Attempted copy/paste during technical test");
    };
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handleCopy);
    document.addEventListener("cut", handleCopy);
    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handleCopy);
      document.removeEventListener("cut", handleCopy);
    };
  }, [submitted]);

  const reportViolation = async (type: string, description: string) => {
    if (!application) return;
    await supabase.from("test_violations").insert({
      application_id: application.id,
      candidate_id: application.candidate_id,
      job_id: application.job_id,
      violation_type: type,
      description,
    });
  };

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: userData } = await supabase.from("users").select("id").eq("user_id", session.user.id).maybeSingle();
    if (!userData) return;

    // Get application at technical_test stage
    const { data: apps } = await supabase
      .from("applications")
      .select("*")
      .eq("candidate_id", userData.id)
      .eq("current_stage", "technical_test");

    if (!apps || apps.length === 0) {
      toast({ title: "No Test Available", description: "You don't have a technical test pending.", variant: "destructive" });
      navigate("/candidate-dashboard");
      return;
    }

    const app = apps[0];
    setApplication(app);

    // Get approved technical assessment
    const { data: assessmentData } = await supabase
      .from("assessments")
      .select("*")
      .eq("application_id", app.id)
      .eq("type", "technical")
      .eq("status", "approved")
      .maybeSingle();

    if (!assessmentData) {
      toast({ title: "Test Not Ready", description: "Your technical test is not yet approved.", variant: "destructive" });
      navigate("/candidate-dashboard");
      return;
    }

    setAssessment(assessmentData);
    const q = assessmentData.questions as any;
    setDsaProblems(q?.dsa_problems || []);
    setCodingTasks(q?.coding_tasks || []);
    setMcqQuestions(q?.mcq_questions || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (submitting || submitted) return;
    setSubmitting(true);

    try {
      toast({ title: "📤 Submitting...", description: "AI is analyzing your code. This may take a moment." });

      // Save MCQ answers to test_answers table
      const mcqStartIdx = dsaProblems.length + codingTasks.length;
      const allAnswers: any[] = [];
      mcqQuestions.forEach((_, i) => {
        allAnswers.push({
          application_id: application.id,
          question_index: mcqStartIdx + i,
          selected_option: mcqAnswers[i] ?? null,
          time_spent_seconds: 0,
        });
      });
      if (allAnswers.length > 0) {
        await supabase.from("test_answers").insert(allAnswers);
      }

      // Call AI scoring edge function
      const { data, error } = await supabase.functions.invoke("score-technical", {
        body: {
          applicationId: application.id,
          dsaProblems,
          codingTasks,
          mcqQuestions,
          dsaAnswers,
          codingAnswers,
          mcqAnswers,
        },
      });

      if (error) throw error;

      setSubmitted(true);
      toast({ title: "✅ Test Submitted!", description: "Your technical test has been submitted and AI analysis is complete." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center p-8 rounded-2xl border border-border bg-card max-w-md">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Test Submitted!</h2>
          <p className="text-muted-foreground mb-6">Your technical test has been submitted. You'll be notified once the results are reviewed.</p>
          <Button onClick={() => navigate("/candidate-dashboard")} className="bg-primary text-primary-foreground">Back to Dashboard</Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with timer */}
      <div className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">💻 Technical Assessment</h1>
            <p className="text-xs text-muted-foreground">{dsaProblems.length} DSA • {codingTasks.length} Coding • {mcqQuestions.length} MCQ</p>
          </div>
          <div className="flex items-center gap-4">
            {violations.length > 0 && (
              <div className="flex items-center gap-1 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4" />
                {violations.length} violations
              </div>
            )}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${timeLeft < 300 ? "border-destructive bg-destructive/10 text-destructive" : "border-border text-foreground"}`}>
              <Clock className="h-4 w-4" />
              <span className="font-mono font-bold text-lg">{formatTime(timeLeft)}</span>
            </div>
            <Button onClick={handleSubmit} disabled={submitting} className="bg-primary text-primary-foreground gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit Test
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <Tabs defaultValue="dsa" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="dsa">🧩 DSA Problems ({dsaProblems.length})</TabsTrigger>
            <TabsTrigger value="coding">💻 Coding Tasks ({codingTasks.length})</TabsTrigger>
            <TabsTrigger value="mcq">📝 MCQ ({mcqQuestions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="dsa" className="space-y-6">
            {dsaProblems.map((p, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-muted-foreground">Problem #{p.problem_number || idx + 1}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${p.difficulty === "easy" ? "bg-primary/10 text-primary" : p.difficulty === "hard" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-500"}`}>{p.difficulty}</span>
                  <span className="text-[10px] text-muted-foreground">{p.time_minutes} min</span>
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">{p.description}</p>
                {p.test_cases?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-foreground mb-1">Test Cases:</p>
                    {p.test_cases.map((tc: string, i: number) => (
                      <p key={i} className="text-xs font-mono bg-muted/50 rounded px-2 py-1 mb-1 text-muted-foreground">{tc}</p>
                    ))}
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Your Solution:</label>
                  <Textarea
                    value={dsaAnswers[idx] || ""}
                    onChange={(e) => setDsaAnswers({ ...dsaAnswers, [idx]: e.target.value })}
                    placeholder="Write your code solution here..."
                    className="font-mono text-sm min-h-[200px]"
                  />
                </div>
              </motion.div>
            ))}
          </TabsContent>

          <TabsContent value="coding" className="space-y-6">
            {codingTasks.map((t, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-muted-foreground">Task #{t.task_number || idx + 1}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${t.difficulty === "easy" ? "bg-primary/10 text-primary" : t.difficulty === "hard" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-500"}`}>{t.difficulty}</span>
                  <span className="text-[10px] text-muted-foreground">{t.time_minutes} min</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-500">{t.tech_stack}</span>
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{t.title}</h3>
                <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap">{t.description}</p>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Your Code:</label>
                  <Textarea
                    value={codingAnswers[idx] || ""}
                    onChange={(e) => setCodingAnswers({ ...codingAnswers, [idx]: e.target.value })}
                    placeholder="Write your code here..."
                    className="font-mono text-sm min-h-[200px]"
                  />
                </div>
              </motion.div>
            ))}
          </TabsContent>

          <TabsContent value="mcq">
            {mcqQuestions.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">Question {currentMcq + 1} of {mcqQuestions.length}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${mcqQuestions[currentMcq].difficulty === "easy" ? "bg-primary/10 text-primary" : mcqQuestions[currentMcq].difficulty === "hard" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-500"}`}>{mcqQuestions[currentMcq].difficulty}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-500">{mcqQuestions[currentMcq].topic}</span>
                  </div>
                  {/* Progress dots */}
                  <div className="flex gap-1">
                    {mcqQuestions.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentMcq(i)}
                        className={`h-2.5 w-2.5 rounded-full transition-colors ${
                          i === currentMcq ? "bg-primary" : mcqAnswers[i] !== null && mcqAnswers[i] !== undefined ? "bg-primary/40" : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-base font-medium text-foreground mb-6">{mcqQuestions[currentMcq].question}</p>

                <RadioGroup
                  value={mcqAnswers[currentMcq]?.toString() ?? ""}
                  onValueChange={(v) => setMcqAnswers({ ...mcqAnswers, [currentMcq]: parseInt(v) })}
                  className="space-y-3"
                >
                  {mcqQuestions[currentMcq].options.map((opt: string, oIdx: number) => (
                    <div key={oIdx} className={`flex items-center gap-3 rounded-xl border p-4 transition-colors cursor-pointer ${
                      mcqAnswers[currentMcq] === oIdx ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"
                    }`}>
                      <RadioGroupItem value={oIdx.toString()} id={`opt-${oIdx}`} />
                      <Label htmlFor={`opt-${oIdx}`} className="flex-1 cursor-pointer text-sm">
                        <span className="font-bold mr-2">{String.fromCharCode(65 + oIdx)}.</span>{opt}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>

                <div className="flex items-center justify-between mt-6">
                  <Button variant="outline" onClick={() => setCurrentMcq(Math.max(0, currentMcq - 1))} disabled={currentMcq === 0}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {Object.keys(mcqAnswers).filter((k) => mcqAnswers[parseInt(k)] !== null && mcqAnswers[parseInt(k)] !== undefined).length}/{mcqQuestions.length} answered
                  </span>
                  <Button variant="outline" onClick={() => setCurrentMcq(Math.min(mcqQuestions.length - 1, currentMcq + 1))} disabled={currentMcq === mcqQuestions.length - 1}>
                    Next <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TechnicalTest;
