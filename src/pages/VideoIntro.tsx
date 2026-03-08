import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Video, Shield, Camera, StopCircle, Play, RotateCcw, Upload, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const VideoIntro = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [accessMessage, setAccessMessage] = useState("Video round is not available for you yet.");
  const [application, setApplication] = useState<any>(null);
  const [candidateId, setCandidateId] = useState("");

  const [phase, setPhase] = useState<"preview" | "recording" | "review" | "uploading" | "submitted">("preview");
  const [recordingTime, setRecordingTime] = useState(0);
  const [violations, setViolations] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const reviewVideoRef = useRef<HTMLVideoElement>(null);

  // Check access
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

      // Check if already submitted
      const { data: submittedApp } = await supabase
        .from("applications")
        .select("id, video_url")
        .eq("candidate_id", user.id)
        .not("video_url", "is", null)
        .maybeSingle();

      if (submittedApp) {
        setAccessMessage("You have already submitted your video introduction.");
        setLoading(false);
        return;
      }

      const { data: app } = await supabase
        .from("applications")
        .select("*")
        .eq("candidate_id", user.id)
        .eq("current_stage", "video_intro")
        .maybeSingle();

      if (app) {
        setApplication(app);
        setAuthorized(true);
      }
      setLoading(false);
    };
    checkAccess();
  }, []);

  // Timer
  useEffect(() => {
    if (phase !== "recording") return;
    const interval = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Anti-cheat: tab switch
  useEffect(() => {
    if (phase !== "recording") return;
    const handleVisibility = () => {
      if (document.hidden) {
        recordViolation("tab_switch", `Tab switch during video recording at ${formatTime(recordingTime)}`);
        toast({
          title: "⚠️ Tab switch detected!",
          description: "This has been reported to HR.",
          variant: "destructive",
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [phase, recordingTime]);

  const recordViolation = async (type: string, desc: string) => {
    setViolations((v) => v + 1);
    if (!application) return;
    await supabase.from("test_violations").insert({
      application_id: application.id,
      candidate_id: candidateId,
      job_id: application.job_id,
      violation_type: type,
      description: desc,
    });
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (e) {
      toast({ title: "Camera & Mic Required", description: "Please allow camera and microphone.", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (authorized && phase === "preview") {
      startCamera();
    }
    return () => {
      if (phase !== "recording") {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      }
    };
  }, [authorized]);

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm",
    });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      recordedBlobRef.current = blob;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setPhase("review");
    };
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000);
    setRecordingTime(0);
    setPhase("recording");
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const handleRecordAgain = async () => {
    recordedBlobRef.current = null;
    setRecordingTime(0);
    setPhase("preview");
    await startCamera();
  };

  const handleSubmit = async () => {
    if (!recordedBlobRef.current || !application) return;
    setPhase("uploading");

    const fileName = `${candidateId}/${Date.now()}.webm`;
    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(fileName, recordedBlobRef.current, {
        contentType: "video/webm",
        upsert: false,
      });

    if (uploadError) {
      toast({ title: "Upload Failed", description: uploadError.message, variant: "destructive" });
      setPhase("review");
      return;
    }

    // Update application
    await supabase
      .from("applications")
      .update({
        video_url: fileName,
        current_stage: "video_submitted",
      })
      .eq("id", application.id);

    // Notify HR
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

      const { data: candidateUser } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", candidateId)
        .maybeSingle();

      const candidateName = candidateUser?.full_name || "Candidate";

      if (hrUsers) {
        for (const hr of hrUsers) {
          await supabase.from("notifications").insert({
            user_id: hr.id,
            title: "Video Submitted",
            message: `🎥 ${candidateName} submitted their video introduction for ${job.title}. Violations during recording: ${violations}.`,
          });
        }
      }
    }

    setPhase("submitted");
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const canStop = recordingTime >= 180; // 3 minutes minimum
  const mustStop = recordingTime >= 240; // 4 minutes maximum

  useEffect(() => {
    if (mustStop && phase === "recording") {
      stopRecording();
    }
  }, [mustStop, phase]);

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
        <h1 className="text-2xl font-bold text-foreground mb-2">Video Introduction</h1>
        <p className="text-muted-foreground text-center max-w-md">{accessMessage}</p>
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
        <h1 className="text-2xl font-bold text-foreground mb-2">✅ Video Submitted Successfully!</h1>
        <p className="text-muted-foreground text-center max-w-md">
          Your video introduction has been submitted. HR will review it and you will receive a notification about next steps.
        </p>
        <Button onClick={() => navigate("/candidate-dashboard")} className="mt-6">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (phase === "uploading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-8">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
        <h1 className="text-xl font-bold text-foreground">Uploading your video...</h1>
        <p className="text-muted-foreground mt-2">Please wait, do not close this page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full space-y-6"
      >
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <Video className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Video Introduction</h1>
          </div>
          <p className="text-muted-foreground text-sm">Record a 3-4 minute video about yourself</p>
        </div>

        {/* Instructions */}
        {phase === "preview" && (
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold text-foreground mb-3">Please speak about:</p>
            <div className="space-y-2">
              {[
                "Introduce yourself",
                "Your work experience and skills",
                "Your best project",
                "Why you want this role",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Camera Preview / Review */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {phase === "review" ? (
            <video
              ref={reviewVideoRef}
              src={recordedBlobRef.current ? URL.createObjectURL(recordedBlobRef.current) : undefined}
              controls
              className="w-full aspect-video bg-black"
            />
          ) : (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full aspect-video bg-black object-cover"
              />
              {phase === "recording" && (
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <span className="flex items-center gap-1.5 bg-destructive text-destructive-foreground rounded-full px-3 py-1 text-xs font-bold">
                    <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    REC
                  </span>
                  <span className="bg-background/80 backdrop-blur-sm text-foreground rounded-full px-3 py-1 text-sm font-mono font-bold">
                    {formatTime(recordingTime)}
                  </span>
                </div>
              )}
              {phase === "recording" && !canStop && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-muted-foreground">
                  Minimum 3 minutes required before you can stop
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rules */}
        {(phase === "preview" || phase === "recording") && (
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            {[
              "Minimum 3 minutes",
              "Maximum 4 minutes",
              "Speak clearly in English",
              "Look at the camera",
              "Good lighting recommended",
              "Quiet environment",
            ].map((rule, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                {rule}
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-3">
          {phase === "preview" && (
            <Button onClick={startRecording} size="lg" className="bg-primary text-primary-foreground gap-2">
              <Camera className="h-4 w-4" />
              Start Recording
            </Button>
          )}
          {phase === "recording" && (
            <Button
              onClick={stopRecording}
              size="lg"
              disabled={!canStop}
              variant="destructive"
              className="gap-2"
            >
              <StopCircle className="h-4 w-4" />
              Stop Recording
            </Button>
          )}
          {phase === "review" && (
            <>
              <Button onClick={handleSubmit} size="lg" className="bg-primary text-primary-foreground gap-2">
                <Upload className="h-4 w-4" />
                Submit Video
              </Button>
              <Button onClick={handleRecordAgain} size="lg" variant="outline" className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Record Again
              </Button>
            </>
          )}
        </div>

        {violations > 0 && (
          <p className="text-center text-xs text-destructive">
            ⚠️ {violations} violation{violations > 1 ? "s" : ""} detected during recording
          </p>
        )}
      </motion.div>
    </div>
  );
};

export default VideoIntro;
