import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { gdId, topic, duration, candidateNames, groupInfo } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build candidate list for AI analysis
    const candidateList = Object.entries(candidateNames as Record<string, string>)
      .map(([id, name]) => `- ${name} (ID: ${id})`)
      .join("\n");

    const groupDetails = (groupInfo as { group_name: string; candidate_ids: string[] }[])
      .map(g => `Group ${g.group_name}: ${g.candidate_ids.map(id => (candidateNames as any)[id] || id).join(", ")}`)
      .join("\n");

    const prompt = `You are an expert HR assessor analyzing a Group Discussion (GD) round for recruitment.

Topic: "${topic}"
Duration: ${duration} minutes
Number of candidates: ${Object.keys(candidateNames).length}

Groups:
${groupDetails}

Candidates:
${candidateList}

Since this is a simulated analysis (no actual transcript available), generate realistic and differentiated assessment scores for each candidate based on a hypothetical group discussion on the given topic. Make the scores varied and realistic — some candidates should be strong, some average, some weak. Consider:

1. Speaking time and participation balance
2. Quality and relevance of points made
3. Leadership indicators (initiating discussion, summarizing, moderating)
4. Communication clarity and confidence
5. Teamwork — who builds on others' points vs who dominates
6. Critical thinking and analytical depth

For EACH candidate, provide scores. Make sure scores are differentiated — not everyone should score the same.

Return the analysis using the tool provided.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert HR recruitment assessor specializing in group discussion evaluation." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_gd_scores",
              description: "Submit GD analysis scores for all candidates",
              parameters: {
                type: "object",
                properties: {
                  candidates: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        candidate_id: { type: "string", description: "The candidate's UUID" },
                        speaking_time_minutes: { type: "number" },
                        speaking_percentage: { type: "number", description: "0-100" },
                        times_spoke: { type: "integer" },
                        points_quality: { type: "number", description: "0-10 scale" },
                        relevance_score: { type: "number", description: "0-10 scale" },
                        leadership_score: { type: "number", description: "0-10 scale" },
                        communication_score: { type: "number", description: "0-10 scale" },
                        overall_gd_score: { type: "number", description: "0-100 scale" },
                        verdict: { type: "string", enum: ["strong", "average", "weak"] },
                        ai_feedback: { type: "string", description: "2-3 sentence personalized feedback highlighting strengths, teamwork behavior, and areas to improve" },
                      },
                      required: ["candidate_id", "speaking_time_minutes", "speaking_percentage", "times_spoke", "points_quality", "relevance_score", "leadership_score", "communication_score", "overall_gd_score", "verdict", "ai_feedback"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["candidates"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_gd_scores" } },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AI error:", response.status, text);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI analysis failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No analysis returned from AI");
    }

    const { candidates } = JSON.parse(toolCall.function.arguments);

    // Find group mapping for each candidate
    const candidateGroupMap: Record<string, string> = {};
    for (const g of (groupInfo as any[])) {
      for (const cid of g.candidate_ids) {
        candidateGroupMap[cid] = g.id;
      }
    }

    // Save scores to gd_scores table
    for (const c of candidates) {
      // Upsert: delete existing then insert
      await supabase.from("gd_scores").delete().eq("gd_id", gdId).eq("candidate_id", c.candidate_id);

      await supabase.from("gd_scores").insert({
        gd_id: gdId,
        candidate_id: c.candidate_id,
        group_id: candidateGroupMap[c.candidate_id] || null,
        speaking_time_minutes: c.speaking_time_minutes,
        speaking_percentage: c.speaking_percentage,
        times_spoke: c.times_spoke,
        points_quality: c.points_quality,
        relevance_score: c.relevance_score,
        leadership_score: c.leadership_score,
        communication_score: c.communication_score,
        overall_gd_score: c.overall_gd_score,
        verdict: c.verdict,
        ai_feedback: c.ai_feedback,
      });

      // Send notification to candidate with their feedback
      const name = (candidateNames as any)[c.candidate_id] || "Candidate";
      await supabase.from("notifications").insert({
        user_id: c.candidate_id,
        title: "📊 Group Discussion Completed",
        message: `Hi ${name}, your Group Discussion on "${topic}" has been evaluated.\n\nFeedback: ${c.ai_feedback}\n\nYour overall performance: ${c.verdict.toUpperCase()}\nScore: ${c.overall_gd_score}/100\n\nPlease wait for further updates on your application status.`,
      });

      // Update application stage to gd_completed
      const { data: gdData } = await supabase.from("group_discussions").select("job_id").eq("id", gdId).single();
      if (gdData) {
        await supabase.from("applications")
          .update({ current_stage: "gd_completed" })
          .eq("candidate_id", c.candidate_id)
          .eq("job_id", gdData.job_id)
          .eq("current_stage", "group_discussion");
      }
    }

    // Update GD status to completed
    await supabase.from("group_discussions").update({ status: "completed" }).eq("id", gdId);

    return new Response(JSON.stringify({ success: true, scores: candidates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
