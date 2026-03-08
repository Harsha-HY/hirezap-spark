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
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const jobId = formData.get("jobId") as string;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Extract text from the PDF
    const bytes = new Uint8Array(await file.arrayBuffer());
    const textDecoder = new TextDecoder("utf-8", { fatal: false });
    const rawText = textDecoder.decode(bytes);

    // Extract readable text from PDF binary
    const textParts: string[] = [];
    const lines = rawText.split(/\r?\n/);
    for (const line of lines) {
      const printable = line.replace(/[^\x20-\x7E]/g, "");
      if (printable.length > 5 && printable.length / Math.max(line.length, 1) > 0.3) {
        textParts.push(printable);
      }
    }

    let extractedText = textParts.join("\n").substring(0, 15000);

    if (extractedText.length < 50) {
      extractedText = "PDF content could not be fully extracted. The file may be image-based.";
    }

    // Get job details if jobId provided
    let jobContext = "";
    if (jobId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      const { data: job } = await supabase
        .from("jobs")
        .select("title, skills_required, experience_min, experience_max, job_description")
        .eq("id", jobId)
        .maybeSingle();

      if (job) {
        jobContext = `
Job Title: ${job.title}
Required Skills: ${(job.skills_required || []).join(", ") || "Not specified"}
Experience: ${job.experience_min ?? "N/A"} to ${job.experience_max ?? "N/A"} years
Job Description: ${job.job_description || "Not provided"}`;
      }
    }

    const prompt = `You are an expert HR recruiter. A manager has uploaded a PDF document containing aptitude test content.

Extract and convert the content into well-structured MCQ (Multiple Choice Questions) format.

${jobContext ? `Job Context:${jobContext}` : ""}

PDF Content:
${extractedText}

Instructions:
1. Extract ALL questions from the PDF content
2. If the PDF has questions that are NOT in MCQ format, convert them to MCQ with 4 options (A, B, C, D)
3. If the PDF has essay/descriptive questions, convert them to relevant MCQs testing the same concept
4. If the PDF is just content/notes (not questions), generate MCQ questions BASED on that content
5. Group questions into logical sections
6. Ensure each question has exactly 4 options and one correct answer
7. Assign difficulty levels (easy/medium/hard) and time per question (30-90 seconds)

Return ONLY valid JSON (no markdown code fences):
{
  "sections": [
    {
      "name": "section name",
      "questions": [
        {
          "question_number": 1,
          "question": "question text",
          "options": ["option A", "option B", "option C", "option D"],
          "correct_answer": "A",
          "difficulty": "medium",
          "time_seconds": 60
        }
      ]
    }
  ]
}

IMPORTANT: correct_answer must be exactly one of: "A", "B", "C", or "D".
Generate at least 10 questions. If PDF has more, extract all of them.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert HR recruiter AI. Always respond with valid JSON only, no markdown code fences." },
          { role: "user", content: prompt },
        ],
        max_tokens: 8000,
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
      throw new Error("Failed to parse questions from uploaded PDF");
    }

    return new Response(JSON.stringify({ success: true, questions: parsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("parse-pdf-questions error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
