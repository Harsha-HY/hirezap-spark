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
    const { applicationId, jobId, companyId, createdBy, regenerateIndex, feedback } = await req.json();

    if (!jobId || !applicationId) {
      return new Response(JSON.stringify({ error: "Missing jobId or applicationId" }), {
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

    // Fetch job details
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();

    if (jobErr || !job) {
      throw new Error("Job not found: " + (jobErr?.message || ""));
    }

    // Fetch candidate resume text (from ai_analysis if available)
    const { data: application } = await supabase
      .from("applications")
      .select("candidate_id, ai_analysis, resume_score, experience_years")
      .eq("id", applicationId)
      .maybeSingle();

    let resumeContext = "";
    if (application?.ai_analysis) {
      const analysis = application.ai_analysis as any;
      resumeContext = `Resume Analysis: ${JSON.stringify(analysis)}`;
    }

    const candidateExp = application?.experience_years ?? "N/A";

    // Build prompt
    let prompt: string;

    if (regenerateIndex !== undefined && regenerateIndex !== null) {
      prompt = `You are an expert technical interviewer.
Regenerate ONE technical question for this candidate.

Job Title: ${job.title}
Required Skills: ${(job.skills_required || []).join(", ") || "Not specified"}
Experience: ${candidateExp} years
${resumeContext}

The previous question was rejected. Reason: ${feedback || "Not relevant"}

Generate a replacement question. Return ONLY valid JSON matching one of these structures based on the type needed:
For DSA: {"type":"dsa","problem_number":1,"title":"...","description":"...","difficulty":"medium","time_minutes":20,"expected_approach":"...","test_cases":["..."]}
For Coding: {"type":"coding","task_number":1,"title":"...","description":"...","difficulty":"medium","time_minutes":30,"tech_stack":"..."}
For MCQ: {"type":"mcq","question_number":1,"question":"...","options":["A","B","C","D"],"correct_answer":"A","difficulty":"medium","topic":"..."}`;
    } else {
      prompt = `You are an expert technical interviewer.
Create technical assessment questions for this candidate.

Job Title: ${job.title}
Required Skills: ${(job.skills_required || []).join(", ") || "Not specified"}
Experience: ${candidateExp} years
Job Description: ${job.job_description || "Not provided"}
${resumeContext}

Create questions in 3 categories:
1. 5 DSA coding problems (algorithms, data structures)
2. 5 Role-specific coding tasks
3. 10 Technical MCQ questions

Return ONLY valid JSON:
{
  "dsa_problems": [
    {
      "problem_number": 1,
      "title": "string",
      "description": "string",
      "difficulty": "easy|medium|hard",
      "time_minutes": 20,
      "expected_approach": "string",
      "test_cases": ["input -> output"]
    }
  ],
  "coding_tasks": [
    {
      "task_number": 1,
      "title": "string",
      "description": "string",
      "difficulty": "easy|medium|hard",
      "time_minutes": 30,
      "tech_stack": "string"
    }
  ],
  "mcq_questions": [
    {
      "question_number": 1,
      "question": "string",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "A",
      "difficulty": "easy|medium|hard",
      "topic": "string"
    }
  ],
  "ai_message_to_hr": "Summary message for HR",
  "ai_message_to_manager": "Summary message for Manager"
}

IMPORTANT: correct_answer must be exactly one of: "A", "B", "C", or "D".
Mix difficulties: 30% easy, 50% medium, 20% hard.
Make questions highly relevant to the candidate's skills and experience level.`;
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert technical interviewer AI. Always respond with valid JSON only, no markdown code fences." },
          { role: "user", content: prompt },
        ],
        max_tokens: 10000,
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
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const cleaned = aiContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", aiContent);
      throw new Error("Failed to parse AI-generated questions");
    }

    // If regenerating single question, just return it
    if (regenerateIndex !== undefined && regenerateIndex !== null) {
      return new Response(JSON.stringify({ success: true, question: parsed }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save technical assessment
    if (companyId && createdBy) {
      const { data: assessment, error: insertErr } = await supabase
        .from("assessments")
        .insert({
          job_id: jobId,
          company_id: companyId,
          application_id: applicationId,
          questions: parsed,
          status: "pending_approval",
          created_by: createdBy,
          type: "technical",
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("Insert error:", insertErr);
        throw new Error("Failed to save technical assessment: " + insertErr.message);
      }

      // Notify HR and Manager
      // Get all HR and manager users in company
      const { data: staffUsers } = await supabase
        .from("users")
        .select("id, role")
        .eq("company_id", companyId)
        .in("role", ["hr", "manager"]);

      // Get candidate name
      const { data: candidateUser } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", application?.candidate_id)
        .maybeSingle();

      const candidateName = candidateUser?.full_name || "a candidate";

      if (staffUsers && staffUsers.length > 0) {
        const notifications = staffUsers.map((staff) => ({
          user_id: staff.id,
          title: "🤖 Technical Questions Ready",
          message: staff.role === "hr"
            ? `AI generated technical questions for ${candidateName} based on their resume and job role. Please review before sending. Both HR and Manager must approve.`
            : `Technical questions ready for ${candidateName}. AI analysed their resume. Your review needed before candidate receives test. Both approvals required.`,
        }));

        await supabase.from("notifications").insert(notifications);
      }

      return new Response(JSON.stringify({ success: true, assessmentId: assessment.id, questions: parsed }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, questions: parsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-technical error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
