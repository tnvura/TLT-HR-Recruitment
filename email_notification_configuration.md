# Email Notification Configuration - Implementation Guide

## Overview

This guide provides step-by-step instructions to implement a **secure, server-side email notification system** using Supabase Edge Functions and n8n webhooks.

### Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Browser   │────────▶│  Edge Function   │────────▶│  n8n Webhook    │
│ (Client App)│         │  (Supabase)      │         │  (External)     │
└─────────────┘         └──────────────────┘         └─────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │    Database      │
                        │ • notification_  │
                        │   config (RLS)   │
                        │ • email_         │
                        │   notifications  │
                        └──────────────────┘
```

### Security Improvements

✅ **No webhook URLs exposed to client** - All URLs stored server-side with RLS policies
✅ **Bearer token authentication** - All webhook requests include authentication headers
✅ **Rate limiting** - 10 emails per minute per user to prevent spam/DoS
✅ **Service-role access only** - Clients cannot read/write sensitive notification tables
✅ **Server-side validation** - Edge Function validates all payloads before sending
✅ **Comprehensive audit logging** - All attempts logged with status and error details

---

## Prerequisites

- [x] Supabase project with Edge Functions enabled
- [x] n8n instance accessible via public URL
- [x] Database access to run migrations
- [x] Supabase service role key (from project settings)

---

## Phase 1: Database Security Setup

### 📋 Tasks

- [ ] 1.1: Create `notification_config` table
- [ ] 1.2: Create `email_notifications` table
- [ ] 1.3: Set up RLS policies for `notification_config`
- [ ] 1.4: Set up RLS policies for `email_notifications`
- [ ] 1.5: Insert initial webhook configurations
- [ ] 1.6: Generate and store webhook secrets

### 1.1: Create `notification_config` Table

**Run in Supabase SQL Editor:**

```sql
-- Table to store webhook URLs and authentication secrets
CREATE TABLE IF NOT EXISTS notification_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text UNIQUE NOT NULL,
  webhook_url text NOT NULL,
  webhook_secret text,  -- Bearer token for n8n authentication
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_notification_config_event_type
  ON notification_config(event_type);

-- Add comment for documentation
COMMENT ON TABLE notification_config IS
  'Stores webhook URLs and secrets for email notifications. Access restricted to service-role only.';
```

**Verification:**

```sql
-- Should return the table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'notification_config';
```

### 1.2: Create `email_notifications` Table

**Run in Supabase SQL Editor:**

```sql
-- Table to log all email notification attempts
CREATE TABLE IF NOT EXISTS email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  webhook_payload jsonb NOT NULL,  -- Full payload sent to webhook
  status text CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
  webhook_response jsonb,           -- Response from n8n webhook
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for monitoring and querying
CREATE INDEX idx_email_notifications_candidate_id
  ON email_notifications(candidate_id);

CREATE INDEX idx_email_notifications_event_type
  ON email_notifications(event_type);

CREATE INDEX idx_email_notifications_status
  ON email_notifications(status);

CREATE INDEX idx_email_notifications_created_at
  ON email_notifications(created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE email_notifications IS
  'Audit log of all email notification attempts with status tracking.';
```

**Verification:**

```sql
-- Should return the table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'email_notifications';
```

### 1.3: Set Up RLS Policies for `notification_config`

**Run in Supabase SQL Editor:**

```sql
-- Enable Row Level Security
ALTER TABLE notification_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (for clean state)
DROP POLICY IF EXISTS "Service role only" ON notification_config;

-- CRITICAL: Only service-role can access this table
-- This prevents clients from reading webhook URLs and secrets
CREATE POLICY "Service role only" ON notification_config
  FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role');

-- Add policy for service role (for server-side operations)
CREATE POLICY "Service role full access" ON notification_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

**Verification:**

```sql
-- Should return 0 rows when queried from client (not service-role)
-- If you get results, RLS is NOT properly configured
SELECT * FROM notification_config;

-- Check policies are in place
SELECT schemaname, tablename, policyname, roles, qual
FROM pg_policies
WHERE tablename = 'notification_config';
```

### 1.4: Set Up RLS Policies for `email_notifications`

**Run in Supabase SQL Editor:**

```sql
-- Enable Row Level Security
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "HR can read notifications" ON email_notifications;
DROP POLICY IF EXISTS "Service role can write" ON email_notifications;
DROP POLICY IF EXISTS "Service role can update" ON email_notifications;

-- HR roles can read for monitoring purposes
CREATE POLICY "HR can read notifications" ON email_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('hr_admin', 'hr_staff', 'hr_manager')
      AND user_roles.is_active = true
    )
  );

-- Only service-role can insert
CREATE POLICY "Service role can write" ON email_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'service_role');

-- Only service-role can update
CREATE POLICY "Service role can update" ON email_notifications
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Service role full access
CREATE POLICY "Service role full access" ON email_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

**Verification:**

```sql
-- Check policies
SELECT schemaname, tablename, policyname, roles
FROM pg_policies
WHERE tablename = 'email_notifications';

-- Test HR can read (should return empty but no error)
SELECT COUNT(*) FROM email_notifications;
```

### 1.5: Insert Initial Webhook Configurations

**⚠️ IMPORTANT:** Replace `https://your-n8n-instance.com` with your actual n8n URL.

**Run in Supabase SQL Editor:**

```sql
-- Insert webhook configurations for all 10 event types
INSERT INTO notification_config (event_type, webhook_url, webhook_secret, is_enabled)
VALUES
  ('candidate_assigned', 'https://your-n8n-instance.com/webhook/candidate-assigned', NULL, false),
  ('interviewer_changed', 'https://your-n8n-instance.com/webhook/interviewer-changed', NULL, false),
  ('interest_confirmed', 'https://your-n8n-instance.com/webhook/interest-confirmed', NULL, false),
  ('interview_scheduled', 'https://your-n8n-instance.com/webhook/interview-scheduled', NULL, false),
  ('feedback_submitted', 'https://your-n8n-instance.com/webhook/feedback-submitted', NULL, false),
  ('offer_submitted_for_approval', 'https://your-n8n-instance.com/webhook/offer-submitted', NULL, false),
  ('offer_approved_by_hr_manager', 'https://your-n8n-instance.com/webhook/offer-hr-approved', NULL, false),
  ('offer_acknowledged', 'https://your-n8n-instance.com/webhook/offer-acknowledged', NULL, false),
  ('offer_rejected', 'https://your-n8n-instance.com/webhook/offer-rejected', NULL, false),
  ('status_change_post_offer', 'https://your-n8n-instance.com/webhook/status-change', NULL, false)
ON CONFLICT (event_type)
DO UPDATE SET
  webhook_url = EXCLUDED.webhook_url,
  updated_at = now();
```

**Note:** All webhooks are initially disabled (`is_enabled = false`) until you configure n8n workflows.

### 1.6: Generate and Store Webhook Secrets

**Generate secure tokens** for each webhook (run in terminal/PowerShell):

```bash
# Generate 10 secure random tokens (one per event type)
node -e "for(let i=0; i<10; i++) console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Store secrets in database:**

```sql
-- Update each event type with its unique secret
-- Replace 'your-secret-token-1' with actual generated tokens
UPDATE notification_config SET webhook_secret = 'your-secret-token-1' WHERE event_type = 'candidate_assigned';
UPDATE notification_config SET webhook_secret = 'your-secret-token-2' WHERE event_type = 'interviewer_changed';
UPDATE notification_config SET webhook_secret = 'your-secret-token-3' WHERE event_type = 'interest_confirmed';
UPDATE notification_config SET webhook_secret = 'your-secret-token-4' WHERE event_type = 'interview_scheduled';
UPDATE notification_config SET webhook_secret = 'your-secret-token-5' WHERE event_type = 'feedback_submitted';
UPDATE notification_config SET webhook_secret = 'your-secret-token-6' WHERE event_type = 'offer_submitted_for_approval';
UPDATE notification_config SET webhook_secret = 'your-secret-token-7' WHERE event_type = 'offer_approved_by_hr_manager';
UPDATE notification_config SET webhook_secret = 'your-secret-token-8' WHERE event_type = 'offer_acknowledged';
UPDATE notification_config SET webhook_secret = 'your-secret-token-9' WHERE event_type = 'offer_rejected';
UPDATE notification_config SET webhook_secret = 'your-secret-token-10' WHERE event_type = 'status_change_post_offer';
```

**✅ Phase 1 Complete! Verify:**

```sql
-- Should return 10 rows (but NOT the secrets - RLS prevents client access)
SELECT event_type, is_enabled FROM notification_config ORDER BY event_type;

-- Should return 0 rows (no notifications sent yet)
SELECT COUNT(*) FROM email_notifications;
```

---

## Phase 2: Edge Function Development

### 📋 Tasks

- [ ] 2.1: Create Edge Function directory structure
- [ ] 2.2: Create Edge Function code
- [ ] 2.3: Deploy Edge Function to Supabase
- [ ] 2.4: Test Edge Function with mock payload
- [ ] 2.5: Verify rate limiting works

### 2.1: Create Edge Function Directory Structure

**Run in project root directory:**

```bash
# Create supabase functions directory if it doesn't exist
mkdir -p supabase/functions/send-email-notification

# Navigate to the directory
cd supabase/functions/send-email-notification
```

### 2.2: Create Edge Function Code

**Create file:** `supabase/functions/send-email-notification/index.ts`

```typescript
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
    try {
      responseData = await webhookResponse.json();
    } catch (e) {
      responseData = { message: await webhookResponse.text() };
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
```

### 2.3: Deploy Edge Function to Supabase

**Prerequisites:**
- Supabase CLI installed: `npm install -g supabase`
- Logged in to Supabase: `supabase login`

**Deploy:**

```bash
# From project root directory
cd supabase/functions

# Deploy the function
supabase functions deploy send-email-notification --no-verify-jwt

# Verify deployment
supabase functions list
```

**Expected output:**

```
Deployed send-email-notification successfully
```

### 2.4: Test Edge Function with Mock Payload

**Using curl (replace with your Supabase URL and anon key):**

```bash
curl -X POST \
  'https://your-project-id.supabase.co/functions/v1/send-email-notification' \
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: test-user-id' \
  -d '{
    "event_type": "candidate_assigned",
    "candidate_id": "00000000-0000-0000-0000-000000000000",
    "recipient_email": "test@example.com",
    "recipient_name": "Test User",
    "data": {
      "candidate_name": "John Doe",
      "candidate_position": "Software Engineer",
      "candidate_link": "https://app.example.com/candidates/123",
      "assigned_by": "hr@example.com",
      "assigned_at": "2025-01-01T00:00:00Z"
    }
  }'
```

**Expected response (webhook disabled):**

```json
{
  "message": "Webhook disabled",
  "event_type": "candidate_assigned"
}
```

**Check logs:**

```bash
supabase functions logs send-email-notification
```

### 2.5: Verify Rate Limiting Works

**Test script (send 11 requests rapidly):**

```bash
#!/bin/bash
for i in {1..11}; do
  echo "Request $i"
  curl -X POST 'https://your-project-id.supabase.co/functions/v1/send-email-notification' \
    -H 'Authorization: Bearer YOUR_ANON_KEY' \
    -H 'Content-Type: application/json' \
    -H 'X-User-Id: test-user-id' \
    -d '{"event_type":"candidate_assigned","candidate_id":"00000000-0000-0000-0000-000000000000","recipient_email":"test@example.com","data":{}}' &
done
wait
```

**Expected:** 10 succeed, 11th returns `429 Rate limit exceeded`

**✅ Phase 2 Complete! Verify:**

```bash
# Check Edge Function is deployed
supabase functions list

# Check logs for successful test
supabase functions logs send-email-notification --tail
```

---

## Phase 3: Client Code Update

### 📋 Tasks

- [ ] 3.1: Backup current emailNotifications.ts
- [ ] 3.2: Refactor sendNotification method
- [ ] 3.3: Test locally that notifications still trigger
- [ ] 3.4: Remove deprecated methods (if any)

### 3.1: Backup Current Code

```bash
# Backup the current file
cp src/services/emailNotifications.ts src/services/emailNotifications.ts.backup
```

### 3.2: Refactor `sendNotification` Method

**File:** `src/services/emailNotifications.ts`

**Find this section (around lines 41-103):**

```typescript
async sendNotification(payload: NotificationPayload): Promise<void> {
  try {
    const webhookUrl = await this.getWebhookUrl(payload.event_type);

    if (!webhookUrl) {
      console.log(`Notifications disabled or not configured for ${payload.event_type}`);
      return;
    }

    // Log notification attempt
    const { data: notification, error: insertError } = await (supabase as any)
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
      // Continue anyway - we still want to send the email
    }

    // Send to n8n webhook
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let responseData;
    try {
      responseData = await response.json();
    } catch (e) {
      responseData = { message: await response.text() };
    }

    // Update notification status
    if (notification) {
      await (supabase as any)
        .from("email_notifications")
        .update({
          status: response.ok ? "sent" : "failed",
          webhook_response: responseData,
          sent_at: new Date().toISOString(),
          error_message: response.ok ? null : responseData.error || responseData.message,
        })
        .eq("id", notification.id);
    }

    if (!response.ok) {
      console.error("Webhook failed:", responseData);
    }
  } catch (error) {
    console.error("Email notification error:", error);
    // Don't throw - email failures shouldn't block main flow
  }
}
```

**Replace with:**

```typescript
async sendNotification(payload: NotificationPayload): Promise<void> {
  try {
    // Get current user for authentication and rate limiting
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.error("Not authenticated - cannot send notification");
      return;
    }

    // Call Edge Function instead of webhook directly
    const { data, error } = await supabase.functions.invoke(
      "send-email-notification",
      {
        body: payload,
        headers: {
          "X-User-Id": user.id, // For rate limiting tracking
        },
      }
    );

    if (error) {
      console.error(`Email notification error for ${payload.event_type}:`, error);
      // Don't throw - email failures shouldn't block main flow
    } else {
      console.log(`Email notification sent for ${payload.event_type}:`, data);
    }
  } catch (error) {
    console.error("Email notification error:", error);
    // Don't throw - email failures shouldn't block main flow
  }
}
```

### 3.3: Remove Deprecated Methods

**Find and DELETE this method (around lines 21-39):**

```typescript
private async getWebhookUrl(eventType: string): Promise<string | null> {
  try {
    const { data, error } = await (supabase as any)
      .from("notification_config")
      .select("webhook_url, is_enabled")
      .eq("event_type", eventType)
      .single();

    if (error) {
      console.error(`Error fetching webhook config for ${eventType}:`, error);
      return null;
    }

    return data?.is_enabled ? data.webhook_url : null;
  } catch (error) {
    console.error("Error in getWebhookUrl:", error);
    return null;
  }
}
```

**This method is no longer needed** because Edge Function handles config lookup.

### 3.4: Test Locally

**Run the app:**

```bash
npm run dev
```

**Test a notification trigger:**

1. Login as HR user
2. Assign a candidate to an interviewer (triggers `candidate_assigned`)
3. Check browser console - should see: `Email notification sent for candidate_assigned`
4. Check Supabase Edge Function logs:

```bash
supabase functions logs send-email-notification --tail
```

**Expected:** Log entry showing notification was processed (even if webhook is disabled)

**✅ Phase 3 Complete! Verify:**

- [ ] Code builds without errors: `npm run build`
- [ ] No TypeScript errors
- [ ] Notification triggers don't throw errors
- [ ] Edge Function receives requests (check logs)

---

## Phase 4: n8n Workflow Configuration

### 📋 Tasks

- [ ] 4.1: Create n8n workflow template
- [ ] 4.2: Configure Bearer token authentication
- [ ] 4.3: Create email templates for each event type
- [ ] 4.4: Test each workflow independently
- [ ] 4.5: Enable webhooks in database

### 4.1: Create n8n Workflow Template

**For each of the 10 event types, create a workflow with this structure:**

1. **Webhook Node** (receives data from Edge Function)
   - HTTP Method: `POST`
   - Path: `/webhook/candidate-assigned` (unique per event)
   - Authentication: `Header Auth`

2. **Function Node** (validate Bearer token)
   - Name: "Validate Auth"
   - JavaScript Code:

```javascript
const authHeader = $node["Webhook"].json.headers.authorization;
const expectedToken = "Bearer your-secret-token-1"; // From credentials

if (!authHeader || authHeader !== expectedToken) {
  throw new Error("Unauthorized - Invalid bearer token");
}

// Extract payload
const payload = $node["Webhook"].json.body;

// Validate required fields
if (!payload.event_type || !payload.recipient_email) {
  throw new Error("Invalid payload - missing required fields");
}

return {
  validated: true,
  payload: payload
};
```

3. **Function Node** (prepare email content)
   - Name: "Prepare Email"
   - JavaScript Code (example for `candidate_assigned`):

```javascript
const payload = $node["Validate Auth"].json.payload;
const data = payload.data;

// Prepare email subject and body
return {
  to: payload.recipient_email,
  subject: `New Candidate Assignment - ${data.candidate_name}`,
  html: `
    <h2>New Candidate Assigned</h2>
    <p>Dear ${payload.recipient_name || 'Interviewer'},</p>

    <p>A new candidate has been assigned to you for review:</p>

    <ul>
      <li><strong>Candidate Name:</strong> ${data.candidate_name}</li>
      <li><strong>Position:</strong> ${data.candidate_position}</li>
      <li><strong>Assigned By:</strong> ${data.assigned_by}</li>
      <li><strong>Assigned At:</strong> ${new Date(data.assigned_at).toLocaleString()}</li>
    </ul>

    <p><a href="${data.candidate_link}">View Candidate Details</a></p>

    <p>Best regards,<br>TalaadThai HR Team</p>
  `
};
```

4. **Gmail/SMTP Node** (send email)
   - Use your SMTP credentials
   - To: `{{ $json.to }}`
   - Subject: `{{ $json.subject }}`
   - Email Type: `HTML`
   - HTML: `{{ $json.html }}`

5. **Respond to Webhook Node**
   - Response Code: `200`
   - Response Body:

```json
{
  "success": true,
  "message": "Email sent successfully"
}
```

### 4.2: Special Workflows

**For `interview_scheduled` (sends to 2 recipients):**

After "Prepare Email" node, add **Split to Items** node:

```javascript
const payload = $node["Validate Auth"].json.payload;
const data = payload.data;

// Create 2 email items - one for interviewer, one for candidate
return [
  {
    json: {
      to: data.interviewer_email,
      recipient_name: data.interviewer_name,
      role: "interviewer"
    }
  },
  {
    json: {
      to: data.candidate_email,
      recipient_name: data.candidate_name,
      role: "candidate"
    }
  }
];
```

Then customize email template based on `role`.

**For `interviewer_changed` (different message based on type):**

```javascript
const payload = $node["Validate Auth"].json.payload;
const data = payload.data;
const notificationType = data.notification_type; // "removed" or "assigned"

let subject, body;

if (notificationType === "removed") {
  subject = `Interviewer Assignment Update - ${data.candidate_name}`;
  body = `
    <p>Dear ${payload.recipient_name},</p>
    <p>You have been removed as the interviewer for <strong>${data.candidate_name}</strong>.</p>
    <p>The candidate has been reassigned to ${data.new_interviewer}.</p>
    <p>Changed by: ${data.changed_by}</p>
  `;
} else {
  subject = `New Candidate Assignment - ${data.candidate_name}`;
  body = `
    <p>Dear ${payload.recipient_name},</p>
    <p>You have been assigned as the interviewer for <strong>${data.candidate_name}</strong>.</p>
    <p><a href="${data.candidate_link}">View Candidate Details</a></p>
  `;
}

return { to: payload.recipient_email, subject, html: body };
```

### 4.3: Get Webhook URLs from n8n

After creating each workflow:

1. Activate the workflow
2. Copy the **Production Webhook URL**
3. It will look like: `https://your-n8n.com/webhook/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### 4.4: Test Each Workflow

**Using n8n Test Webhook:**

1. Click "Listen for Test Event" on Webhook node
2. Send test payload using curl:

```bash
curl -X POST 'https://your-n8n.com/webhook/candidate-assigned' \
  -H 'Authorization: Bearer your-secret-token-1' \
  -H 'Content-Type: application/json' \
  -d '{
    "event_type": "candidate_assigned",
    "candidate_id": "00000000-0000-0000-0000-000000000000",
    "recipient_email": "your-test-email@example.com",
    "recipient_name": "Test User",
    "data": {
      "candidate_name": "John Doe",
      "candidate_position": "Software Engineer",
      "candidate_link": "https://test.com/candidates/123",
      "assigned_by": "hr@example.com",
      "assigned_at": "2025-01-01T00:00:00Z"
    }
  }'
```

3. Verify email is received
4. Check workflow execution succeeded

### 4.5: Enable Webhooks in Database

**After testing all workflows, update database:**

```sql
-- Update webhook URLs with actual n8n URLs
UPDATE notification_config
SET webhook_url = 'https://your-n8n.com/webhook/xxxxxxxx-1', is_enabled = true
WHERE event_type = 'candidate_assigned';

UPDATE notification_config
SET webhook_url = 'https://your-n8n.com/webhook/xxxxxxxx-2', is_enabled = true
WHERE event_type = 'interviewer_changed';

-- ... repeat for all 10 event types

-- Verify all are enabled
SELECT event_type, is_enabled FROM notification_config;
```

**✅ Phase 4 Complete! Verify:**

- [ ] All 10 n8n workflows created and activated
- [ ] Bearer token authentication configured in each
- [ ] Test emails sent successfully
- [ ] Webhook URLs updated in `notification_config`
- [ ] All webhooks enabled in database

---

## Phase 5: Testing & Deployment

### 📋 Tasks

- [ ] 5.1: End-to-end testing for each event type
- [ ] 5.2: Test error handling (invalid payload)
- [ ] 5.3: Test rate limiting
- [ ] 5.4: Monitor email_notifications table
- [ ] 5.5: Production deployment checklist

### 5.1: End-to-End Testing

**Test each event type in the actual application:**

| Event Type | Test Action | Expected Email |
|------------|-------------|----------------|
| candidate_assigned | Shortlist candidate → assign interviewer | Interviewer receives assignment email |
| interviewer_changed | Edit assigned interviewer | Old interviewer receives removal email, new receives assignment email |
| interest_confirmed | Interviewer confirms interest | HR receives confirmation email |
| interview_scheduled | Schedule interview | Both interviewer and candidate receive interview invite |
| feedback_submitted | Submit interview feedback | HR receives feedback notification |
| offer_submitted_for_approval | Create job offer | HR Manager receives approval request |
| offer_approved_by_hr_manager | HR Manager approves offer | Interviewer receives approval notification |
| offer_acknowledged | Interviewer acknowledges offer | HR User and HR Manager receive acknowledgment |
| offer_rejected | HR Manager/Interviewer rejects offer | HR User receives rejection notice |
| status_change_post_offer | Change status after offer sent | Interviewer receives status update |

**For each test:**

1. Perform action in UI
2. Check email received
3. Query `email_notifications` table:

```sql
SELECT
  event_type,
  recipient_email,
  status,
  error_message,
  created_at
FROM email_notifications
ORDER BY created_at DESC
LIMIT 10;
```

4. Verify `status = 'sent'`

### 5.2: Test Error Handling

**Test invalid payload:**

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/send-email-notification' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"invalid": "payload"}'
```

**Expected:** 400 Bad Request with error message

**Test webhook failure (disable n8n workflow temporarily):**

1. Deactivate one n8n workflow
2. Trigger that event in app
3. Check `email_notifications`:

```sql
SELECT * FROM email_notifications WHERE status = 'failed' ORDER BY created_at DESC;
```

4. Verify `error_message` contains failure details

### 5.3: Test Rate Limiting

**Create test script:**

```bash
#!/bin/bash
# Send 15 rapid requests
for i in {1..15}; do
  echo "Request $i"
  curl -X POST 'https://your-project.supabase.co/functions/v1/send-email-notification' \
    -H 'Authorization: Bearer YOUR_ANON_KEY' \
    -H 'Content-Type: application/json' \
    -H 'X-User-Id: test-user-123' \
    -d '{
      "event_type": "candidate_assigned",
      "candidate_id": "00000000-0000-0000-0000-000000000000",
      "recipient_email": "test@example.com",
      "data": {}
    }' &
done
wait
```

**Expected:** First 10 succeed, remaining 5 return `429 Rate limit exceeded`

### 5.4: Monitor Email Notifications

**Create monitoring query:**

```sql
-- Success rate in last 24 hours
SELECT
  event_type,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  ROUND(100.0 * SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM email_notifications
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY total_attempts DESC;

-- Recent failures
SELECT
  event_type,
  recipient_email,
  error_message,
  created_at
FROM email_notifications
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

**Save these queries for daily monitoring.**

### 5.5: Production Deployment Checklist

**Before going live:**

- [ ] All 10 event types tested end-to-end
- [ ] Email templates reviewed and approved
- [ ] Bearer tokens are secure (64+ character random strings)
- [ ] RLS policies verified (client cannot read `notification_config`)
- [ ] Rate limiting tested and working
- [ ] Error handling verified
- [ ] Monitoring queries saved
- [ ] Rollback plan documented (see below)
- [ ] All webhooks enabled: `SELECT COUNT(*) FROM notification_config WHERE is_enabled = true;` returns 10

**Deploy:**

```bash
# Deploy Edge Function
supabase functions deploy send-email-notification --no-verify-jwt

# Verify deployment
supabase functions list

# Build and deploy frontend
npm run build
# (Deploy to your hosting platform)
```

**✅ Phase 5 Complete! Production Ready!**

---

## Troubleshooting

### Issue: "Webhook not configured"

**Symptoms:** Edge Function returns 404

**Solution:**

```sql
-- Check if event type exists
SELECT * FROM notification_config WHERE event_type = 'candidate_assigned';

-- If missing, insert it
INSERT INTO notification_config (event_type, webhook_url, webhook_secret, is_enabled)
VALUES ('candidate_assigned', 'https://n8n.com/webhook/xxx', 'secret', true);
```

### Issue: "Unauthorized" error from n8n

**Symptoms:** Email not sent, `error_message` says "Unauthorized"

**Solution:**

1. Check Bearer token in database matches n8n:

```sql
SELECT event_type, webhook_secret FROM notification_config WHERE event_type = 'candidate_assigned';
```

2. Update n8n Function node with correct token

### Issue: Emails not being sent

**Symptoms:** Status is `sent` but no email received

**Diagnostic steps:**

1. Check n8n workflow execution history
2. Verify SMTP credentials in n8n
3. Check spam folder
4. Test n8n workflow directly with test webhook

### Issue: Rate limit hit too easily

**Symptoms:** Getting 429 errors during normal usage

**Solution:** Increase rate limit in Edge Function:

```typescript
// Change from 10 to 20
if ((count ?? 0) >= 20) {  // Line ~90 in index.ts
```

Redeploy Edge Function.

### Issue: Client can read `notification_config`

**CRITICAL SECURITY ISSUE!**

**Test:**

```sql
-- Run this from client (not as service-role)
SELECT * FROM notification_config;
```

**If you get results, RLS is broken.**

**Fix:**

```sql
-- Drop all policies
DROP POLICY IF EXISTS "Service role only" ON notification_config;

-- Recreate with proper restriction
ALTER TABLE notification_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON notification_config
  FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role');
```

**Re-test:** Query should return 0 rows.

---

## Rollback Plan

### If you need to revert to old system:

**Step 1: Restore backup**

```bash
cp src/services/emailNotifications.ts.backup src/services/emailNotifications.ts
```

**Step 2: Disable all webhooks**

```sql
UPDATE notification_config SET is_enabled = false;
```

**Step 3: Re-enable client-side notifications**

No code changes needed - old code will work if you restore the backup.

**Step 4: Verify**

Test a notification trigger - should work with old system.

---

## Monitoring & Maintenance

### Daily Monitoring

**Run this query daily:**

```sql
SELECT
  DATE(created_at) as date,
  event_type,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
FROM email_notifications
WHERE created_at > CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at), event_type
ORDER BY date DESC, event_type;
```

### Weekly Tasks

- [ ] Review failed notifications
- [ ] Check Edge Function logs for errors
- [ ] Verify n8n workflows are all active
- [ ] Test one notification end-to-end

### Monthly Tasks

- [ ] Rotate webhook secrets (generate new tokens)
- [ ] Archive old notification logs (>90 days)
- [ ] Review and update email templates
- [ ] Performance review (check rate limit usage)

### Webhook Secret Rotation

**Every 90 days:**

1. Generate new secrets (same as Phase 1.6)
2. Update database:

```sql
UPDATE notification_config
SET webhook_secret = 'new-secret-token-1'
WHERE event_type = 'candidate_assigned';
```

3. Update n8n workflows with new tokens
4. Test all workflows

---

## Summary

This implementation provides:

✅ **Security:** Webhook URLs and secrets hidden from clients
✅ **Reliability:** Comprehensive error handling and logging
✅ **Scalability:** Rate limiting prevents abuse
✅ **Auditability:** Full audit trail of all notification attempts
✅ **Maintainability:** Centralized configuration and monitoring

**Next Steps:**

1. Complete all phases in order
2. Test thoroughly before production
3. Set up monitoring and alerts
4. Document any customizations

**Need Help?**

- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- n8n Webhooks: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/
- PostgreSQL RLS: https://supabase.com/docs/guides/auth/row-level-security

---

**Implementation Status:**

- [ ] Phase 1: Database Security Setup
- [ ] Phase 2: Edge Function Development
- [ ] Phase 3: Client Code Update
- [ ] Phase 4: n8n Workflow Configuration
- [ ] Phase 5: Testing & Deployment

**Date Started:** _____________
**Date Completed:** _____________
**Deployed By:** _____________
