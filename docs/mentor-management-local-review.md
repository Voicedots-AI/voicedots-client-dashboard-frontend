# Mentor Management — connected implementation and local checks

The production component contains no sample mentors, student identities, scores or dates. It reads and writes the shared student service through the authenticated Client bridge. The previous localStorage review data is ignored and never uploaded.

## Account and data flow

1. Existing faculty records come from `college_staff`, linked by their registered email to their institute portal account (`users` and `client_college_access`). Faculty must already exist in Institution Management. Missing portal access is provisioned from that faculty record; conflicting existing identities are rejected. Add Mentor selects that faculty; it does not create another person or login.
2. Migration `0135 faculty_mentoring` adds tenant-scoped mentor profiles, student allocations, coaching records, transfer history and mentor permission configuration. Existing students and faculty remain the identity sources.
3. Institute administrators and placement officers manage mentors. Faculty use the same Client login; an assigned faculty member sees Mentor Dashboard and Mentee Progress for their assigned students. Academic faculty roles without a mentor assignment cannot administer mentoring. Deactivation does not grant management access.
4. Each student has one active allocation. One mentor can have multiple mentees up to capacity. Allocation and transfer run in a database transaction with a college-level lock and uniqueness constraints, so concurrent requests cannot overfill a mentor or assign a student twice. Existing officer academic scopes remain enforced.
5. Faculty name and email come from the existing faculty record. The Mentor label also appears on the existing Staff Roster. Contact details, plans, student-visible feedback and milestones are read by the student from the same profile/coaching rows. Feedback entered here is explicitly shared with the student.
6. Readiness and competency use the latest completed, released, rankable placement assessment projection. Future releases and held results are excluded. Dimension values come from the stored evaluation report, without fabricated per-dimension offsets. Attendance and semester come from the existing ERP summaries/enrollments. Unavailable values remain unassessed. Placement status currently reports confirmed `Placed` from the student roster; it does not invent drive eligibility.
7. Mentor plan progress is the fraction of saved mentoring milestones marked complete. It is labelled milestone progress and does not claim to be an AI Coach completion score. No AI calls are introduced.
8. Mentor profiles and coaching records carry versions. Conflicting edits receive HTTP 409 rather than silently overwriting another user's save. Visible pages refresh on focus/every 30 seconds unless the reviewer has unsaved edits; Refresh always reads the server.

## Email

Creating a mentor through the Client API also attempts to enqueue the invitation. Faculty with an active portal account receive a link to the existing login and keep their password. Already invited faculty receive a hashed, single-use password setup token with a seven-day expiry, redeemed by the existing login flow. Successful resend invalidates older open setup links. Queue failure does not undo the mentor profile; status is recorded as failed and the officer can resend. Resend has a 60-second cooldown. “Queued” means accepted by the existing transactional email service, not confirmed inbox delivery.

CSV bulk import selects existing faculty by `staff_id`; it never creates arbitrary users. The downloaded template is prefilled with eligible faculty IDs, names and emails from the live faculty catalog; choose rows and fill capacity and optional mentoring fields. Both XLSX and CSV imports are supported; formulas and duplicate faculty rows are rejected.

## Local environment

Use your configured development/staging databases and the same institute identity mapping across both services. Do not point test commands at production. There are separate Client and Student databases; they are linked by the existing signed management bridge.

Start the already configured private local review runtime with:

```bash
python /home/prajapati/voicedots-github/.local/mentor-development/start_local.py
```

The launcher starts the persistent local PostgreSQL database on port 55439 when needed. Migration 0135 has been applied to the local review database. Frontends use the ignored `.env.local` files in the review worktrees; both use the local APIs through their existing proxies. Invitation links use `MENTOR_PORTAL_URL=http://127.0.0.1:5173`. The default production URL remains the existing hosted login when that override is absent.

## Manual acceptance flow

1. Open the Client portal at `http://127.0.0.1:5173`. Go to Placement Management → Mentor Management (fifth entry).
2. Choose Add Mentor → select existing faculty. Name/email must be read-only. Enter department, designation, contact phone, capacity and mentoring areas. Save. Check the Mentor label in both Mentor Master and Institution Management → Staff Roster.
3. Confirm the email queue status. Check the recipient's inbox if your email service is configured. Existing faculty should retain their password. Resend after a minute if necessary; verify a visible failure if the email service is unavailable.
4. Assign Mentee → select mentor → choose students → review → assign. Confirm the assigned and available totals. Refresh/reopen the browser and confirm assignments persist. Try exceeding capacity or selecting an already assigned student; the server must reject it.
5. Use a separate browser session to sign in as that faculty member through the existing login. Open Mentor Management. Only their assigned mentees should appear. Save a plan, student-visible feedback and milestones; mark one milestone complete.
6. Sign in as that student at `http://127.0.0.1:5175`, then open My Mentor. Confirm the same faculty/contact, plan, feedback and milestones. Compare readiness/competency with the mentor's latest released assessment. Students without released results must show Not assessed.
7. As the officer, reassign the student with a reason. Refresh both faculty sessions and the student page. The former mentor must lose access, the new mentor must gain access, and the student must see the new mentor. Check Reassignment History and Audit Logs.
8. Disable a mentor or revoke a mentor permission and confirm the API rejects the prohibited action. Check with another institute's account to ensure its mentors and students are absent.

No production mentor migration, source push or deployment was performed. A real transactional invitation email was sent during the authorized local review. The database integration tests use an isolated local PostgreSQL database; email tests mock the outbound email service.

## Automated verification

- Client and Student frontend production builds.
- `tests/mentor-management.spec.ts`: API-backed UI contract tests with request interception, including error/no-dummy fallback, existing-faculty selection, persisted allocation and shared coaching payloads.
- Student backend `tests/test_faculty_mentoring.py`: real PostgreSQL assignment, transfer, ownership, tenant isolation, permission, conflict, capacity and release-consistency tests. Run only against a dedicated database whose name contains `test`.
- Client backend `tests/test_mentor_invitations.py`: existing-password preservation, expiring setup links, queue failure and middleware route checks, with mocked external email delivery.


## Verified local review — 10 November 2026

The review worktrees are in `/home/prajapati/voicedots-github/mentor-worktrees/`.

- Admin/faculty: http://127.0.0.1:5173/dashboard/placement-management?view=mentors
- Student: http://127.0.0.1:5175/mentor
- Local records are restored copies of real institute records. Changes here are not production changes or continuous synchronization with production.
- The local Client API now uses the configured real transactional email service. An invitation was queued and its email log confirmed `sent` with a provider message ID. Inbox placement is not confirmed.
- One eligible existing faculty mentor and two existing students were used for end-to-end review. Two other faculty records have conflicting login identities; the API rejects these rather than changing another account.
- Automated browser checks loaded the authenticated admin Mentor Master, faculty Mentor Dashboard, and student My Mentor using the actual APIs. The student page showed exactly the saved mentoring plan.
- Client API checks: 34 passed. Student PostgreSQL checks: 11 passed, including transfers, capacity races, tenant isolation, permissions, released-score parity, and account-link conflicts. Both frontend production builds passed.

### Check the screens

1. Sign in as the institute administrator on port 5173. Open Placement Management → Mentor Management.
2. Mentor Master shows the saved existing faculty member. Assign Mentee shows the two saved allocations.
3. Use the same login page for faculty. The private local review credentials are stored in `.local/mentor-development/flow-review.json` outside the application source; never commit or send that file.
4. In Mentee Progress, open the assigned student, edit the coaching plan or shared feedback, and Save.
5. Sign in as that student on port 5175 and open My Mentor. Refresh: the mentor contact, plan, feedback and milestones must match.
6. On the admin screen, use Resend Invitation to enqueue a real email to the existing faculty email. Links deliberately point to localhost during this review and work on the development computer. No hosted Mentor Management release has occurred.

The private runtime launcher is `.local/mentor-development/run_service.py` with `client`, `student`, or `mail`. The database is now stored persistently under `.local/mentor-development/postgres`, not `/tmp`. API ports are 8007 and 8006. `MENTOR_EMAIL_MODE=capture` switches the Client API to the local test inbox on port 8018; the default uses the configured real mail service.


## Production rollout

Mentor Management is now controlled by the Student API's `MENTOR_ENABLED_COLLEGE_IDS` environment variable. In production an unset value hides and blocks mentoring. Enable only approved institute IDs; the server includes the capability in authenticated client and student identity responses. Existing faculty use the existing Client login and password-setup routes; there is no separate Mentor login page. Adding a mentor does not reset an existing faculty password or make the faculty member a placement administrator.

The 10 November production release preserves the captured live API code with mentor changes merged onto it. Rollback images, runtime/Compose captures and full database backups are retained privately under `/root/voicedots/releases/mentor-live-20261110/`. No local snapshot records or test passwords are copied to production. The requested faculty are created separately through the authenticated live APIs.
