# Placement UI handoff

- Assessment Intelligence: `src/pages/dashboard/AssessmentIntelligence.tsx`. Filters apply automatically after a short debounce; the common expand/collapse control is above the filters.
- AI Coach is a disabled integration placeholder in `AICoachPlaceholder.tsx`. `canOfferAICoach` controls visibility from recorded assessments, readiness and known placement decisions. Attach the real action here; no coaching API is invoked by the placeholder.
- Resume and candidate biodata: `AssessmentCandidateDetails.tsx`. Resume files use the existing authorized drive/candidate endpoint; ATS assessment actions also provide an inline preview.
- The restored scorecard markup is `src/shared-assessment/ReferenceScorecard.tsx`, used by both portals. Shared source files and `manifest.json` must be synchronized between the client frontend and `student-fix-placements-v4`. The prebuild check validates their hashes.
- Student dashboard history and placement cards share `PlacementDriveActions` for interview, ATS and scorecard behavior. The student ATS resume preview resolves the resume submission used for the assessment.
- Deploy the corresponding student backend changes before relying on the new drive settings: optional location/schedule and persisted CGPA, ATS-fit and interview-score cutoffs. The backend adds nullable threshold columns through its normal schema migrations. The interview-score minimum governs shortlisting after an assessment, not entry to the first interview.
- Release verification: both frontend production builds, server-render checks (no browser), and focused backend contract/access tests. Browser acceptance remains with the reviewer.
