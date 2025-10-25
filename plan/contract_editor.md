diff --git a/plan/contract_editor.md b/plan/contract_editor.md
new file mode 100644
index 0000000000000000000000000000000000000000..4b242590a370d4d7288c44b67dae1d73d5104c03
--- /dev/null
+++ b/plan/contract_editor.md
@@ -0,0 +1,164 @@
+# Contract Editor Implementation Plan
+
+## Task 1: Template Storage & Selection
+**Objective:** Allow HR admins to upload, manage, and activate contract templates stored in Supabase Storage.
+
+**Prerequisites:**
+- Supabase CLI configured and authenticated.
+- New private storage bucket `contract-templates` created in Supabase project dashboard.
+
+**Implementation Steps:**
+1. **Database migration**
+   - Create a migration in `supabase/migrations` introducing table `contract_templates` with columns:
+     - `id` (uuid, primary key, default `gen_random_uuid()`)
+     - `name` (text, not null)
+     - `version` (text, nullable, for semantic labeling)
+     - `storage_path` (text, not null)
+     - `editable_fields` (jsonb, nullable array of string keys)
+     - `is_active` (boolean, default `false`)
+     - `uploaded_by` (uuid references `profiles.id`)
+     - `uploaded_at` (timestamp with time zone, default `now()`)
+   - Add partial unique index on `is_active` to ensure only one active template at a time.
+2. **Row-Level Security (RLS)**
+   - Enable RLS and create policies restricting CRUD to users with `hr_admin` role claim.
+3. **Storage permissions**
+   - Configure Supabase Storage policy on `contract-templates` bucket to allow read/write only for `hr_admin` role via JWT claim.
+4. **Client utilities**
+   - Add `src/lib/contractTemplates.ts` exposing helpers:
+     - `uploadContractTemplate(file: File, metadata)` handles storage upload + row insert via Supabase JS client.
+     - `fetchTemplates()` returns list sorted by `uploaded_at DESC`.
+     - `setActiveTemplate(id: string)` toggles `is_active` flags in a transaction.
+5. **Admin UI**
+   - Create page `src/pages/admin/ContractTemplates.tsx` (route `/admin/contract-templates`) featuring:
+     - File picker/dropzone using shadcn `FileUploader` component.
+     - Data table listing all templates with status, version, uploaded_by, uploaded_at.
+     - Action buttons to activate template, download original file, or delete older versions.
+     - Form inputs capturing editable field whitelist (comma-separated, stored as JSON array).
+6. **Routing & guards**
+   - Update app router to include the admin page under an HR-only layout guard.
+
+**Deliverables:** Migration files, storage policy scripts, React admin page, and helper utilities committed with documentation updates.
+
+## Task 2: Contract Data Preparation
+**Objective:** Load candidate, job proposal, and template data then map to template variables with proper formatting.
+
+**Prerequisites:**
+- Active template selected (from Task 1).
+- Supabase types generated (run `npm run generate:types` if applicable).
+
+**Implementation Steps:**
+1. **Hook scaffolding**
+   - Implement `src/hooks/useContractContext.ts` returning `{ candidate, jobProposal, template, overrides, isLoading, error }`.
+   - Fetch data concurrently via `Promise.all` using Supabase client queries filtered by `candidate_id` from route params.
+2. **Mapping utilities**
+   - Create `src/lib/contractMapping.ts` exporting:
+     - `buildContractVariables({ candidate, jobProposal, overrides })` → record of key/value pairs for template merge.
+     - `formatCurrency(amount, currencyCode)` and `formatDate(date)` helpers.
+     - `getEditableFields(template)` returning normalized array of editable keys.
+3. **Read-only vs editable separation**
+   - Inside hook, derive `readOnlyFields` and `editableFields` arrays based on template metadata.
+   - Initialize form state with `editableFields` values (salary, start date) using proposal defaults.
+4. **Error & loading handling**
+   - Provide skeleton state for editor while fetching.
+   - Surface descriptive errors when data missing or user lacks permission; redirect to candidates list.
+5. **Testing**
+   - Add Vitest unit tests for mapping utilities verifying currency/date formatting and override precedence.
+
+**Deliverables:** Hook, mapping utilities, tests, and documentation on expected data shape.
+
+## Task 3: Contract Editor UI & Interactions
+**Objective:** Build the HR-facing editor page with read-only sections, editable controls, draft persistence, and change warnings.
+
+**Prerequisites:**
+- Task 2 hook returning assembled data.
+- `react-hook-form`, `zod`, and shadcn form components available.
+
+**Implementation Steps:**
+1. **Page layout**
+   - Create `src/pages/ContractEditor.tsx` route `/candidates/:candidateId/contract-editor`.
+   - Use responsive grid with left column (candidate & job summary) and right column (editor form + preview).
+2. **Read-only panels**
+   - Display candidate name, contact info, address, job title, employment type, etc. using shadcn `Card` and `DescriptionList` styles.
+3. **Editable form**
+   - Configure `react-hook-form` with `zod` schema enforcing:
+     - `salary` numeric > 0.
+     - `currency` one of supported codes.
+     - `startDate` future or today.
+   - Provide inline validation messages and disabled state when saving.
+4. **Draft persistence**
+   - Introduce new table `contract_drafts` (migration) storing `candidate_id`, `template_id`, `overrides` (jsonb), `updated_at`.
+   - Add Supabase helper to upsert draft on Save Draft button; load existing draft on mount to prefill form.
+5. **Unsaved change guard**
+   - Use `useBeforeUnload` and React Router navigation blocker to warn about unsaved edits.
+6. **Activity sidebar**
+   - Include tab or accordion showing variable mapping reference, template metadata, and recent audit events (from Task 5).
+7. **Toast notifications**
+   - Utilize existing toast system to inform success/failure for save, reset, and navigation actions.
+
+**Deliverables:** Contract Editor page, form schema, draft persistence migration, and UI tests (if feasible).
+
+## Task 4: PDF Generation & Export
+**Objective:** Merge template with current values, render preview, and allow download/upload of finalized contract PDFs.
+
+**Prerequisites:**
+- Decision on template format (PDF with form fields or DOCX/HTML placeholder).
+- Library installed (e.g., `pdf-lib`, `pdfjs-dist`, `jspdf`, or `docx-templater`).
+
+**Implementation Steps:**
+1. **Template parsing**
+   - If template uploaded as PDF with AcroForm fields, load using `pdf-lib` and fill via `setText()` for each placeholder key.
+   - If template uploaded as DOCX, parse using `docxtemplater`, convert to PDF via `pdf-lib` or serverless function.
+2. **Generator utility**
+   - Implement `src/lib/pdfGenerator.ts` exposing `generateContractPdf({ templateUrl, variables })` returning Blob.
+   - Include fallback for missing fields (log warning, highlight placeholder).
+3. **Preview rendering**
+   - Integrate `pdfjs-dist` to render first page thumbnails in editor; show full preview in modal or `<iframe>` using Blob URL.
+4. **Export actions**
+   - Add buttons: `Download PDF`, `Save to Candidate Record`, `Send Email` (optional future).
+   - For storage upload, create `contract-offers` bucket and Supabase helper saving file as `{candidateId}/{timestamp}.pdf`, storing reference in `contract_offers` table with status.
+5. **Post-export workflow**
+   - After successful generation, mark draft as finalized, log event, and provide link to open stored PDF.
+6. **Testing**
+   - Write integration test (Cypress or Playwright) covering generate + download path; add unit tests for generator with mock template.
+
+**Deliverables:** PDF generator module, preview component, storage helpers, and documentation on template placeholder requirements.
+
+## Task 5: Access Control & Auditing
+**Objective:** Restrict contract tooling to HR admins and capture an auditable history of key actions.
+
+**Prerequisites:**
+- Supabase auth users have role claims (`hr_admin` etc.).
+
+**Implementation Steps:**
+1. **Policies**
+   - Update Supabase RLS policies for `contract_templates`, `contract_drafts`, `contract_offers` to allow operations only when `auth.jwt() ->> 'role' = 'hr_admin'`.
+2. **Client guard**
+   - Implement `withHrAdminGuard` HOC or layout component verifying role from session; redirect unauthorized users.
+3. **Audit table**
+   - Create table `contract_audit_logs` with columns: `id`, `event_type`, `details` (jsonb), `performed_by`, `candidate_id`, `created_at`.
+4. **Logging helper**
+   - Add `src/lib/contractAudit.ts` with `logContractEvent(eventType, payload)` to insert records.
+5. **Emit events**
+   - Call logging helper on template upload, draft save, PDF export, and email send (future).
+6. **Admin audit view**
+   - Extend admin page to show recent audit entries with filtering by candidate/template.
+
+**Deliverables:** Policies, guard component, audit logging utilities, and UI listing audit history.
+
+## Task 6: QA, Documentation & Rollout
+**Objective:** Ensure feature stability, document usage, and prepare deployment.
+
+**Implementation Steps:**
+1. **Testing matrix**
+   - Run unit, integration, and E2E tests; document results in release notes.
+2. **Performance & security review**
+   - Verify storage files are private, inspect logs for PII leaks, and ensure signed URLs expire.
+3. **Documentation**
+   - Update `README.md` with contract editor overview, prerequisites, and troubleshooting.
+   - Create internal runbook for HR support describing upload/generation process.
+4. **Feature flagging**
+   - Optionally gate Contract Editor behind feature flag environment variable for gradual rollout.
+5. **Deployment**
+   - Coordinate with DevOps to run migrations, create storage buckets, and push frontend build.
+
+**Deliverables:** Test reports, updated docs, and deployment checklist.
