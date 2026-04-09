import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY is not configured");

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
    EdgeRuntime.waitUntil(processVideoAnalysis(supabase, application, lovableApiKey));

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

async function processVideoAnalysis(supabase: any, application: any, lovableApiKey: string) {
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

    // Create a long-lived signed URL for the video (valid 1 hour)
    const { data: signedData, error: signedErr } = await supabase.storage
      .from("videos")
      .createSignedUrl(application.video_url, 3600);

    if (signedErr || !signedData?.signedUrl) {
      throw new Error("Could not create signed URL for video: " + (signedErr?.message || ""));
    }

    const videoUrl = signedData.signedUrl;

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
- Most candidates should score between 4-7 on average metrics. Only truly exceptional candidates get 8+.

Return ONLY valid JSON with these exact fields:
{
  "overall_score": number 0-100,
  "energy_level": { "score": number 0-10, "feedback": "1-2 sentences with specific observations" },
  "eye_contact": { "score": number 0-10, "feedback": "1-2 sentences with specific observations" },
  "english_fluency": { "score": number 0-10, "feedback": "1-2 sentences with specific observations" },
  "vocabulary": { "score": number 0-10, "feedback": "1-2 sentences with specific observations" },
  "communication_skills": { "score": number 0-10, "feedback": "1-2 sentences with specific observations" },
  "confidence": { "score": number 0-10, "feedback": "1-2 sentences with specific observations" },
  "body_language": { "score": number 0-10, "feedback": "1-2 sentences with specific observations" },
  "content_quality": { "score": number 0-10, "feedback": "1-2 sentences with specific observations" },
  "professionalism": { "score": number 0-10, "feedback": "1-2 sentences with specific observations" },
  "overall_impression": { "score": number 0-10, "feedback": "1-2 sentences with specific observations" },
  "verdict": "strong" or "average" or "weak",
  "summary": "3-4 sentence summary for hiring manager with specific details from the video",
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["area1", "area2", "area3"]
}`;

    // Use the signed URL directly - Gemini can fetch video from URL
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an expert HR video analyst. You carefully watch candidate videos and provide detailed, honest, and strict scoring. Always respond with valid JSON only, no markdown. Be specific in your feedback - mention what you actually observed.",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: videoUrl },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
        max_tokens: 3000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    let analysis;
    try {
      const cleaned = aiContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI video response:", aiContent);
      analysis = {
        overall_score: 50,
        energy_level: { score: 5, feedback: "Could not fully analyze." },
        eye_contact: { score: 5, feedback: "Could not fully analyze." },
        english_fluency: { score: 5, feedback: "Could not fully analyze." },
        vocabulary: { score: 5, feedback: "Could not fully analyze." },
        communication_skills: { score: 5, feedback: "Could not fully analyze." },
        confidence: { score: 5, feedback: "Could not fully analyze." },
        body_language: { score: 5, feedback: "Could not fully analyze." },
        content_quality: { score: 5, feedback: "Could not fully analyze." },
        professionalism: { score: 5, feedback: "Could not fully analyze." },
        overall_impression: { score: 5, feedback: "Could not fully analyze." },
        verdict: "average",
        summary: "AI analysis was inconclusive. Manual review recommended.",
        strengths: [],
        improvements: [],
      };
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
