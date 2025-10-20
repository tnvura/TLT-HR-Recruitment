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

## Environment Setup

Required environment variables in `.env`:
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
