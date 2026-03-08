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
    const { applicationId, dsaProblems, codingTasks, mcqQuestions, dsaAnswers, codingAnswers, mcqAnswers } = await req.json();

    if (!applicationId) {
      return new Response(JSON.stringify({ error: "Missing applicationId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Build evaluation prompt
    const evaluations: any[] = [];

    // Evaluate DSA solutions
    const dsaEvals: any[] = [];
    if (dsaProblems && dsaAnswers) {
      for (let i = 0; i < dsaProblems.length; i++) {
        const problem = dsaProblems[i];
        const answer = dsaAnswers[i] || "";
        if (!answer.trim()) {
          dsaEvals.push({
            problem_number: problem.problem_number || i + 1,
            title: problem.title,
            score: 0,
            correctness: false,
            code_quality: 0,
            feedback: "No solution submitted.",
          });
          continue;
        }

        dsaEvals.push({ problem, answer, index: i });
      }
    }

    // Evaluate Coding tasks
    const codingEvals: any[] = [];
    if (codingTasks && codingAnswers) {
      for (let i = 0; i < codingTasks.length; i++) {
        const task = codingTasks[i];
        const answer = codingAnswers[i] || "";
        if (!answer.trim()) {
          codingEvals.push({
            task_number: task.task_number || i + 1,
            title: task.title,
            score: 0,
            correctness: false,
            code_quality: 0,
            feedback: "No solution submitted.",
          });
          continue;
        }

        codingEvals.push({ task, answer, index: i });
      }
    }

    // Calculate MCQ score
    let mcqCorrect = 0;
    let mcqTotal = 0;
    const mcqDetails: any[] = [];
    if (mcqQuestions && mcqAnswers) {
      mcqQuestions.forEach((q: any, i: number) => {
        mcqTotal++;
        const selected = mcqAnswers[i];
        const ca = (q.correct_answer || "").toString().trim().toUpperCase();
        let correctIdx = -1;
        if (ca.length === 1 && ca >= "A" && ca <= "D") {
          correctIdx = ca.charCodeAt(0) - 65;
        } else if (/^\d$/.test(ca)) {
          correctIdx = parseInt(ca, 10);
        } else if (q.options) {
          const matchIdx = q.options.findIndex((opt: string) => opt.trim().toLowerCase() === ca.toLowerCase());
          if (matchIdx >= 0) correctIdx = matchIdx;
        }
        const isCorrect = selected === correctIdx;
        if (isCorrect) mcqCorrect++;
        mcqDetails.push({
          question_number: q.question_number || i + 1,
          correct: isCorrect,
          selected_option: selected !== null && selected !== undefined ? String.fromCharCode(65 + selected) : "None",
          correct_answer: q.correct_answer,
        });
      });
    }

    const mcqScore = mcqTotal > 0 ? Math.round((mcqCorrect / mcqTotal) * 100) : 0;

    // Batch AI evaluation for code answers
    const codeToEvaluate: any[] = [];
    dsaEvals.forEach((e) => {
      if (e.answer) {
        codeToEvaluate.push({
          type: "dsa",
          index: e.index,
          problem_title: e.problem.title,
          problem_description: e.problem.description,
          expected_approach: e.problem.expected_approach || "",
          test_cases: e.problem.test_cases || [],
          candidate_code: e.answer,
        });
      }
    });
    codingEvals.forEach((e) => {
      if (e.answer) {
        codeToEvaluate.push({
          type: "coding",
          index: e.index,
          task_title: e.task.title,
          task_description: e.task.description,
          tech_stack: e.task.tech_stack || "",
          candidate_code: e.answer,
        });
      }
    });

    let aiResults: any[] = [];

    if (codeToEvaluate.length > 0) {
      const evalPrompt = `You are an expert code reviewer and technical interviewer.
Evaluate the following code submissions.

For each submission, return a JSON evaluation with these fields:
- index: the submission index
- type: "dsa" or "coding"
- score: 0 to 100
- correctness: true/false
- time_complexity: string (e.g., "O(n log n)")
- space_complexity: string (e.g., "O(n)")
- code_quality: 0 to 10
- feedback: detailed string feedback

Here are the submissions:
${JSON.stringify(codeToEvaluate, null, 2)}

Return ONLY valid JSON array:
[
  {
    "index": 0,
    "type": "dsa",
    "score": 75,
    "correctness": true,
    "time_complexity": "O(n)",
    "space_complexity": "O(1)",
    "code_quality": 7,
    "feedback": "Good solution but could be optimized..."
  }
]`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are an expert code reviewer. Always respond with valid JSON only." },
            { role: "user", content: evalPrompt },
          ],
          max_tokens: 6000,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const aiContent = aiData.choices?.[0]?.message?.content || "";
        try {
          const cleaned = aiContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          aiResults = JSON.parse(cleaned);
        } catch {
          console.error("Failed to parse AI evaluation:", aiContent);
        }
      } else {
        console.error("AI evaluation failed:", aiResponse.status);
      }
    }

    // Build final results
    const dsaResults: any[] = [];
    dsaProblems?.forEach((p: any, i: number) => {
      const noSubmit = dsaEvals.find((e: any) => !e.answer && (e.problem_number === (p.problem_number || i + 1)));
      if (noSubmit) {
        dsaResults.push(noSubmit);
        return;
      }
      const aiResult = aiResults.find((r: any) => r.type === "dsa" && r.index === i);
      dsaResults.push({
        problem_number: p.problem_number || i + 1,
        title: p.title,
        score: aiResult?.score ?? 0,
        correctness: aiResult?.correctness ?? false,
        time_complexity: aiResult?.time_complexity || "N/A",
        space_complexity: aiResult?.space_complexity || "N/A",
        code_quality: aiResult?.code_quality ?? 0,
        feedback: aiResult?.feedback || "Unable to evaluate.",
      });
    });

    const codingResults: any[] = [];
    codingTasks?.forEach((t: any, i: number) => {
      const noSubmit = codingEvals.find((e: any) => !e.answer && (e.task_number === (t.task_number || i + 1)));
      if (noSubmit) {
        codingResults.push(noSubmit);
        return;
      }
      const aiResult = aiResults.find((r: any) => r.type === "coding" && r.index === i);
      codingResults.push({
        task_number: t.task_number || i + 1,
        title: t.title,
        score: aiResult?.score ?? 0,
        correctness: aiResult?.correctness ?? false,
        time_complexity: aiResult?.time_complexity || "N/A",
        space_complexity: aiResult?.space_complexity || "N/A",
        code_quality: aiResult?.code_quality ?? 0,
        feedback: aiResult?.feedback || "Unable to evaluate.",
      });
    });

    // Calculate overall score
    const dsaAvg = dsaResults.length > 0 ? dsaResults.reduce((s, r) => s + r.score, 0) / dsaResults.length : 0;
    const codingAvg = codingResults.length > 0 ? codingResults.reduce((s, r) => s + r.score, 0) / codingResults.length : 0;
    const overallScore = Math.round((dsaAvg * 0.35 + codingAvg * 0.35 + mcqScore * 0.3));

    const fullReport = {
      overall_score: overallScore,
      dsa_score: Math.round(dsaAvg),
      coding_score: Math.round(codingAvg),
      mcq_score: mcqScore,
      mcq_correct: mcqCorrect,
      mcq_total: mcqTotal,
      dsa_results: dsaResults,
      coding_results: codingResults,
      mcq_details: mcqDetails,
    };

    // Save to application
    await supabase.from("applications").update({
      current_stage: "technical_completed",
      technical_score: overallScore,
      code_answers: {
        dsa_answers: dsaAnswers || {},
        coding_answers: codingAnswers || {},
        mcq_answers: mcqAnswers || {},
        ai_report: fullReport,
      },
    }).eq("id", applicationId);

    // Notify staff
    const { data: appData } = await supabase.from("applications").select("candidate_id, job_id").eq("id", applicationId).maybeSingle();
    if (appData) {
      const { data: job } = await supabase.from("jobs").select("company_id, title").eq("id", appData.job_id).maybeSingle();
      const { data: candidateUser } = await supabase.from("users").select("full_name").eq("id", appData.candidate_id).maybeSingle();
      const candidateName = candidateUser?.full_name || "A candidate";

      if (job) {
        const { data: staffUsers } = await supabase
          .from("users")
          .select("id")
          .eq("company_id", job.company_id)
          .in("role", ["hr", "manager"]);

        if (staffUsers) {
          const notifs = staffUsers.map((s) => ({
            user_id: s.id,
            title: "📝 Technical Round Completed!",
            message: `${candidateName} completed the Technical Round for ${job.title}.\n\nOverall: ${overallScore}/100\nDSA: ${Math.round(dsaAvg)}/100\nCoding: ${Math.round(codingAvg)}/100\nMCQ: ${mcqScore}/100 (${mcqCorrect}/${mcqTotal})\n\nView full AI analysis report.`,
          }));
          if (notifs.length > 0) await supabase.from("notifications").insert(notifs);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, report: fullReport }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("score-technical error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
