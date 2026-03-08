import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the calling user is a superadmin or owner
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callingUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !callingUser) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller's role
    const { data: callerData } = await userClient
      .from("users")
      .select("role, company_id")
      .eq("user_id", callingUser.id)
      .maybeSingle();

    if (!callerData || !["owner", "superadmin"].includes(callerData.role)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, fullName, phone, role, companyId, department } = await req.json();

    if (!email || !password || !fullName || !role || !companyId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role client to create the user without affecting the caller's session
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !newUser.user) {
      return new Response(JSON.stringify({ error: createError?.message || "Failed to create auth user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert into users table
    const insertData: Record<string, unknown> = {
      user_id: newUser.user.id,
      full_name: fullName,
      email,
      phone: phone || null,
      role,
      company_id: companyId,
    };

    if (department) {
      insertData.department = department;
    }

    const { error: insertError } = await adminClient.from("users").insert(insertData);

    if (insertError) {
      // Clean up auth user if insert fails
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, userId: newUser.user.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
