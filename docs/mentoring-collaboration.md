# Mentoring collaboration
Mentors use the existing portal sidebar: Mentor Dashboard, Mentee 360°, Discussions, and Tasks & Schedule. Students use My Mentor with Mentee Dashboard, Discussions, and Tasks & Schedule. The duplicate profile and communications tabs are removed; old student links redirect to the corresponding current section.

Tasks & Schedule provides My Tasks, Needs Attention, Schedule (Calendar), and Completed. Needs Attention excludes completed and undated tasks, shows overdue tasks and tasks due through two calendar days from today in Asia/Kolkata, and orders by earliest deadline. It reads the same saved task records and supports the same status controls.

The admin sidebar and placement navigation remain unchanged. Updated mentoring and Mentee 360 views appear inside Mentor Management. Master Wizard and the deferred admin navigation redesign are excluded. Candidate views outside Mentor Management retain their existing entry point.

Both portals share authenticated database-backed mentoring APIs. Allocation and tenant ownership, optimistic versions, bounded attachments, current-assignment access, and student/staff permissions are enforced by the backend. Production never loads local sample records. New discussions, tasks and sessions appear as users create them; absent records use empty states.

Backend migrations 0139 (saved coach conversations shown in Mentee 360) and 0140 (assignment-scoped mentoring workspace) are additive. The deployment requires both API services and both frontend releases. Existing milestone tasks retain their original coaching data and completion state.
