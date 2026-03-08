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

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch application
    const { data: application, error: appErr } = await supabase
      .from("applications")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();

    if (appErr || !application) {
      throw new Error("Application not found: " + (appErr?.message || ""));
    }

    // Fetch candidate info separately
    const { data: candidate } = await supabase
      .from("users")
      .select("id, full_name, email, phone")
      .eq("id", application.candidate_id)
      .maybeSingle();

    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", application.job_id)
      .maybeSingle();

    if (jobErr || !job) {
      throw new Error("Job not found: " + (jobErr?.message || ""));
    }

    // Extract resume text (supports private bucket object paths and legacy public URLs)
    let resumeText = "No resume provided";
    if (application.resume_url) {
      try {
        let bytes: Uint8Array | null = null;
        const resumeRef = String(application.resume_url);

        // New format: stored object path in private resumes bucket
        if (!resumeRef.startsWith("http")) {
          const { data: fileData, error: fileErr } = await supabase.storage.from("resumes").download(resumeRef);
          if (fileErr) throw new Error(`Resume download failed: ${fileErr.message}`);
          bytes = new Uint8Array(await fileData.arrayBuffer());
        } else {
          // Legacy format: public URL already stored in DB
          const pdfResponse = await fetch(resumeRef);
          if (!pdfResponse.ok) throw new Error(`Resume fetch failed: ${pdfResponse.status}`);
          bytes = new Uint8Array(await pdfResponse.arrayBuffer());
        }

        if (bytes && bytes.length > 0) {
          const textDecoder = new TextDecoder("utf-8", { fatal: false });
          const rawText = textDecoder.decode(bytes);
          const textParts: string[] = [];
          const lines = rawText.split(/\r?\n/);
          for (const line of lines) {
            const printable = line.replace(/[^\x20-\x7E]/g, "");
            if (printable.length > 10 && printable.length / Math.max(line.length, 1) > 0.5) {
              textParts.push(printable);
            }
          }
          if (textParts.length > 0) {
            resumeText = textParts.join("\n").substring(0, 5000);
          } else {
            resumeText = "Resume uploaded but text extraction produced limited output.";
          }
        }
      } catch (e) {
        console.error("Resume extraction error:", e);
        resumeText = "Could not extract resume text";
      }
    }

    // Build AI prompt
    const prompt = `You are an expert HR recruiter. Analyze this candidate's profile and resume against the job description and give an accurate score.

IMPORTANT SCORING RULES:
- Score MUST be based on actual skill match, experience fit, and job relevance
- Experience match is critical: if candidate has ${application.experience_years} years and job needs ${job.experience_min ?? "N/A"}-${job.experience_max ?? "N/A"} years, factor this heavily
- CTC expectations: Current ${application.current_ctc} LPA, Expected ${application.expected_ctc} LPA - flag if unreasonable
- Score range: 0-30 = weak (major skill gaps), 31-60 = average (some match), 61-80 = good (strong match), 81-100 = excellent (perfect fit)
- Be STRICT and ACCURATE. Do not inflate scores.

Job Title: ${job.title}
Department: ${job.department}
Required Skills: ${(job.skills_required || []).join(", ") || "Not specified"}
Experience Required: ${job.experience_min ?? "N/A"} to ${job.experience_max ?? "N/A"} years
Job Description: ${job.job_description || "Not provided"}
Location: ${job.location}
Work Type: ${job.work_type}

Candidate Information:
Current Company: ${application.current_company}
Current CTC: ${application.current_ctc} LPA
Expected CTC: ${application.expected_ctc} LPA
Notice Period: ${application.notice_period} days
Experience: ${application.experience_years} years

Candidate Resume (may be partially extracted from PDF):
${resumeText}

NOTE: If resume text is limited or unreadable, base your scoring primarily on the candidate information fields above and the job requirements. Do NOT give a high score just because resume text is unavailable.

Return ONLY a valid JSON response with these exact fields:
{
  "score": number between 0 and 100,
  "matched_skills": array of strings,
  "missing_skills": array of strings,
  "experience_match": true or false,
  "education": string,
  "verdict": "strong" or "average" or "weak",
  "recommendation": string of max 2 sentences,
  "ai_message_to_hr": string of max 3 sentences explaining if this profile is good or not
}`;

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert HR recruiter AI. Always respond with valid JSON only, no markdown." },
          { role: "user", content: prompt },
        ],
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required for AI" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    // Parse AI response
    let analysis;
    try {
      // Remove any markdown code fences
      const cleaned = aiContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", aiContent);
      analysis = {
        score: 50,
        matched_skills: [],
        missing_skills: [],
        experience_match: false,
        education: "Unknown",
        verdict: "average",
        recommendation: "Could not fully analyze resume.",
        ai_message_to_hr: "AI analysis was inconclusive. Manual review recommended.",
      };
    }

    // Update application with score
    const { error: updateErr } = await supabase
      .from("applications")
      .update({
        resume_score: analysis.score,
        ai_analysis: analysis,
        current_stage: "ai_scored",
      })
      .eq("id", applicationId);

    if (updateErr) {
      console.error("Update error:", updateErr);
      throw new Error("Failed to save score: " + updateErr.message);
    }

    // Find HR who posted the job to notify them
    const { data: hrUser } = await supabase
      .from("users")
      .select("id, full_name")
      .eq("id", job.posted_by)
      .maybeSingle();

    const candidateName = candidate?.full_name || "A candidate";

    if (hrUser) {
      await supabase.from("notifications").insert({
        user_id: hrUser.id,
        title: "New Application Received",
        message: `${candidateName} applied for ${job.title}. AI Score: ${analysis.score}/100. Verdict: ${analysis.verdict}. ${analysis.ai_message_to_hr}`,
        read: false,
      });
    }

    return new Response(JSON.stringify({ success: true, score: analysis.score, verdict: analysis.verdict }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("score-resume error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
