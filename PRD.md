# Bilingual Support Implementation Plan (English/Thai)

## Overview
Implement full bilingual support using **react-i18next** (industry-standard React i18n library) with language switcher icon in top-right corner of all pages.

## User Requirements
- **Scope**: Everything - all pages and forms (candidates, HR staff, and interviewers)
- **Storage**: Browser storage (localStorage) - choice saved per browser only
- **Database Values**: Keep English in database, translate for display only
- **Thai Language Style**: Neutral professional (no ครับ/ค่ะ particles)

## Implementation Steps

### Phase 1: Setup & Infrastructure (30-45 mins)

1. **Install Dependencies**
   ```bash
   npm install react-i18next i18next i18next-browser-languagedetector
   ```

2. **Create i18n Configuration** (`src/i18n/config.ts`)
   - Configure i18next with English and Thai languages
   - Set up localStorage for language persistence
   - Configure fallback language (English)

3. **Create Translation Files**
   - Create `src/i18n/locales/en/translation.json` (English translations)
   - Create `src/i18n/locales/th/translation.json` (Thai translations)
   - Organize translations by feature/page:
     - `common` - shared text (buttons, labels)
     - `auth` - login, access pages
     - `candidates` - candidate management
     - `interviews` - interview scheduling/feedback
     - `offers` - job offer pages
     - `status` - status badges and workflows
     - `validation` - form validation messages
     - `notifications` - toast messages

4. **Integrate i18n into App** (`src/main.tsx`)
   - Import and initialize i18n before React app renders
   - Wrap app with I18nextProvider

### Phase 2: Language Switcher Component (15-20 mins)

5. **Create LanguageSwitcher Component** (`src/components/LanguageSwitcher.tsx`)
   - Add language toggle button with flag icons or language codes (EN/TH)
   - Place in top-right corner of header (next to logout button)
   - Show current language indicator
   - Smooth transition when switching languages
   - Use lucide-react icons for visual appeal

### Phase 3: Update All Pages & Components (2-4 hours)

6. **Systematic Component Updates**
   Replace all hardcoded English text with `t()` function calls in this order:

   **Priority 1 - Common Components:**
   - `StatusBadge.tsx` - Status translations
   - `TablePagination.tsx` - Pagination controls
   - `LanguageSwitcher.tsx` - Language labels

   **Priority 2 - Dialogs:**
   - `ShortlistDialog.tsx`
   - `ScheduleInterviewDialog.tsx`
   - `SendOfferDialog.tsx`

   **Priority 3 - Auth Pages:**
   - `Login.tsx`
   - `Unauthorized.tsx`
   - `AccessPending.tsx`
   - `AuthCallback.tsx`

   **Priority 4 - Main Pages:**
   - `Candidates.tsx`
   - `CandidateDetail.tsx`
   - `InterviewerDashboard.tsx`
   - `AdminUsers.tsx`

   **Priority 5 - Forms:**
   - `ApplicationForm.tsx`
   - `PublicApplicationForm.tsx`
   - `SendOfferPage.tsx`
   - `InterviewFeedbackForm.tsx`
   - `InterviewFeedbackView.tsx`

   **Priority 6 - Public Pages:**
   - `Index.tsx` (landing page)
   - `NotFound.tsx`

7. **Handle Dynamic Content**
   - **Status values**: Map English DB values to translated display text
   - **Date formatting**: Use `date-fns` with locale support (th locale)
   - **Validation messages**: Translate all form error messages
   - **Toast notifications**: Translate all success/error messages
   - **Email templates**: Keep English for now (can be enhanced later)

### Phase 4: Translation Content Creation (3-5 hours)

8. **Create Translation Keys**
   - Organize by namespace (e.g., `candidates`, `interviews`, `offers`, `common`)
   - Follow consistent naming convention: `feature.section.element`
   - Include ~500-800 translation keys for full coverage

   Example structure:
   ```json
   {
     "common": {
       "submit": "Submit",
       "cancel": "Cancel",
       "save": "Save",
       "edit": "Edit",
       "delete": "Delete"
     },
     "candidates": {
       "title": "Candidates",
       "name": "Name",
       "email": "Email",
       "position_applied": "Position Applied"
     },
     "status": {
       "new": "New",
       "screening": "Screening",
       "shortlisted": "Shortlisted",
       "interview_scheduled": "Interview Scheduled",
       "interviewed": "Interviewed",
       "offer_sent": "Offer Sent"
     }
   }
   ```

9. **Provide Thai Translations**
   - Professional neutral tone (as specified)
   - HR/recruitment terminology accuracy
   - Keep technical terms in English where appropriate (e.g., "HR", "CV")
   - Ensure proper Thai spacing and punctuation

### Phase 5: Testing & Polish (30-60 mins)

10. **Test Language Switching**
    - Verify all pages switch languages correctly
    - Check localStorage persistence
    - Test with different browser sessions
    - Verify no missing translations (fallback to English)
    - Test all status badge translations
    - Test form validation messages in both languages

11. **UI/UX Refinements**
    - Ensure Thai text displays properly (Segoe UI supports Thai)
    - Adjust spacing/layout if Thai text is longer/shorter
    - Test on mobile devices
    - Check that language switcher is visible on all pages
    - Verify toast notifications appear in correct language

## File Structure
```
src/
├── i18n/
│   ├── config.ts                    # i18n configuration
│   └── locales/
│       ├── en/
│       │   └── translation.json     # English translations
│       └── th/
│           └── translation.json     # Thai translations
├── components/
│   ├── LanguageSwitcher.tsx         # NEW: Language toggle component
│   ├── StatusBadge.tsx              # UPDATED: Use translations
│   ├── TablePagination.tsx          # UPDATED: Use translations
│   ├── ShortlistDialog.tsx          # UPDATED: Use translations
│   └── [all other components]       # UPDATED: Use translations
├── pages/
│   └── [all pages]                  # UPDATED: Use translations
└── main.tsx                         # UPDATED: Initialize i18n
```

## Key Technical Decisions

- **Library**: react-i18next (most popular, 11M+ weekly downloads)
- **Storage**: localStorage (fast, simple, no database changes needed)
- **Database**: Keep English values, translate on display (recommended)
- **Thai Style**: Neutral professional (no ครับ/ค่ะ particles)
- **Fallback**: English as default if translation missing
- **Detection**: Auto-detect browser language, but allow manual override

## Example Usage in Components

### Before:
```tsx
<Button>Submit Application</Button>
<Label>Candidate Name</Label>
<h1>Interviewer Dashboard</h1>
```

### After:
```tsx
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();

  return (
    <>
      <Button>{t('common.submit_application')}</Button>
      <Label>{t('candidates.name_label')}</Label>
      <h1>{t('interviews.dashboard_title')}</h1>
    </>
  );
};
```

### Status Badge Translation:
```tsx
// StatusBadge.tsx
const { t } = useTranslation();

// Database has "shortlisted" (English)
// Display shows translated version
<Badge>{t(`status.${status}`)}</Badge>
```

## Estimated Time: 6-10 hours total
- Core setup & configuration: 1 hour
- Component & page updates: 3-4 hours
- Translation content creation: 3-5 hours
- Testing & refinement: 1 hour

## Benefits
✅ Professional bilingual support for Thai and international users
✅ Easy to add more languages later (just add new locale files)
✅ Centralized translation management (no scattered hardcoded text)
✅ No database schema changes required
✅ Automatic language detection based on browser settings
✅ Manual language override with persistent storage
✅ Type-safe with TypeScript integration
✅ Industry-standard solution (react-i18next)

## Future Enhancements (Optional)
- Add more languages (Chinese, Japanese, etc.)
- Translate email notifications
- Add language preference to user profile (database)
- Implement translation management UI for non-developers
- Add RTL language support if needed
- Professional translation review/editing

## Notes
- All existing functionality remains unchanged
- Database values stay in English (backward compatible)
- Only UI text is translated
- Email notifications remain in English initially
- Can be implemented incrementally (page by page if needed)
