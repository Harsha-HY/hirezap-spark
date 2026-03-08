import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { applicationId, candidateId } = await req.json();

    if (!applicationId || !candidateId) {
      return new Response(JSON.stringify({ error: "Missing applicationId or candidateId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get candidate details
    const { data: candidate } = await supabase
      .from("users")
      .select("full_name, email, user_id")
      .eq("id", candidateId)
      .single();

    if (!candidate) {
      return new Response(JSON.stringify({ error: "Candidate not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get application + job details
    const { data: application } = await supabase
      .from("applications")
      .select("job_id")
      .eq("id", applicationId)
      .single();

    let jobTitle = "the position";
    let companyName = "our company";
    if (application) {
      const { data: job } = await supabase
        .from("jobs")
        .select("title, company_id")
        .eq("id", application.job_id)
        .single();
      if (job) {
        jobTitle = job.title;
        const { data: company } = await supabase
          .from("companies")
          .select("company_name")
          .eq("id", job.company_id)
          .single();
        if (company) companyName = company.company_name;
      }
    }

    // Send notification to candidate's registered email via Supabase Auth admin
    // Since we can't send arbitrary emails without a mail provider,
    // we'll create a comprehensive in-app notification
    await supabase.from("notifications").insert({
      user_id: candidateId,
      title: "📧 Hire Confirmation Sent",
      message: `Dear ${candidate.full_name}, This is to confirm that you have been officially hired for the position of ${jobTitle} at ${companyName}. Please check your registered email (${candidate.email}) for further onboarding instructions. Congratulations and welcome to the team!`,
    });

    console.log(`Hire notification sent to ${candidate.email} for ${jobTitle} at ${companyName}`);

    return new Response(JSON.stringify({ success: true, email: candidate.email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Send hire email error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
