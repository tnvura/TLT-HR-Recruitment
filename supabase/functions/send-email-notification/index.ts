import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Notification payload interface
interface NotificationPayload {
  event_type: string;
  candidate_id: string;
  recipient_email: string;
  recipient_name?: string;
  data: Record<string, any>;
}

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-id",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authenticate the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Create Supabase client with SERVICE ROLE (not user token)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 3. Parse and validate request payload
    let payload: NotificationPayload;
    try {
      payload = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    if (!payload.event_type || !payload.candidate_id || !payload.recipient_email) {
      return new Response(
        JSON.stringify({
          error: "Invalid payload",
          message: "Missing required fields: event_type, candidate_id, recipient_email"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Rate limiting check (10 emails per minute per event type)
    const userId = req.headers.get("X-User-Id");
    if (userId) {
      const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

      const { count, error: countError } = await supabaseAdmin
        .from("email_notifications")
        .select("*", { count: "exact", head: true })
        .eq("event_type", payload.event_type)
        .gte("created_at", oneMinuteAgo);

      if (countError) {
        console.error("Rate limit check error:", countError);
      } else if ((count ?? 0) >= 10) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded",
            message: "Maximum 10 emails per minute per event type"
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 5. Get webhook config (secure - client can't read this)
    const { data: config, error: configError } = await supabaseAdmin
      .from("notification_config")
      .select("webhook_url, webhook_secret, is_enabled")
      .eq("event_type", payload.event_type)
      .single();

    if (configError || !config) {
      console.error(`No webhook config for ${payload.event_type}:`, configError);
      return new Response(
        JSON.stringify({
          error: "Webhook not configured",
          message: `No configuration found for event type: ${payload.event_type}`
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.is_enabled) {
      console.log(`Webhook disabled for ${payload.event_type}`);
      return new Response(
        JSON.stringify({
          message: "Webhook disabled",
          event_type: payload.event_type
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Log notification attempt
    const { data: notification, error: insertError } = await supabaseAdmin
      .from("email_notifications")
      .insert({
        candidate_id: payload.candidate_id,
        event_type: payload.event_type,
        recipient_email: payload.recipient_email,
        recipient_name: payload.recipient_name,
        webhook_payload: payload,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error logging notification:", insertError);
    }

    // 7. Prepare authenticated webhook request
    const webhookHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add Bearer token authentication
    if (config.webhook_secret) {
      webhookHeaders["Authorization"] = `Bearer ${config.webhook_secret}`;
    }

    // 8. Send to n8n webhook
    const webhookResponse = await fetch(config.webhook_url, {
      method: "POST",
      headers: webhookHeaders,
      body: JSON.stringify(payload),
    });

    let responseData: any;
    let responseText: string;

    // First, get response text (this always works)
    responseText = await webhookResponse.text();

    // Then try to parse as JSON
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { message: responseText };
    }

    // 9. Update notification status
    if (notification) {
      await supabaseAdmin
        .from("email_notifications")
        .update({
          status: webhookResponse.ok ? "sent" : "failed",
          webhook_response: responseData,
          sent_at: new Date().toISOString(),
          error_message: webhookResponse.ok
            ? null
            : responseData.error || responseData.message || "Unknown error",
        })
        .eq("id", notification.id);
    }

    if (!webhookResponse.ok) {
      console.error("Webhook failed:", responseData);
      return new Response(
        JSON.stringify({
          error: "Webhook failed",
          details: responseData,
          notification_id: notification?.id
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 10. Return success
    return new Response(
      JSON.stringify({
        success: true,
        notification_id: notification?.id,
        event_type: payload.event_type
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Edge Function error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
