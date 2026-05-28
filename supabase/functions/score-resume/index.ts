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
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("AI_GATEWAY_API_KEY");

    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY or AI_GATEWAY_API_KEY is not configured");
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

    // Retrieve resume file bytes and determine mime type
    let fileBytes: Uint8Array | null = null;
    let mimeType = "";
    let resumeText = "";

    if (application.resume_url) {
      try {
        const resumeRef = String(application.resume_url);

        if (!resumeRef.startsWith("http")) {
          const { data: fileData, error: fileErr } = await supabase.storage.from("resumes").download(resumeRef);
          if (!fileErr && fileData) {
            fileBytes = new Uint8Array(await fileData.arrayBuffer());
            const lowerRef = resumeRef.toLowerCase();
            if (lowerRef.endsWith(".pdf")) {
              mimeType = "application/pdf";
            } else if (lowerRef.endsWith(".jpg") || lowerRef.endsWith(".jpeg")) {
              mimeType = "image/jpeg";
            } else if (lowerRef.endsWith(".png")) {
              mimeType = "image/png";
            } else if (lowerRef.endsWith(".webp")) {
              mimeType = "image/webp";
            } else {
              // Try text decoding fallback for text/docx/doc files
              const textDecoder = new TextDecoder("utf-8", { fatal: false });
              const rawText = textDecoder.decode(fileBytes);
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
              } else {
                resumeText = "Could not extract plain text from word document. Please inspect metadata.";
              }
            }
          }
        } else {
          // It's a public HTTP URL, we could fetch it but standard resumes are private paths.
          // Fall back to just storing url
          resumeText = `Resume link: ${resumeRef}`;
        }
      } catch (e) {
        console.error("Resume download/extraction error:", e);
        resumeText = "Could not extract resume text";
      }
    }

    // Build AI prompt
    const prompt = `You are an expert HR recruiter. Analyze this candidate's profile and resume against the job description and give an accurate score.

IMPORTANT SCORING RULES:
- Score MUST be based on actual skill match, experience fit, and job relevance.
- Experience match is critical: if candidate has ${application.experience_years} years and job needs ${job.experience_min ?? "N/A"}-${job.experience_max ?? "N/A"} years, factor this heavily.
- CTC expectations: Current ${application.current_ctc} LPA, Expected ${application.expected_ctc} LPA - flag if unreasonable gap.
- Be STRICT and ACCURATE. Do not inflate scores.
- Score range: 0-30 = weak (major skill gaps, wrong domain), 31-50 = below average (some gaps), 51-70 = average (decent match), 71-85 = good (strong match), 86-100 = excellent (perfect fit, rare).
- Most candidates should score between 40-70. Only truly exceptional matches get 80+.
- If resume content is limited, heavily penalize the score and note it.

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
Experience: ${application.experience_years} years`;

    // Call native Google Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    const parts: any[] = [];

    // Add resume file if we downloaded it and it's a natively supported type (PDF/images)
    if (fileBytes && mimeType) {
      const base64Data = arrayBufferToBase64(fileBytes);
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      });
    }

    // Add prompt text (including fallback decoded text if present)
    let fullPrompt = prompt;
    if (resumeText) {
      fullPrompt += `\n\nCandidate Resume Text (extracted):\n${resumeText}`;
    }

    parts.push({
      text: fullPrompt,
    });

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: parts,
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              score: { 
                type: "INTEGER",
                description: "A score between 0 and 100 representing job/resume fit."
              },
              matched_skills: { 
                type: "ARRAY", 
                items: { type: "STRING" },
                description: "List of skills candidate possesses that match the job."
              },
              missing_skills: { 
                type: "ARRAY", 
                items: { type: "STRING" },
                description: "List of skills required by the job but missing in candidate's resume."
              },
              experience_match: { 
                type: "BOOLEAN",
                description: "Whether the candidate's years of experience matches the job requirement."
              },
              education: { 
                type: "STRING",
                description: "Candidate's education details found."
              },
              verdict: { 
                type: "STRING", 
                enum: ["strong", "average", "weak"],
                description: "Overall candidate evaluation verdict."
              },
              recommendation: { 
                type: "STRING",
                description: "2-3 sentences explaining the score with specific reasons."
              },
              ai_message_to_hr: { 
                type: "STRING",
                description: "3-4 sentences for HR explaining why this candidate is a good/bad fit with specific details."
              }
            },
            required: ["score", "matched_skills", "missing_skills", "experience_match", "education", "verdict", "recommendation", "ai_message_to_hr"]
          }
        }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      throw new Error(`Gemini API error: ${response.status} - ${errText}`);
    }

    const aiData = await response.json();
    const aiContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse AI response
    let analysis;
    try {
      analysis = JSON.parse(aiContent.trim());
    } catch (e) {
      console.error("Failed to parse Gemini response JSON:", aiContent, e);
      throw new Error("Invalid JSON response received from Gemini model.");
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
        title: "New Application Scored",
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
