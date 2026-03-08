import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { jobTitle, industry } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are an HR expert specializing in group discussion topics for recruitment."
          },
          {
            role: "user",
            content: `Suggest 5 group discussion topics for candidates applying for a "${jobTitle}" role in the "${industry || 'Technology'}" industry. Topics should test leadership, communication, critical thinking, and domain knowledge. Return ONLY a JSON array of 5 strings, no other text.`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_topics",
              description: "Return 5 GD topic suggestions",
              parameters: {
                type: "object",
                properties: {
                  topics: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 5,
                    maxItems: 5,
                  }
                },
                required: ["topics"],
                additionalProperties: false,
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_topics" } },
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
      throw new Error("AI request failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let topics: string[] = [];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      topics = parsed.topics || [];
    }

    if (topics.length === 0) {
      // Fallback: try parsing content
      const content = data.choices?.[0]?.message?.content || "";
      try {
        topics = JSON.parse(content);
      } catch {
        topics = [
          `Impact of AI on ${jobTitle} roles`,
          `Remote vs Office work for ${jobTitle} teams`,
          `Ethics in ${industry || 'Technology'} industry`,
          `Leadership qualities for ${jobTitle} professionals`,
          `Innovation challenges in ${industry || 'Technology'}`,
        ];
      }
    }

    return new Response(JSON.stringify({ topics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
