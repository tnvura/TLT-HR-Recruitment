# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **TLT HR Recruitment System** - a full-stack React application for managing job candidates and recruitment workflows. Built with Vite, TypeScript, React, shadcn-ui, and Tailwind CSS, backed by Supabase for authentication and database. The developer is a financial/accounting professional transitioning to full-stack development with experience in ERP systems and automation tools (n8n, Power Automate).

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on port 8080)
npm run dev

# Build for production
npm run build

# Build in development mode
npm run build:dev

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Architecture & Structure

### Authentication & Authorization

This application uses **Supabase Auth** with a custom role-based access control (RBAC) system:

- **Roles**: `hr_admin`, `hr_staff`, `interviewer`
- **Tables**: `user_roles`, `role_permissions`
- **Authorization Flow**:
  1. User authenticates via Supabase Auth (OAuth/email)
  2. `AuthCallback` page (`src/pages/AuthCallback.tsx`) handles OAuth redirects
  3. `usePermissions` hook (`src/hooks/usePermissions.ts`) fetches user role and permissions
  4. `ProtectedRoute` component (`src/components/ProtectedRoute.tsx`) guards routes based on allowed roles
  5. Permissions are resource-based (CRUD operations per resource)

**Key Auth Patterns**:
- Users without assigned roles are redirected to `/access-pending`
- Users with roles but insufficient permissions are redirected to `/unauthorized`
- Role checks use `user_roles.is_active` flag for soft deletion/deactivation
- Auth state is persisted in localStorage via Supabase client config

### Database Integration

Supabase client is configured in `src/integrations/supabase/client.ts` with:
- Auto-generated TypeScript types in `src/integrations/supabase/types.ts`
- Session persistence and auto-refresh enabled
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

**Main Tables**:
- `candidates` - Stores candidate information and application data
- `user_roles` - Maps users to their roles
- `role_permissions` - Defines what each role can do
- `interviews` - Stores interview scheduling data (accessed via `(supabase as any)`)
- `candidate_status_history` - Audit trail for status changes (accessed via `(supabase as any)`)

**Note**: Some tables are accessed using `(supabase as any)` because they're not in the auto-generated types yet. When working with these tables, maintain this pattern until types are regenerated.

### Routing & Pages

Routes are defined in `src/App.tsx`:

| Route | Roles | Purpose |
|-------|-------|---------|
| `/` | Public | Landing page |
| `/login` | Public | Login page |
| `/auth/callback` | Public | OAuth callback handler |
| `/access-pending` | Public | Shown when user has no role assigned |
| `/unauthorized` | Public | Shown when user lacks permissions |
| `/candidates` | hr_admin, hr_staff, interviewer | List all candidates with filters |
| `/candidates/new` | hr_admin, hr_staff | Create new candidate |
| `/candidates/:id` | hr_admin, hr_staff, interviewer | View candidate details |
| `/admin/users` | hr_admin | Manage user roles and whitelist |

**Route Guards**: All protected routes must be wrapped in `<ProtectedRoute allowedRoles={[...]}>`. Add new routes BEFORE the catch-all `*` route.

### Component Organization

**Application Components** (`src/components/`):
- `ApplicationForm.tsx` - Multi-step candidate application form
- `ProtectedRoute.tsx` - Route guard for role-based access
- `ScheduleInterviewDialog.tsx` - Schedule interview appointments
- `SendOfferDialog.tsx` - Send job offers to candidates
- `StatusBadge.tsx` - Display candidate status with color coding
- `StatusHistoryTimeline.tsx` - Show candidate status change timeline

**UI Components** (`src/components/ui/`):
- shadcn-ui components (auto-generated, avoid manual edits)
- Use `npx shadcn-ui add <component>` to add new components

### State Management

- **TanStack Query (React Query)** - Server state management
  - QueryClient configured in `src/App.tsx`
  - Use for all Supabase data fetching

- **Local State** - useState for component-specific state

- **Forms** - React Hook Form + Zod validation
  - See `ApplicationForm.tsx` for form patterns

### Styling

- **Tailwind CSS** with custom theme extensions
- **CSS Variables** for theming (HSL color system)
- **Path alias**: `@/` maps to `src/`
- **Theme**: Supports dark mode via `class` strategy

### Key Features & Workflows

**Candidate Management**:
1. Candidates can apply via public form or be added by HR staff
2. **Primary Status Workflow**: `new` → `screening` → `interview_scheduled` → `interviewed` → `offer_sent` → `offer_accepted` → `hired`
3. **Alternative Paths**:
   - `rejected` - Can transition from ANY status (new, screening, interview_scheduled, interviewed, offer_sent)
   - `on_hold` - Typically from `interviewed` status for candidate comparison
   - `offer_rejected` - Only from `offer_sent` status (when candidate declines)
4. All status changes are tracked in `candidate_status_history` with user attribution and comments
5. CV files uploaded to Supabase Storage

**Interview Scheduling**:
- **Assignment Phase**: HR assigns candidate applications to specific interviewers for review. Interviewers must be assigned by name and email.
- **Interest & Availability**: Interviewers review assigned candidates and can submit their interest and preferred interview time slots
- **Scheduling Phase**: HR can schedule interviews with interview date, time, location, and meeting links. HR can also bypass the interest phase and directly schedule interviews.
- Interview status tracked separately from candidate status

**Post-Interview Decision Process**:
- **Interview Feedback Submission**: After conducting interviews, interviewers must submit feedback and make a job offer decision through the system:
  - **Offer**: Recommend candidate for job offer
  - **Reject**: Do not recommend candidate
  - **On Hold**: Keep candidate in pool for comparison with other applicants
- **Interview Feedback Data**: Captured in `interview_feedback` table
- Candidate status auto-updates based on interviewer decision:
  - `offer` → status changes to `offer_sent`
  - `reject` → status changes to `rejected`
  - `on_hold` → status remains `interviewed`, flagged for review

**Offer Management**:
- **Offer Rejection by Candidate**: If candidate declines the job offer:
  - HR staff must input reason/comments in the system
  - Status updates from `offer_sent` to `offer_rejected`
  - Comments stored in `status_history` for future reference
- **Offer Acceptance & Hiring**: When candidate accepts the offer:
  - HR staff fills out employment details form
  - Employment details saved to `employee_records` table
  - Candidate status updates to `hired`
  - System generates employee onboarding checklist

**Status Transition Rules**:
```
interviewed → [interviewer submits feedback]
  ├─> offer_sent (if decision = 'offer')
  ├─> rejected (if decision = 'reject')
  └─> on_hold (if decision = 'on_hold')

offer_sent → [candidate response]
  ├─> offer_accepted → [HR fills employment details] → hired
  └─> offer_rejected (with mandatory HR comments)

on_hold → [HR review]
  ├─> offer_sent (after comparison)
  └─> rejected (if not selected)
```

**Permissions System**:
- Use `usePermissions()` hook to check permissions in components
- Check role: `permissions.isHRAdmin`, `permissions.isHRStaff`, `permissions.isInterviewer`
- Check resource permissions: `permissions.canCreate('candidates')`, etc.

## Important Patterns

### Working with Supabase

```typescript
// Always check for errors
const { data, error } = await supabase
  .from('candidates')
  .select('*')
  .eq('id', id)
  .single();

if (error) throw error;

// Use maybeSingle() when record might not exist
const { data } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', userId)
  .maybeSingle();
```

### Status Updates with Audit Trail

When updating candidate status, ALWAYS create a status history record:

```typescript
// 1. Update candidate status
await supabase
  .from('candidates')
  .update({ status: newStatus })
  .eq('id', candidateId);

// 2. Create audit trail (using (supabase as any) until types updated)
const { data: { user } } = await supabase.auth.getUser();
await (supabase as any)
  .from('candidate_status_history')
  .insert({
    candidate_id: candidateId,
    from_status: oldStatus,
    to_status: newStatus,
    changed_by: user.id,
    notes: 'Reason for change',
    // other fields...
  });
```

### Error Handling

- Use toast notifications for user feedback
- Log errors to console for debugging
- Show loading states during async operations

## Common Gotchas

1. **TypeScript Strictness**: This project has relaxed TypeScript settings (`noImplicitAny: false`, `strictNullChecks: false`). Be careful with null/undefined values.

2. **Supabase Types**: Some tables aren't in the generated types yet. Use `(supabase as any)` for those tables but maintain type safety where possible.

3. **Route Order**: Custom routes must be added BEFORE the catch-all `*` route in `App.tsx`.

4. **Role Checking**: Always verify both authentication AND authorization. Users can be logged in but not have roles assigned yet.

5. **Date Handling**: Use `date-fns` for date formatting/manipulation. Dates from Supabase come as ISO strings.

## Email Notification System

### Architecture

The system uses a **secure server-side architecture** for sending email notifications via n8n webhooks:

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

**Key Components:**

1. **Client Code** (`src/services/emailNotifications.ts`) - Calls Edge Function with notification payload
2. **Edge Function** (`supabase/functions/send-email-notification`) - Server-side webhook handler with authentication
3. **Database Tables**:
   - `notification_config` - Stores webhook URLs and secrets (service-role only)
   - `email_notifications` - Logs all notification attempts with status tracking
4. **n8n Workflows** - External automation workflows that send actual emails

### Security Model

**🔒 Critical Security Features:**

- ✅ **No webhook URLs exposed to client** - All URLs stored server-side with RLS policies
- ✅ **Bearer token authentication** - All webhook requests include authentication headers
- ✅ **Rate limiting** - 10 emails per minute per user to prevent spam/DoS
- ✅ **Service-role access only** - Clients cannot read/write sensitive notification tables
- ✅ **Server-side validation** - Edge Function validates all payloads before sending
- ✅ **Comprehensive audit logging** - All attempts logged with status and error details

**Database Tables:**

```sql
-- notification_config (service-role only)
CREATE TABLE notification_config (
  id uuid PRIMARY KEY,
  event_type text UNIQUE NOT NULL,
  webhook_url text NOT NULL,
  webhook_secret text,  -- Bearer token for n8n authentication
  is_enabled boolean DEFAULT true
);

-- email_notifications (HR can read, service-role can write)
CREATE TABLE email_notifications (
  id uuid PRIMARY KEY,
  candidate_id uuid,
  event_type text NOT NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  webhook_payload jsonb,
  status text CHECK (status IN ('pending', 'sent', 'failed')),
  webhook_response jsonb,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);
```

### Notification Event Types

All email notifications follow this structure:

```typescript
interface NotificationPayload {
  event_type: string;           // Event identifier
  candidate_id: string;         // Candidate UUID
  recipient_email: string;      // Primary recipient
  recipient_name?: string;      // Recipient display name
  data: Record<string, any>;    // Event-specific data
}
```

#### 1. Candidate Assigned to Interviewer

**Event:** `candidate_assigned`
**Triggered:** `ShortlistDialog.tsx:108`
**Recipients:** Interviewer

```typescript
{
  event_type: "candidate_assigned",
  candidate_id: string,
  recipient_email: string,  // interviewer_email
  recipient_name: string,   // interviewer_name
  data: {
    candidate_name: string,
    candidate_position: string,
    candidate_link: string,        // Link to candidate detail page
    assigned_by: string,           // HR user email
    assigned_at: string            // ISO timestamp
  }
}
```

#### 2. Interviewer Changed/Reassigned

**Event:** `interviewer_changed`
**Triggered:** `InterviewerInfo.tsx:191`, `ScheduleInterviewDialog.tsx:205`
**Recipients:** Old Interviewer + New Interviewer (2 notifications)

```typescript
// For old interviewer (being removed)
{
  event_type: "interviewer_changed",
  candidate_id: string,
  recipient_email: string,  // old_interviewer_email
  recipient_name: string,
  data: {
    candidate_name: string,
    candidate_position: string,
    changed_by: string,
    changed_at: string,
    notification_type: "removed",
    new_interviewer: string        // New interviewer name
  }
}

// For new interviewer (being assigned)
{
  event_type: "interviewer_changed",
  candidate_id: string,
  recipient_email: string,  // new_interviewer_email
  recipient_name: string,
  data: {
    candidate_name: string,
    candidate_position: string,
    changed_by: string,
    changed_at: string,
    notification_type: "assigned",
    candidate_link: string
  }
}
```

#### 3. Interviewer Confirms Interest

**Event:** `interest_confirmed`
**Triggered:** Interviewer dashboard (interest confirmation)
**Recipients:** HR Staff (who assigned the candidate)

```typescript
{
  event_type: "interest_confirmed",
  candidate_id: string,
  recipient_email: string,  // HR email
  data: {
    candidate_name: string,
    candidate_position: string,
    interviewer_name: string,
    interviewer_email: string,
    candidate_link: string,
    confirmed_at: string
  }
}
```

#### 4. Interview Scheduled ⭐

**Event:** `interview_scheduled`
**Triggered:** `ScheduleInterviewDialog.tsx:266` (new), `:131` (reschedule)
**Recipients:** Interviewer + Candidate (n8n splits to both)

```typescript
{
  event_type: "interview_scheduled",
  candidate_id: string,
  recipient_email: string,  // Logged as interviewer_email
  recipient_name: string,
  data: {
    candidate_id: string,
    candidate_name: string,
    candidate_email: string,       // For sending to candidate
    interviewer_name: string,
    interviewer_email: string,
    interview_date: "YYYY-MM-DD",
    interview_time: "HH:MM",
    location: string,
    meeting_link: string,
    notes: string,
    scheduled_by: string,          // HR email
    scheduled_at: string,
    // Microsoft Outlook Calendar compatible data
    calendar_event: {
      subject: string,
      start: string,               // ISO timestamp
      end: string,                 // ISO timestamp
      location: string,
      body: string,
      attendees: [
        {
          emailAddress: { address: string, name: string },
          type: "required"
        }
      ],
      isOnlineMeeting: boolean,
      onlineMeetingUrl: string | null
    }
  }
}
```

**Special:** This event includes Outlook Calendar data for creating calendar invitations.

#### 5. Interview Feedback Submitted

**Event:** `feedback_submitted`
**Triggered:** `InterviewFeedbackForm.tsx` (after submission)
**Recipients:** HR Staff

```typescript
{
  event_type: "feedback_submitted",
  candidate_id: string,
  recipient_email: string,  // HR email
  data: {
    candidate_name: string,
    candidate_position: string,
    interviewer_name: string,
    interviewer_email: string,
    decision: "offer" | "reject" | "on_hold",
    total_score: number,
    max_score: number,
    percentage: number,
    feedback_link: string,         // Link to view feedback
    candidate_link: string,
    submitted_at: string
  }
}
```

#### 6. Job Offer Submitted for HR Manager Approval

**Event:** `offer_submitted_for_approval`
**Triggered:** `SendOfferPage.tsx` (HR User creates offer)
**Recipients:** HR Manager

```typescript
{
  event_type: "offer_submitted_for_approval",
  candidate_id: string,
  recipient_email: string,  // hr_manager_email
  recipient_name: string,   // hr_manager_name
  data: {
    candidate_name: string,
    candidate_email: string,
    position_offered: string,
    company_name: string,
    start_date: string,
    submitted_by: string,          // HR User email
    candidate_link: string,
    submitted_at: string
  }
}
```

#### 7. HR Manager Approves Offer

**Event:** `offer_approved_by_hr_manager`
**Triggered:** `OfferApprovalSection.tsx:73`
**Recipients:** Interviewer

```typescript
{
  event_type: "offer_approved_by_hr_manager",
  candidate_id: string,
  recipient_email: string,  // interviewer_email
  recipient_name: string,
  data: {
    candidate_name: string,
    position_offered: string,
    company_name: string,
    approved_by: string,           // HR Manager email
    candidate_link: string,
    approved_at: string
  }
}
```

#### 8. Interviewer Acknowledges Offer

**Event:** `offer_acknowledged`
**Triggered:** `OfferApprovalSection.tsx` (Interviewer acknowledges)
**Recipients:** HR User (creator) + HR Manager

```typescript
{
  event_type: "offer_acknowledged",
  candidate_id: string,
  recipient_email: string,  // HR User email OR HR Manager email
  data: {
    candidate_name: string,
    candidate_email: string,
    position_offered: string,
    company_name: string,
    interviewer_name: string,
    interviewer_email: string,
    candidate_link: string,
    acknowledged_at: string
  }
}
```

**Note:** Two separate email records are created - one for HR User and one for HR Manager.

#### 9. Offer Rejected (by HR Manager or Interviewer)

**Event:** `offer_rejected`
**Triggered:** `OfferApprovalSection.tsx` (approval rejection)
**Recipients:** HR User (creator)

```typescript
{
  event_type: "offer_rejected",
  candidate_id: string,
  recipient_email: string,
  recipient_name: string,
  data: {
    candidate_name: string,
    position_offered: string,
    company_name: string,
    rejected_by: string,           // Email of rejector
    rejected_by_role: "HR Manager" | "Interviewer",
    rejection_notes: string,
    candidate_link: string,
    rejected_at: string
  }
}
```

#### 10. Post-Offer Status Changes

**Event:** `status_change_post_offer`
**Triggered:** `offerNotifications.ts:140`
**Recipients:** Interviewer

```typescript
{
  event_type: "status_change_post_offer",
  candidate_id: string,
  recipient_email: string,  // interviewer_email
  recipient_name: string,
  data: {
    candidate_name: string,
    from_status: string,
    to_status: string,             // offer_accepted, offer_rejected, hired
    changed_by: string,
    changed_at: string
  }
}
```

**Use Case:** Keep interviewer informed when candidate accepts/rejects offer or is hired.

### Integration Points in Codebase

**Client-Side Service** (`src/services/emailNotifications.ts:1`):

```typescript
// All notification methods call this central function
class EmailNotificationService {
  async sendNotification(payload: NotificationPayload): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    // Call Edge Function (not webhook directly)
    await supabase.functions.invoke("send-email-notification", {
      body: payload,
      headers: { "X-User-Id": user.id }
    });
  }

  // Individual notification methods
  async notifyCandidateAssigned(...) { await this.sendNotification({...}); }
  async notifyInterviewScheduled(...) { await this.sendNotification({...}); }
  // ... 10 total notification methods
}
```

**Triggered From:**

| Event Type | File | Line | Context |
|------------|------|------|---------|
| candidate_assigned | ShortlistDialog.tsx | 108 | After shortlisting candidate |
| interviewer_changed | InterviewerInfo.tsx | 191 | Manual interviewer change |
| interviewer_changed | ScheduleInterviewDialog.tsx | 205 | Interviewer reassignment during scheduling |
| interest_confirmed | InterviewerDashboard.tsx | - | Interviewer confirms interest |
| interview_scheduled | ScheduleInterviewDialog.tsx | 266, 131 | New interview or reschedule |
| feedback_submitted | InterviewFeedbackForm.tsx | - | After feedback submission |
| offer_submitted_for_approval | SendOfferPage.tsx | - | HR creates job offer |
| offer_approved_by_hr_manager | OfferApprovalSection.tsx | 73 | HR Manager approves |
| offer_acknowledged | OfferApprovalSection.tsx | - | Interviewer acknowledges |
| offer_rejected | OfferApprovalSection.tsx | - | Offer rejection |

### n8n Webhook Requirements

**Authentication:**

All n8n workflows must validate the Bearer token:

```javascript
// n8n Webhook node → Function node
const authHeader = $node["Webhook"].json.headers.authorization;
const expectedToken = "Bearer your-webhook-secret"; // From credentials

if (authHeader !== expectedToken) {
  throw new Error("Unauthorized");
}

// Token valid - proceed with workflow
```

**Response Format:**

n8n must respond with JSON:

```json
// Success
{ "success": true, "message": "Email sent" }

// Failure
{ "error": "SMTP error", "message": "Failed to send email" }
```

**Webhook Configuration:**

Each event type should have its own n8n webhook URL configured in `notification_config` table:

```sql
INSERT INTO notification_config (event_type, webhook_url, webhook_secret, is_enabled)
VALUES
('candidate_assigned', 'https://your-n8n.com/webhook/candidate-assigned', 'your-secret-token', true),
('interview_scheduled', 'https://your-n8n.com/webhook/interview-scheduled', 'your-secret-token', true);
-- ... repeat for all 10 event types
```

**Special Handling:**

- **interview_scheduled**: Send emails to BOTH `interviewer_email` and `candidate_email` from data payload
- **interviewer_changed**: Check `notification_type` field to customize message ("removed" vs "assigned")
- **offer_acknowledged**: Create 2 separate email records for HR User and HR Manager

### Error Handling & Monitoring

**Email Notification Logs:**

Query `email_notifications` table to monitor success/failure:

```sql
-- Check recent failed notifications
SELECT * FROM email_notifications
WHERE status = 'failed'
ORDER BY created_at DESC;

-- Success rate by event type
SELECT
  event_type,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
FROM email_notifications
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY event_type;
```

**Edge Function Logs:**

View logs in Supabase Dashboard → Edge Functions → send-email-notification

**Best Practices:**

- Email failures do not block main application flow (errors are caught and logged)
- All notifications are idempotent (can be retried safely)
- Rate limiting prevents spam (10 emails/minute per user)
- Webhook secrets should be rotated periodically

## Environment Setup

Required environment variables in `.env`:
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
