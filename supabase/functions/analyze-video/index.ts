import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = "";
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { applicationId } = await req.json();
    if (!applicationId) {
      return new Response(JSON.stringify({ error: "Missing applicationId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_VIDEO_API_KEY") || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("AI_GATEWAY_API_KEY");
    if (!geminiApiKey) throw new Error("GEMINI_VIDEO_API_KEY, GEMINI_API_KEY or AI_GATEWAY_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: application, error: appErr } = await supabase
      .from("applications")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();

    if (appErr || !application) throw new Error("Application not found");
    if (!application.video_url) throw new Error("No video uploaded");

    // Mark as processing
    await supabase
      .from("applications")
      .update({ video_analysis: { status: "processing" } })
      .eq("id", applicationId);

    // Start background processing
    EdgeRuntime.waitUntil(processVideoAnalysis(supabase, application, geminiApiKey));

    return new Response(JSON.stringify({ success: true, status: "processing" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-video error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processVideoAnalysis(supabase: any, application: any, geminiApiKey: string) {
  try {
    const { data: job } = await supabase
      .from("jobs")
      .select("title, department, skills_required")
      .eq("id", application.job_id)
      .maybeSingle();

    const { data: candidate } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", application.candidate_id)
      .maybeSingle();

    // Download video file bytes from Supabase Storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("videos")
      .download(application.video_url);

    if (downloadErr || !fileData) {
      throw new Error("Could not download video file: " + (downloadErr?.message || ""));
    }

    const fileBytes = new Uint8Array(await fileData.arrayBuffer());

    // Determine the video MIME type
    let mimeType = "video/webm"; // Default since webm is recorded
    const lowerUrl = application.video_url.toLowerCase();
    if (lowerUrl.endsWith(".mp4")) {
      mimeType = "video/mp4";
    } else if (lowerUrl.endsWith(".webm")) {
      mimeType = "video/webm";
    } else if (lowerUrl.endsWith(".mov")) {
      mimeType = "video/quicktime";
    }

    const prompt = `You are an expert HR recruitment analyst reviewing a candidate's video introduction.

Candidate: ${candidate?.full_name || "Unknown"}
Applied for: ${job?.title || "Unknown"} (${job?.department || ""})
Required Skills: ${(job?.skills_required || []).join(", ") || "Not specified"}

IMPORTANT: You are analyzing a video recording. Watch and listen carefully to evaluate ALL aspects including visual body language and audio speech quality.

Analyze this video introduction thoroughly and evaluate the candidate on these parameters:

1. Energy Level - How enthusiastic, motivated, and energetic is the candidate? Look at facial expressions, voice tone, and gestures.
2. Eye Contact - Does the candidate maintain good eye contact with the camera? Are they looking at the camera or looking away?
3. English Fluency - How fluent is their English? Listen for grammar, pronunciation, flow, hesitations, filler words.
4. Vocabulary - Quality and richness of vocabulary used. Are they using professional and varied language?
5. Communication Skills - Clarity of expression, structure of thoughts, articulation. Can they convey ideas clearly?
6. Confidence - How confident does the candidate appear? Voice steadiness, posture, lack of nervousness.
7. Body Language - Posture, gestures, facial expressions. Are they sitting upright? Using hand gestures appropriately?
8. Content Quality - Relevance and depth of what they talked about. Did they cover their background, skills, and motivation?
9. Professionalism - Overall professional demeanor and presentation. Appropriate attire, background, and manner.
10. Overall Impression - General suitability for the role based on all factors.

SCORING GUIDELINES:
- Be STRICT and REALISTIC. Do NOT give inflated scores.
- Score 1-3: Poor performance in this area
- Score 4-5: Below average, needs improvement
- Score 6-7: Average to good
- Score 8-9: Very good
- Score 10: Exceptional, outstanding
- Most candidates should score between 4-7 on average metrics. Only truly exceptional candidates get 8+.`;

    // Convert video file to base64
    const base64Data = arrayBufferToBase64(fileBytes);

    // Call native Google Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    const aiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              overall_score: { 
                type: "INTEGER",
                description: "A score between 0 and 100 representing the candidate's average score across all parameters."
              },
              energy_level: {
                type: "OBJECT",
                properties: {
                  score: { type: "INTEGER" },
                  feedback: { type: "STRING" }
                },
                required: ["score", "feedback"]
              },
              eye_contact: {
                type: "OBJECT",
                properties: {
                  score: { type: "INTEGER" },
                  feedback: { type: "STRING" }
                },
                required: ["score", "feedback"]
              },
              english_fluency: {
                type: "OBJECT",
                properties: {
                  score: { type: "INTEGER" },
                  feedback: { type: "STRING" }
                },
                required: ["score", "feedback"]
              },
              vocabulary: {
                type: "OBJECT",
                properties: {
                  score: { type: "INTEGER" },
                  feedback: { type: "STRING" }
                },
                required: ["score", "feedback"]
              },
              communication_skills: {
                type: "OBJECT",
                properties: {
                  score: { type: "INTEGER" },
                  feedback: { type: "STRING" }
                },
                required: ["score", "feedback"]
              },
              confidence: {
                type: "OBJECT",
                properties: {
                  score: { type: "INTEGER" },
                  feedback: { type: "STRING" }
                },
                required: ["score", "feedback"]
              },
              body_language: {
                type: "OBJECT",
                properties: {
                  score: { type: "INTEGER" },
                  feedback: { type: "STRING" }
                },
                required: ["score", "feedback"]
              },
              content_quality: {
                type: "OBJECT",
                properties: {
                  score: { type: "INTEGER" },
                  feedback: { type: "STRING" }
                },
                required: ["score", "feedback"]
              },
              professionalism: {
                type: "OBJECT",
                properties: {
                  score: { type: "INTEGER" },
                  feedback: { type: "STRING" }
                },
                required: ["score", "feedback"]
              },
              overall_impression: {
                type: "OBJECT",
                properties: {
                  score: { type: "INTEGER" },
                  feedback: { type: "STRING" }
                },
                required: ["score", "feedback"]
              },
              verdict: { 
                type: "STRING", 
                enum: ["strong", "average", "weak"],
                description: "Overall verdict on the video introduction."
              },
              summary: { 
                type: "STRING",
                description: "3-4 sentence summary of candidate performance."
              },
              strengths: { 
                type: "ARRAY", 
                items: { type: "STRING" },
                description: "List of key strengths noticed in the video."
              },
              improvements: { 
                type: "ARRAY", 
                items: { type: "STRING" },
                description: "List of areas to improve."
              }
            },
            required: [
              "overall_score", "energy_level", "eye_contact", "english_fluency", 
              "vocabulary", "communication_skills", "confidence", "body_language", 
              "content_quality", "professionalism", "overall_impression", "verdict", 
              "summary", "strengths", "improvements"
            ]
          }
        }
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Gemini API error:", aiResponse.status, errText);
      throw new Error(`Gemini API error: ${aiResponse.status} - ${errText}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let analysis;
    try {
      analysis = JSON.parse(aiContent.trim());
    } catch (e) {
      console.error("Failed to parse Gemini response JSON:", aiContent, e);
      throw new Error("Invalid JSON response received from Gemini model.");
    }

    await supabase
      .from("applications")
      .update({ video_score: analysis.overall_score, video_analysis: analysis })
      .eq("id", application.id);

    console.log("Video analysis complete for application:", application.id);
  } catch (err) {
    console.error("Background video analysis failed:", err);
    await supabase
      .from("applications")
      .update({
        video_analysis: {
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        },
      })
      .eq("id", application.id);
  }
}
