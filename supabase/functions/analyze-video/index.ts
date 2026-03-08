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

    // Create a signed URL for the video (valid 1 hour) — no download needed
    const { data: signedData, error: signErr } = await supabase.storage
      .from("videos")
      .createSignedUrl(application.video_url, 3600);

    if (signErr || !signedData?.signedUrl) {
      throw new Error("Could not create signed URL for video: " + (signErr?.message || ""));
    }

    const videoUrl = signedData.signedUrl;

    const prompt = `You are an expert HR recruitment analyst reviewing a candidate's video introduction.

Candidate: ${candidate?.full_name || "Unknown"}
Applied for: ${job?.title || "Unknown"} (${job?.department || ""})
Required Skills: ${(job?.skills_required || []).join(", ") || "Not specified"}

Analyze this video introduction thoroughly and evaluate the candidate on these parameters:

1. Energy Level - How enthusiastic, motivated, and energetic is the candidate?
2. Eye Contact - Does the candidate maintain good eye contact with the camera?
3. English Fluency - How fluent is their English? Grammar, pronunciation, flow.
4. Vocabulary - Quality and richness of vocabulary used.
5. Communication Skills - Clarity of expression, structure of thoughts, articulation.
6. Confidence - How confident does the candidate appear?
7. Body Language - Posture, gestures, facial expressions.
8. Content Quality - Relevance and depth of what they talked about.
9. Professionalism - Overall professional demeanor and presentation.
10. Overall Impression - General suitability for the role.

Return ONLY valid JSON with these exact fields:
{
  "overall_score": number 0-100,
  "energy_level": { "score": number 0-10, "feedback": "1-2 sentences" },
  "eye_contact": { "score": number 0-10, "feedback": "1-2 sentences" },
  "english_fluency": { "score": number 0-10, "feedback": "1-2 sentences" },
  "vocabulary": { "score": number 0-10, "feedback": "1-2 sentences" },
  "communication_skills": { "score": number 0-10, "feedback": "1-2 sentences" },
  "confidence": { "score": number 0-10, "feedback": "1-2 sentences" },
  "body_language": { "score": number 0-10, "feedback": "1-2 sentences" },
  "content_quality": { "score": number 0-10, "feedback": "1-2 sentences" },
  "professionalism": { "score": number 0-10, "feedback": "1-2 sentences" },
  "overall_impression": { "score": number 0-10, "feedback": "1-2 sentences" },
  "verdict": "strong" or "average" or "weak",
  "summary": "3-4 sentence summary for hiring manager",
  "strengths": ["strength1", "strength2"],
  "improvements": ["area1", "area2"]
}`;

    // Send video URL to Gemini — it will fetch the video itself
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
            content: "You are an expert HR video analyst. Analyze candidate videos and return structured JSON scores. Always respond with valid JSON only, no markdown.",
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
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required for AI" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status} - ${errText}`);
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

    const { error: updateErr } = await supabase
      .from("applications")
      .update({ video_score: analysis.overall_score, video_analysis: analysis })
      .eq("id", applicationId);

    if (updateErr) throw new Error("Failed to save video analysis: " + updateErr.message);

    return new Response(JSON.stringify({ success: true, analysis }), {
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
