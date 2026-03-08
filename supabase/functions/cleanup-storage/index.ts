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

    const { applicationId } = await req.json();

    if (!applicationId) {
      return new Response(JSON.stringify({ error: "Missing applicationId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: app } = await supabase
      .from("applications")
      .select("resume_url, video_url, photo_url, candidate_id")
      .eq("id", applicationId)
      .single();

    if (!app) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deleted: string[] = [];

    // Delete resume
    if (app.resume_url && !app.resume_url.startsWith("http")) {
      const { error } = await supabase.storage.from("resumes").remove([app.resume_url]);
      if (!error) deleted.push("resume");
      else console.error("Resume delete error:", error);
    }

    // Delete video
    if (app.video_url) {
      const { error } = await supabase.storage.from("videos").remove([app.video_url]);
      if (!error) deleted.push("video");
      else console.error("Video delete error:", error);
    }

    // Delete photo
    if (app.photo_url && !app.photo_url.startsWith("http")) {
      const { error } = await supabase.storage.from("photos").remove([app.photo_url]);
      if (!error) deleted.push("photo");
      else console.error("Photo delete error:", error);
    }

    // Clear URLs from the application record
    await supabase
      .from("applications")
      .update({ resume_url: null, video_url: null, photo_url: null })
      .eq("id", applicationId);

    console.log(`Cleaned up storage for application ${applicationId}: ${deleted.join(", ") || "nothing to delete"}`);

    return new Response(JSON.stringify({ success: true, deleted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
