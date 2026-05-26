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
    const aiGatewayApiKey = Deno.env.get("AI_GATEWAY_API_KEY");

    if (!aiGatewayApiKey) {
      throw new Error("AI_GATEWAY_API_KEY is not configured");
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

    // Get resume content - use signed URL for AI to read directly
    let resumeSignedUrl: string | null = null;
    let resumeText = "No resume provided";

    if (application.resume_url) {
      try {
        const resumeRef = String(application.resume_url);

        if (!resumeRef.startsWith("http")) {
          // Private bucket - create signed URL
          const { data: signedData, error: signedErr } = await supabase.storage
            .from("resumes")
            .createSignedUrl(resumeRef, 3600);
          if (!signedErr && signedData?.signedUrl) {
            resumeSignedUrl = signedData.signedUrl;
          }
        } else {
          resumeSignedUrl = resumeRef;
        }

        // Also try text extraction as fallback
        if (!resumeRef.startsWith("http")) {
          const { data: fileData, error: fileErr } = await supabase.storage.from("resumes").download(resumeRef);
          if (!fileErr && fileData) {
            const bytes = new Uint8Array(await fileData.arrayBuffer());
            if (bytes.length > 0) {
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
                resumeText = textParts.join("\n").substring(0, 8000);
              }
            }
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
- CTC expectations: Current ${application.current_ctc} LPA, Expected ${application.expected_ctc} LPA - flag if unreasonable gap
- Be STRICT and ACCURATE. Do not inflate scores.
- Score range: 0-30 = weak (major skill gaps, wrong domain), 31-50 = below average (some gaps), 51-70 = average (decent match), 71-85 = good (strong match), 86-100 = excellent (perfect fit, rare)
- Most candidates should score between 40-70. Only truly exceptional matches get 80+.
- If resume text is limited, heavily penalize the score and note it.

Job Title: ${job.title}
Department: ${job.department}
Required Skills: ${(job.skills_required || []).join(", ") || "Not specified"}
Experience Required: ${job.experience_min ?? "N/A"} to ${job.experience_max ?? "N/A"} years
Job Description: ${job.job_description || "Not provided"}
Location: ${job.location}
Work Type: ${job.work_type}

Candidate Information:
Name: ${candidate?.full_name || "Unknown"}
Current Company: ${application.current_company}
Current CTC: ${application.current_ctc} LPA
Expected CTC: ${application.expected_ctc} LPA
Notice Period: ${application.notice_period} days
Experience: ${application.experience_years} years

Candidate Resume Text (extracted from PDF):
${resumeText}

Return ONLY a valid JSON response with these exact fields:
{
  "score": number between 0 and 100,
  "matched_skills": ["skill1", "skill2"],
  "missing_skills": ["skill1", "skill2"],
  "experience_match": true or false,
  "education": "degree details if found",
  "verdict": "strong" or "average" or "weak",
  "recommendation": "2-3 sentences explaining the score with specific reasons",
  "ai_message_to_hr": "3-4 sentences for HR explaining why this candidate is good/bad fit with specific details from resume"
}`;

    // Build messages - if we have a signed URL for the resume, send it as an image for Gemini to read
    const userContent: any[] = [];

    if (resumeSignedUrl) {
      userContent.push({
        type: "image_url",
        image_url: { url: resumeSignedUrl },
      });
    }

    userContent.push({
      type: "text",
      text: prompt,
    });

    // Call AI gateway
    const aiResponse = await fetch(Deno.env.get("AI_GATEWAY_URL")!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiGatewayApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert HR recruiter AI. You carefully analyze resumes and job descriptions. Always respond with valid JSON only, no markdown. Be strict and specific in your scoring." },
          { role: "user", content: userContent },
        ],
        max_tokens: 1500,
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
