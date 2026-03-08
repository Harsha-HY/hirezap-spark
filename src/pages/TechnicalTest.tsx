import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, ArrowRight, Clock, AlertTriangle, Send, Shield, Camera } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState("dsa");

  // Timer
  const [timeLeft, setTimeLeft] = useState(90 * 60);

  // Proctoring state
  const [phase, setPhase] = useState<"rules" | "test" | "submitted">("rules");
  const [agreed, setAgreed] = useState(false);
  const [violations, setViolations] = useState(0);
  const [cameraAlert, setCameraAlert] = useState(false);
  const [cameraCautionText, setCameraCautionText] = useState("Monitoring environment");

  // Webcam refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const violationCooldownRef = useRef<Record<string, number>>({});

  // Track current context for violations
  const activeTabRef = useRef(activeTab);
  const currentMcqRef = useRef(currentMcq);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { currentMcqRef.current = currentMcq; }, [currentMcq]);

  useEffect(() => {
    fetchData();
  }, []);

  // Timer
  useEffect(() => {
    if (phase !== "test" || submitted || loading) return;
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
  }, [phase, submitted, loading]);

  // Get current question context for violation reporting
  const getCurrentContext = () => {
    const tab = activeTabRef.current;
    const mcqIdx = currentMcqRef.current;
    if (tab === "mcq") return `MCQ Question ${mcqIdx + 1}`;
    if (tab === "coding") return "Coding Tasks section";
    return "DSA Problems section";
  };

  const recordViolation = async (type: string, desc: string) => {
    setViolations((v) => v + 1);
    if (!application) return;

    await supabase.from("test_violations").insert({
      application_id: application.id,
      candidate_id: application.candidate_id,
      job_id: application.job_id,
      violation_type: type,
      description: desc,
      question_number: activeTabRef.current === "mcq" ? currentMcqRef.current + 1 : null,
    });

    // Notify manager in real-time
    try {
      const { data: job } = await supabase.from("jobs").select("manager_id, company_id, title").eq("id", application.job_id).maybeSingle();
      if (job) {
        const notifTargets: string[] = [];
        if (job.manager_id) notifTargets.push(job.manager_id);
        // Also notify HR
        const { data: hrUsers } = await supabase.from("users").select("id").eq("company_id", job.company_id).eq("role", "hr");
        hrUsers?.forEach((u) => notifTargets.push(u.id));

        if (notifTargets.length > 0) {
          const { data: candidateUser } = await supabase.from("users").select("full_name").eq("id", application.candidate_id).maybeSingle();
          const candidateName = candidateUser?.full_name || "A candidate";
          await supabase.from("notifications").insert(
            notifTargets.map((uid) => ({
              user_id: uid,
              title: "⚠️ Technical Test Violation!",
              message: `${candidateName} (${job.title}): ${desc}`,
            }))
          );
        }
      }
    } catch (e) {
      console.error("Failed to send violation notification:", e);
    }
  };

  // Anti-cheat: Tab switch detection
  useEffect(() => {
    if (phase !== "test") return;
    const handleVisibility = () => {
      if (document.hidden) {
        recordViolation("tab_switch", `Switched tab while on ${getCurrentContext()}`);
        toast({ title: "⚠️ Tab switch detected!", description: "This has been reported. 3 violations = test cancelled.", variant: "destructive" });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [phase]);

  // Anti-cheat: Copy/Paste/Right-click/Keyboard shortcuts
  useEffect(() => {
    if (phase !== "test") return;

    const blockCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      recordViolation("copy_paste", `Copy/paste attempted while on ${getCurrentContext()}`);
      toast({ title: "⚠️ Copy/Paste blocked!", description: "This action is not allowed.", variant: "destructive" });
    };

    const blockContext = (e: MouseEvent) => {
      e.preventDefault();
      toast({ title: "Right-click disabled", description: "Right-click is not allowed during the test." });
    };

    const blockKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "a", "u"].includes(e.key.toLowerCase())) {
        // Allow paste in code textarea areas - but still record
        if (e.key.toLowerCase() === "v") {
          e.preventDefault();
          recordViolation("copy_paste", `Paste shortcut blocked while on ${getCurrentContext()}`);
          toast({ title: "⚠️ Paste blocked!", description: "Pasting from external sources is not allowed.", variant: "destructive" });
          return;
        }
        if (e.key.toLowerCase() === "c") {
          e.preventDefault();
          recordViolation("copy_paste", `Copy shortcut blocked while on ${getCurrentContext()}`);
          return;
        }
        e.preventDefault();
      }
      if (e.key === "F12" || (e.ctrlKey && e.shiftKey && e.key === "I")) {
        e.preventDefault();
        recordViolation("devtools", `Attempted to open DevTools while on ${getCurrentContext()}`);
      }
    };

    document.addEventListener("copy", blockCopy);
    document.addEventListener("paste", blockCopy);
    document.addEventListener("cut", blockCopy);
    document.addEventListener("contextmenu", blockContext);
    document.addEventListener("keydown", blockKeys);

    return () => {
      document.removeEventListener("copy", blockCopy);
      document.removeEventListener("paste", blockCopy);
      document.removeEventListener("cut", blockCopy);
      document.removeEventListener("contextmenu", blockContext);
      document.removeEventListener("keydown", blockKeys);
    };
  }, [phase]);

  // Fullscreen enforcement
  useEffect(() => {
    if (phase !== "test") return;
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        recordViolation("fullscreen_exit", `Exited fullscreen while on ${getCurrentContext()}`);
        toast({ title: "⚠️ Fullscreen exited!", description: "Please stay in fullscreen mode. Re-entering...", variant: "destructive" });
        setTimeout(() => {
          document.documentElement.requestFullscreen().catch(() => {});
        }, 500);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [phase]);

  // Motion & Sound detection
  useEffect(() => {
    if (phase !== "test") return;

    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    canvasRef.current = canvas;

    let alertTimeout: ReturnType<typeof setTimeout> | null = null;
    let motionStreak = 0;
    let soundStreak = 0;

    const maybeRecordViolation = async (type: string, description: string, cooldownMs = 12000) => {
      const now = Date.now();
      const lastLogged = violationCooldownRef.current[type] ?? 0;
      if (now - lastLogged < cooldownMs) return;
      violationCooldownRef.current[type] = now;
      await recordViolation(type, description);
    };

    const detectInterval = setInterval(() => {
      let motionDetected = false;
      let soundDetected = false;

      if (videoRef.current && ctx && videoRef.current.readyState >= 2) {
        ctx.drawImage(videoRef.current, 0, 0, 160, 120);
        const currentFrame = ctx.getImageData(0, 0, 160, 120);
        if (prevFrameRef.current) {
          let diffSum = 0;
          const prev = prevFrameRef.current.data;
          const curr = currentFrame.data;
          for (let i = 0; i < curr.length; i += 16) {
            diffSum += Math.abs(curr[i] - prev[i]);
          }
          const avgDiff = diffSum / (curr.length / 16);
          motionStreak = avgDiff > 25 ? motionStreak + 1 : Math.max(0, motionStreak - 1);
          motionDetected = motionStreak >= 3;
        }
        prevFrameRef.current = currentFrame;
      }

      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        soundStreak = avg > 30 ? soundStreak + 1 : Math.max(0, soundStreak - 1);
        soundDetected = soundStreak >= 3;
      }

      if (motionDetected || soundDetected) {
        const possiblePhone = motionDetected && soundDetected;
        setCameraAlert(true);
        setCameraCautionText(
          possiblePhone ? "Caution: possible external device detected" :
          motionDetected ? "Caution: suspicious movement detected" :
          "Caution: suspicious sound detected"
        );
        if (alertTimeout) clearTimeout(alertTimeout);
        alertTimeout = setTimeout(() => {
          setCameraAlert(false);
          setCameraCautionText("Monitoring environment");
        }, 2200);

        if (motionDetected) {
          void maybeRecordViolation("motion_detected", `Suspicious movement at ${getCurrentContext()}`);
        }
        if (soundDetected) {
          void maybeRecordViolation("sound_detected", `Suspicious sound at ${getCurrentContext()}`);
        }
        if (possiblePhone) {
          void maybeRecordViolation("possible_phone_usage", `Possible phone usage at ${getCurrentContext()}`, 18000);
        }
      }
    }, 500);

    return () => {
      clearInterval(detectInterval);
      if (alertTimeout) clearTimeout(alertTimeout);
      prevFrameRef.current = null;
      setCameraAlert(false);
      setCameraCautionText("Monitoring environment");
    };
  }, [phase]);

  const startTest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        await videoRef.current.play().catch(() => undefined);
      }

      try { await document.documentElement.requestFullscreen(); } catch {}

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      setPhase("test");
    } catch (e) {
      toast({ title: "Camera Required", description: "Please allow camera and microphone access to start the test.", variant: "destructive" });
    }
  };

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: userData } = await supabase.from("users").select("id").eq("user_id", session.user.id).maybeSingle();
    if (!userData) return;

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

      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      // Stop camera
      streamRef.current?.getTracks().forEach((t) => t.stop());

      setSubmitted(true);
      setPhase("submitted");
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

  // Rules screen before test starts
  if (phase === "rules") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg w-full rounded-2xl border border-border bg-card p-8">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Technical Assessment Rules</h1>
              <p className="text-sm text-muted-foreground">Read carefully before starting</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            {[
              "⏱ You have 90 minutes to complete all sections (DSA, Coding, MCQ).",
              "📹 Your camera and microphone MUST remain ON throughout the test.",
              "🚫 Tab switching, copy-paste, and right-click are BLOCKED and will be reported.",
              "🖥 The test runs in fullscreen mode. Exiting fullscreen is a violation.",
              "🤖 AI monitors for suspicious movement, sound, and external device usage.",
              "⚠️ Every violation is reported in real-time to the hiring manager with exact context.",
              "❌ 3+ violations may result in automatic test cancellation.",
              "📝 Write your own code. Type directly in the editor — no external help allowed.",
            ].map((rule, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="shrink-0">{rule.slice(0, 2)}</span>
                <span>{rule.slice(3)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mb-6 p-3 rounded-lg border border-border bg-muted/50">
            <Checkbox id="agree" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
            <Label htmlFor="agree" className="text-sm text-foreground cursor-pointer">
              I have read and agree to all rules. I understand violations will be reported.
            </Label>
          </div>

          <Button onClick={startTest} disabled={!agreed} className="w-full bg-primary text-primary-foreground gap-2">
            <Camera className="h-4 w-4" />
            Start Technical Test
          </Button>
        </motion.div>
      </div>
    );
  }

  if (submitted || phase === "submitted") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center p-8 rounded-2xl border border-border bg-card max-w-md">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Test Submitted!</h2>
          <p className="text-muted-foreground mb-6">Your technical test has been submitted. You'll be notified once the results are reviewed.</p>
          {violations > 0 && (
            <p className="text-sm text-destructive mb-4">⚠️ {violations} violation(s) were recorded during your test.</p>
          )}
          <Button onClick={() => navigate("/candidate-dashboard")} className="bg-primary text-primary-foreground">Back to Dashboard</Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hidden webcam */}
      <video ref={videoRef} className="fixed top-0 left-0 w-1 h-1 opacity-0 pointer-events-none" />

      {/* Header with timer + proctoring indicator */}
      <div className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">💻 Technical Assessment</h1>
            <p className="text-xs text-muted-foreground">{dsaProblems.length} DSA • {codingTasks.length} Coding • {mcqQuestions.length} MCQ</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Proctoring indicator */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              cameraAlert ? "bg-destructive/10 text-destructive border border-destructive/30" : "bg-muted text-muted-foreground"
            }`}>
              <div className={`h-2 w-2 rounded-full ${cameraAlert ? "bg-destructive animate-pulse" : "bg-primary"}`} />
              {cameraCautionText}
            </div>

            {violations > 0 && (
              <div className="flex items-center gap-1 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4" />
                {violations} violations
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
        <Tabs defaultValue="dsa" className="w-full" onValueChange={(v) => setActiveTab(v)}>
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
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">💻 Your Code Solution:</label>
                    <Textarea
                      value={dsaAnswers[idx] || ""}
                      onChange={(e) => setDsaAnswers({ ...dsaAnswers, [idx]: e.target.value })}
                      placeholder="// Write your code solution here...&#10;// Include your approach, algorithm, and implementation&#10;&#10;function solve(input) {&#10;  // Your code here&#10;}"
                      className="font-mono text-sm min-h-[250px] bg-muted/30 border-border"
                      onPaste={(e) => e.preventDefault()}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">📋 Expected Output / Explanation:</label>
                    <Textarea
                      value={(dsaAnswers[`${idx}_output`] as string) || ""}
                      onChange={(e) => setDsaAnswers({ ...dsaAnswers, [`${idx}_output`]: e.target.value })}
                      placeholder="Explain your approach, time/space complexity, and paste your expected output for the test cases here..."
                      className="text-sm min-h-[100px]"
                      onPaste={(e) => e.preventDefault()}
                    />
                  </div>
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
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">💻 Your Code:</label>
                    <Textarea
                      value={codingAnswers[idx] || ""}
                      onChange={(e) => setCodingAnswers({ ...codingAnswers, [idx]: e.target.value })}
                      placeholder="// Write your complete code solution here...&#10;// Include imports, functions, and main logic"
                      className="font-mono text-sm min-h-[250px] bg-muted/30 border-border"
                      onPaste={(e) => e.preventDefault()}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">📋 Output / Notes:</label>
                    <Textarea
                      value={(codingAnswers[`${idx}_output`] as string) || ""}
                      onChange={(e) => setCodingAnswers({ ...codingAnswers, [`${idx}_output`]: e.target.value })}
                      placeholder="Paste your expected output, explain design decisions, or add any notes about your implementation..."
                      className="text-sm min-h-[100px]"
                      onPaste={(e) => e.preventDefault()}
                    />
                  </div>
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
