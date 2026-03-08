import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";
import { Shield, Clock, Camera, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TestQuestion {
  question_number: number;
  question: string;
  options: string[];
  correct_answer: string;
  difficulty: string;
  time_seconds: number;
  section?: string;
}

const AptitudeTest = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Auth & access
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [application, setApplication] = useState<any>(null);
  const [candidateId, setCandidateId] = useState("");
  const [questions, setQuestions] = useState<TestQuestion[]>([]);

  // Test state
  const [phase, setPhase] = useState<"rules" | "test" | "submitted">("rules");
  const [agreed, setAgreed] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [timeLeft, setTimeLeft] = useState(45 * 60);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [timePerQuestion, setTimePerQuestion] = useState<number[]>([]);
  const [violations, setViolations] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Webcam
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check authorization and load questions from assessments
  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }

      const { data: user } = await supabase
        .from("users")
        .select("id, role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!user || user.role !== "candidate") {
        setLoading(false);
        return;
      }

      setCandidateId(user.id);

      const { data: app } = await supabase
        .from("applications")
        .select("*")
        .eq("candidate_id", user.id)
        .eq("current_stage", "aptitude_test")
        .maybeSingle();

      if (app) {
        setApplication(app);

        // Load approved assessment questions
        const { data: assessment } = await supabase
          .from("assessments")
          .select("*")
          .eq("application_id", app.id)
          .eq("status", "approved")
          .maybeSingle();

        if (assessment?.questions) {
          const qs = assessment.questions as any;
          if (qs.sections) {
            const flatQuestions: TestQuestion[] = [];
            for (const section of qs.sections) {
              for (const q of section.questions) {
                flatQuestions.push({ ...q, section: section.name });
              }
            }
            setQuestions(flatQuestions);
            setAnswers(Array(flatQuestions.length).fill(null));
            setTimePerQuestion(Array(flatQuestions.length).fill(0));
            setAuthorized(true);
          }
        }
      }
      setLoading(false);
    };
    checkAccess();
  }, []);

  // Timer
  useEffect(() => {
    if (phase !== "test") return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Anti-cheat: Tab switch detection
  useEffect(() => {
    if (phase !== "test") return;

    const handleVisibility = () => {
      if (document.hidden) {
        recordViolation("tab_switch", `Switched tab at question ${currentQ + 1}`);
        toast({
          title: "⚠️ Tab switch detected!",
          description: "This has been reported to HR. 3 violations = test cancelled.",
          variant: "destructive",
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [phase, currentQ]);

  // Anti-cheat: Copy/Paste/Right-click
  useEffect(() => {
    if (phase !== "test") return;

    const blockCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      recordViolation("copy_paste", `Copy/paste attempted at question ${currentQ + 1}`);
      toast({ title: "⚠️ Copy/Paste blocked!", description: "This action is not allowed.", variant: "destructive" });
    };

    const blockContext = (e: MouseEvent) => {
      e.preventDefault();
      toast({ title: "Right-click disabled", description: "Right-click is not allowed during the test." });
    };

    const blockKeys = (e: KeyboardEvent) => {
      // Block Ctrl+C, Ctrl+V, Ctrl+A, F12, etc.
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "a", "u"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        recordViolation("copy_paste", `Keyboard shortcut blocked at question ${currentQ + 1}`);
      }
      if (e.key === "F12" || (e.ctrlKey && e.shiftKey && e.key === "I")) {
        e.preventDefault();
      }
    };

    document.addEventListener("copy", blockCopy);
    document.addEventListener("paste", blockCopy);
    document.addEventListener("contextmenu", blockContext);
    document.addEventListener("keydown", blockKeys);

    return () => {
      document.removeEventListener("copy", blockCopy);
      document.removeEventListener("paste", blockCopy);
      document.removeEventListener("contextmenu", blockContext);
      document.removeEventListener("keydown", blockKeys);
    };
  }, [phase, currentQ]);

  const recordViolation = async (type: string, desc: string) => {
    setViolations((v) => v + 1);
    if (!application) return;

    await supabase.from("test_violations").insert({
      application_id: application.id,
      candidate_id: candidateId,
      job_id: application.job_id,
      violation_type: type,
      description: desc,
      question_number: currentQ + 1,
    });
  };

  const startTest = async () => {
    // Request fullscreen
    try {
      await document.documentElement.requestFullscreen();
    } catch (e) {
      console.warn("Fullscreen not supported");
    }

    // Start webcam
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      toast({ title: "Camera Required", description: "Please enable your camera to take the test.", variant: "destructive" });
      return;
    }

    setPhase("test");
    setQuestionStartTime(Date.now());
  };

  const selectAnswer = (optionIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQ] = optionIndex;
    setAnswers(newAnswers);
  };

  const goToQuestion = (idx: number) => {
    // Record time spent on current question
    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    const newTimes = [...timePerQuestion];
    newTimes[currentQ] += elapsed;
    setTimePerQuestion(newTimes);

    // Check if answered too fast (< 3 seconds)
    if (elapsed < 3 && answers[currentQ] !== null) {
      recordViolation("too_fast", `Question ${currentQ + 1} answered in ${elapsed} seconds`);
    }

    setCurrentQ(idx);
    setQuestionStartTime(Date.now());
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    // Record last question time
    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    const finalTimes = [...timePerQuestion];
    finalTimes[currentQ] += elapsed;

    // Calculate score
    let correct = 0;
    const totalQ = questions.length;
    answers.forEach((ans, i) => {
      if (questions[i] && ans !== null) {
        const correctIdx = questions[i].correct_answer.charCodeAt(0) - 65;
        if (ans === correctIdx) correct++;
      }
    });
    const score = Math.round((correct / totalQ) * 100);

    // Save answers
    const answerRows = answers.map((ans, i) => ({
      application_id: application.id,
      question_index: i,
      selected_option: ans,
      time_spent_seconds: finalTimes[i],
    }));

    await supabase.from("test_answers").insert(answerRows);

    // Update application
    await supabase
      .from("applications")
      .update({
        test_score: score,
        current_stage: "test_completed",
      })
      .eq("id", application.id);

    // Notify HR - find HR users for this job's company
    const { data: job } = await supabase
      .from("jobs")
      .select("company_id, title")
      .eq("id", application.job_id)
      .maybeSingle();

    if (job) {
      const { data: hrUsers } = await supabase
        .from("users")
        .select("id")
        .eq("company_id", job.company_id)
        .eq("role", "hr");

      if (hrUsers) {
        const { data: candidateUser } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", candidateId)
          .maybeSingle();

        const candidateName = candidateUser?.full_name || "Candidate";

        for (const hr of hrUsers) {
          await supabase.from("notifications").insert({
            user_id: hr.id,
            title: "Test Completed",
            message: `${candidateName} completed the aptitude test for ${job.title}. Score: ${score}/100. Violations: ${violations} flags.`,
          });
        }
      }
    }

    // Exit fullscreen
    try { await document.exitFullscreen(); } catch (e) {}

    // Stop webcam
    streamRef.current?.getTracks().forEach((t) => t.stop());

    setPhase("submitted");
    setSubmitting(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-8">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Test Not Available</h1>
        <p className="text-muted-foreground text-center max-w-md">
          The aptitude test is not available for you yet. You will receive a notification when HR opens the test for your profile.
        </p>
        <Button onClick={() => navigate("/candidate-dashboard")} variant="outline" className="mt-6">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (phase === "submitted") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-8">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mb-6">
          <CheckCircle className="h-20 w-20 text-primary" />
        </motion.div>
        <h1 className="text-2xl font-bold text-foreground mb-2">✅ Test Submitted Successfully!</h1>
        <p className="text-muted-foreground text-center max-w-md">
          Your aptitude test has been submitted. HR will review your results. You will receive a notification about the next steps.
        </p>
        <Button onClick={() => navigate("/candidate-dashboard")} className="mt-6">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (phase === "rules") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg w-full rounded-2xl border border-border bg-card p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Aptitude Test Rules</h1>
          </div>

          <div className="space-y-3 mb-8">
            {[
              "40 questions total",
              "45 minutes time limit",
              "Camera must stay ON throughout the test",
              "Do not switch tabs — violations are reported to HR",
              "Do not copy or paste — it will be blocked",
              "Stay in fullscreen mode",
              "Right-click is disabled",
              "All violations will be reported to HR in real-time",
              "3 or more violations may result in test cancellation",
            ].map((rule, i) => (
              <div key={i} className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-foreground">{rule}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-muted/50">
            <Checkbox
              checked={agreed}
              onCheckedChange={(v) => setAgreed(v === true)}
              id="agree"
            />
            <label htmlFor="agree" className="text-sm text-foreground cursor-pointer">
              I agree to all the rules and understand that violations will be reported.
            </label>
          </div>

          <Button
            onClick={startTest}
            disabled={!agreed}
            className="w-full bg-primary text-primary-foreground"
            size="lg"
          >
            <Camera className="h-4 w-4 mr-2" />
            Start Test
          </Button>
        </motion.div>
      </div>
    );
  }

  // Test phase
  const question = defaultQuestions[currentQ];
  const progress = ((currentQ + 1) / 40) * 100;

  return (
    <div className="min-h-screen bg-background select-none">
      {/* Top bar */}
      <div className="sticky top-0 z-50 bg-card border-b border-border px-6 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-foreground">
              Question {currentQ + 1} of 40
            </span>
            <span className="text-xs text-muted-foreground">
              {question.section}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {violations > 0 && (
              <span className="text-xs text-destructive font-medium">
                ⚠️ {violations} violation{violations > 1 ? "s" : ""}
              </span>
            )}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${timeLeft < 300 ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"}`}>
              <Clock className="h-4 w-4" />
              <span className="font-mono font-bold text-sm">{formatTime(timeLeft)}</span>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="max-w-4xl mx-auto mt-2">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question content */}
      <div className="max-w-3xl mx-auto p-8">
        <motion.div
          key={currentQ}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          <h2 className="text-lg font-semibold text-foreground mb-6">
            {question.q}
          </h2>

          <div className="space-y-3">
            {question.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => selectAnswer(i)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  answers[currentQ] === i
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`h-6 w-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                    answers[currentQ] === i
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground"
                  }`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>{opt}</span>
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <Button
            variant="outline"
            onClick={() => goToQuestion(currentQ - 1)}
            disabled={currentQ === 0}
          >
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {currentQ < 39 ? (
              <Button
                onClick={() => goToQuestion(currentQ + 1)}
                className="bg-primary text-primary-foreground"
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-primary text-primary-foreground"
              >
                {submitting ? "Submitting..." : "Submit Test"}
              </Button>
            )}
          </div>
        </div>

        {/* Question navigator */}
        <div className="mt-8 p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted-foreground mb-3">Question Navigator</p>
          <div className="grid grid-cols-10 gap-2">
            {Array.from({ length: 40 }, (_, i) => (
              <button
                key={i}
                onClick={() => goToQuestion(i)}
                className={`h-8 w-8 rounded-lg text-xs font-medium transition-all ${
                  i === currentQ
                    ? "bg-primary text-primary-foreground"
                    : answers[i] !== null
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground hover:bg-secondary"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Webcam preview */}
      <div className="fixed bottom-4 right-4 z-50">
        <div className="w-40 h-30 rounded-xl overflow-hidden border-2 border-primary/30 shadow-xl bg-black">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-1">📹 Camera ON</p>
      </div>
    </div>
  );
};

export default AptitudeTest;
