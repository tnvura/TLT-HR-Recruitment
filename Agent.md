# Agent.md

This document guides AI coding agents working on the TLT HR Recruitment app. It summarizes structure, guardrails, and how to make safe, high‑impact changes.

## Project Overview

- Stack: Vite + React 18 + TypeScript, Tailwind CSS, shadcn‑ui, TanStack Query, React Router, Supabase (Auth, DB, Storage).
- Entry: `src/main.tsx`, app routes in `src/App.tsx` with `<ProtectedRoute>` for RBAC.
- Deploy/build: Vite. Local dev runs on port 8080.

## Runbook

- Install: `npm install`
- Dev: `npm run dev` (http://localhost:8080)
- Build: `npm run build`
- Preview build: `npm run preview`
- Lint: `npm run lint`

Environment (see `.env` at repo root):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Supabase client is configured in `src/integrations/supabase/client.ts`. Types for the `public` schema live in `src/integrations/supabase/types.ts`. Some tables not present in the types are accessed using `(supabase as any)` — keep this pattern unless types are regenerated.

## Folder Structure (high‑value paths)

- `src/App.tsx` — Routes and providers (QueryClient, Tooltip, Toasters).
- `src/pages/` — Screens: Candidates list/detail, AdminUsers, InterviewerDashboard, InterviewFeedback(Form/View), Auth pages, Landing.
- `src/components/` — Feature components: ApplicationForm, PublicApplicationForm, dialogs (Shortlist, ScheduleInterview, SendOffer), ProtectedRoute, StatusBadge/Timeline, InterviewerInfo, shadcn ui components under `ui/`.
- `src/hooks/` — `usePermissions`, `useNotifications`, `use-toast`.
- `src/services/` — `emailNotifications` (n8n webhook integration), `offerNotifications` (in‑app notifications table).
- `src/integrations/supabase/` — `client.ts`, `types.ts`.
- `public/` — static assets.

## RBAC and Auth

- Roles: `hr_admin`, `hr_staff`, `hr_manager`, `interviewer`.
- Tables: `user_roles` (role, is_active), `role_permissions` (resource CRUD flags).
- Gate: wrap protected routes with `<ProtectedRoute allowedRoles={[...]}>`.
- Permissions hook: `usePermissions()` exposes role booleans and `canCreate/read/update/delete(resource)`.
- Users without an active role go to `/access-pending`; insufficient role goes to `/unauthorized`.

## Data Model (referenced in code)

- Typed: `public.candidates` (see `src/integrations/supabase/types.ts`).
- Accessed with `as any` in code: `user_roles`, `role_permissions`, `interviews`, `candidate_assignments`, `status_history`, `interview_feedback`, `job_proposals`, `email_notifications`, `notification_config`, `notifications`.
- Storage bucket: `CVS` (private). Files are uploaded by `ApplicationForm`/`PublicApplicationForm`; CV view uses a signed URL for 1 hour in `CandidateDetail`.

Status flow used in UI (for filtering and actions):
- new → shortlisted → to_interview → interview_scheduled → interviewed → to_offer → offer_sent → offer_accepted → hired
- Side paths: on_hold, rejected, offer_rejected
- All transitions should write to `status_history` with attribution.

## Notifications

- Email/webhook: `src/services/emailNotifications.ts` resolves per‑event webhook URL from `notification_config` and posts payloads to n8n; logs to `email_notifications` with status.
- In‑app notifications: `src/services/offerNotifications.ts` writes to `notifications` for HR manager/interviewer actions.

## UI/UX Conventions

- Use shadcn components under `src/components/ui/`. Prefer composition over editing generated UI primitives.
- Keep pages thin; fetch with Supabase and React Query where appropriate; show loaders for auth/permissions checks.
- Forms: React Hook Form + Zod; mirror existing patterns in ApplicationForm/PublicApplicationForm.
- Styling: Tailwind; theme tokens come from CSS variables defined by shadcn preset.
- Path alias: import app code with `@/…` (configured in `vite.config.ts`).

## Safe Change Guidelines (important for agents)

- Do not hardcode secrets. Read Supabase URL/key from `.env` (VITE_ vars). The committed anon key is for public usage; treat as environment‑configurable.
- Do not edit `src/integrations/supabase/types.ts` by hand. If schema changes, regenerate types outside this repo; until then, keep `(supabase as any)` for untyped tables.
- Avoid modifying files under `src/components/ui/` unless you are fixing a local import bug; these are generated shadcn components.
- When adding tables or fields referenced in code, also update insert/update payloads and ensure status history is written.
- For new statuses, update: filters in `src/pages/Candidates.tsx`, `StatusBadge` mapping, and any transition logic invoking `status_history` logging.
- For new routes, add them in `src/App.tsx` before the `*` catch‑all and guard with `ProtectedRoute` if needed.
- When sending emails/webhooks, prefer adding a new method to `emailNotifications` so all logging and error handling remain consistent.

## Common Tasks

Add a page and route:
1) Create `src/pages/MyPage.tsx`.
2) Import and add `<Route path="/my-page" element={<ProtectedRoute allowedRoles={["hr_admin"]}><MyPage/></ProtectedRoute>} />` in `src/App.tsx`.

Add a new candidate status:
1) Extend `StatusBadge` to color the new status.
2) Update filters in `src/pages/Candidates.tsx` and counts.
3) Ensure all transitions write to `status_history` with `from_status`, `to_status`, `changed_by(_email)`.

Add a permissioned feature:
1) Read role/permissions via `usePermissions()`.
2) Gate UI actions: `if (!permissions.canUpdate("resource")) return;`.
3) Add server‑side RLS/DB changes in Supabase (outside this repo); keep client checks to prevent accidental actions.

Schedule/reschedule interview (pattern reference):
- See `src/components/ScheduleInterviewDialog.tsx` for three scenarios: new, reschedule (same interviewer), and reassignment (different interviewer). Each path updates `interviews`, `candidate_assignments`, and notifies via `emailNotifications`.

Shortlist & assignment flow:
- `ShortlistDialog` updates candidate `status` to `shortlisted`, writes `status_history`, inserts into `candidate_assignments`, and notifies the interviewer.

Interview feedback → decision:
- `InterviewFeedbackForm` writes `interview_feedback`, flips `interviews.feedback_submitted`, then updates candidate status (`to_offer`/`on_hold`/`rejected`) and logs to `status_history`. HR can view read‑only in `InterviewFeedbackView`.

## Known Gaps/Notes for Agents

- Some Thai strings in feedback topics appear garbled in source control; verify correct UTF‑8 text before editing those constants.
- No automated tests are present. Validate changes manually by running the dev server.
- Role `hr_manager` is referenced in routes/offer flow; ensure corresponding records exist in `user_roles`/`role_permissions` in Supabase for end‑to‑end flows.
- Email/webhook delivery depends on `notification_config` data and external n8n endpoints; code handles missing/disabled config gracefully.

## Quick Links

- Routes: `src/App.tsx:1`
- Supabase client: `src/integrations/supabase/client.ts:1`
- Permissions hook: `src/hooks/usePermissions.ts:1`
- Route guard: `src/components/ProtectedRoute.tsx:1`
- Candidates list: `src/pages/Candidates.tsx:1`
- Candidate detail: `src/pages/CandidateDetail.tsx:1`
- Interviewer dashboard: `src/pages/InterviewerDashboard.tsx:1`
- Feedback form: `src/pages/InterviewFeedbackForm.tsx:1`
- Public application: `src/components/PublicApplicationForm.tsx:1`
- Notifications (email/webhook): `src/services/emailNotifications.ts:1`

