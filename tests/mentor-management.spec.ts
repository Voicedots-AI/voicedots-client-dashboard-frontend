import { test, expect, type Page } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route(/^http:\/\/127\.0\.0\.1:5193\/api\//, route => route.fulfill({ json: {} }));
  await page.addInitScript(() => localStorage.setItem('access_token', 'test-session'));
  await page.route('**/v1/users/me', route => route.fulfill({ json: { user_id: 'admin', name: 'Test Admin', email: 'admin@example.test' } }));
  await page.route('**/v3/college/access', route => route.fulfill({ json: { enabled: true, mentor_management_enabled: true, college_name: 'Test institute' } }));
  await page.route('**/v3/email/capabilities', route => route.fulfill({ json: { enabled: false } }));
});
const faculty = () => [
  {
    id: "faculty-a",
    name: "Test Faculty A",
    email: "faculty-a@example.test",
    employee_code: "FAC-A",
    user_id: "user-a",
    mentor_id: null,
  },
  {
    id: "faculty-b",
    name: "Test Faculty B",
    email: "faculty-b@example.test",
    employee_code: "FAC-B",
    user_id: "user-b",
    mentor_id: null,
  },
];
const mentor = () => ({
  id: "mentor-a",
  staffId: "faculty-a",
  name: "Test Faculty A",
  email: "faculty-a@example.test",
  department: "IT",
  designation: "Professor",
  phone: "+91 1234567890",
  capacity: 2,
  assignedCount: 0,
  active: true,
  bio: "",
  expertise: "Databases",
  preference: "",
  version: 1,
  invitation: "queued",
});
const student = () => ({
  id: "student-a",
  rollNumber: "REG-A",
  name: "Test Student A",
  email: "student-a@example.test",
  department: "IT",
  degree: "B.E.",
  batch: "",
  semester: null,
  mentorId: "",
  readiness: null,
  competency: null,
  attendance: null,
  milestones: [],
  notes: "",
  plan: "",
  placement: null,
  coachingVersion: 0,
  dimensions: [],
  assessmentSessionId: null,
  assessmentAt: null,
});
async function mockApi(page: Page, asMentor = false) {
  const data = {
    mentors: [mentor()],
    students: [student()],
    faculty: faculty(),
    logs: [],
    transfers: [],
    permissions: {
      Mentor: ["View assigned mentees", "Update coaching & action records"],
    },
    access: { can_manage: !asMentor, mentor_id: asMentor ? "mentor-a" : null },
  };
  if (asMentor) data.students[0].mentorId = "mentor-a";
  const writes: { path: string; body: any }[] = [];
  await page.route("**/v3/college/mentors**", async (route) => {
    const path = new URL(route.request().url()).pathname.split(
      "/v3/college/",
    )[1];
    const body = route.request().postDataJSON();
    if (route.request().method() === "GET")
      return route.fulfill({ json: data });
    writes.push({ path, body });
    if (path === "mentors") {
      data.mentors.push({
        ...mentor(),
        ...body,
        id: "mentor-b",
        name: "Test Faculty B",
        email: "faculty-b@example.test",
      });
      return route.fulfill({
        status: 201,
        json: { id: "mentor-b", email_queued: true },
      });
    }
    if (path === "mentors/assign") {
      data.students.forEach((s) => {
        if (body.student_ids.includes(s.id)) s.mentorId = body.mentor_id;
      });
      data.mentors[0].assignedCount++;
      return route.fulfill({ json: { assigned: body.student_ids.length } });
    }
    if (path.endsWith("/coaching")) {
      Object.assign(data.students[0], body, { coachingVersion: 1 });
      return route.fulfill({ json: { saved: true } });
    }
    if (path.endsWith("/invite"))
      return route.fulfill({ json: { email_queued: true } });
    return route.fulfill({ json: { saved: true } });
  });
  await page.goto("/dashboard/placement-management?view=mentors");
  return { data, writes };
}
test("uses API records and selects existing faculty rather than creating identities", async ({
  page,
}) => {
  const { writes } = await mockApi(page);
  await expect(page.getByText("Test Faculty A", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add Mentor", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Existing faculty", exact: true })
    .selectOption("faculty-b");
  await page.getByLabel("Department *", { exact: true }).fill("IT");
  await page.getByLabel("Designation *", { exact: true }).fill("Professor");
  await expect(page.getByLabel("Email ID *", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Save Mentor", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "1 invitation emails queued",
  );
  expect(writes.find((w) => w.path === "mentors")?.body.staffId).toBe(
    "faculty-b",
  );
  await page.reload();
  await expect(page.getByText("Test Faculty B", { exact: true })).toBeVisible();
});
test("assignment wizard writes student IDs to the server and refreshes allocation", async ({
  page,
}) => {
  const { writes } = await mockApi(page);
  await page
    .getByRole("button", { name: "Assign Mentee", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Choose Students", exact: true })
    .last()
    .click();
  await page
    .getByRole("checkbox", { name: "Select Test Student A", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Review & Assign", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Assign Mentees", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Mentees assigned saved",
  );
  expect(writes[0].body).toMatchObject({
    mentor_id: "mentor-a",
    student_ids: ["student-a"],
    from_mentor_id: null,
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Mentor Dashboard", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Test Student A/ }),
  ).toBeVisible();
});
test("API failure shows retry and never substitutes dummy records", async ({
  page,
}) => {
  await page.route("**/v3/college/mentors/state", (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "Mentor service unavailable" },
    }),
  );
  await page.goto("/dashboard/placement-management?view=mentors");
  await expect(page.getByRole("alert")).toContainText(
    "Mentor service unavailable",
  );
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Dr. R. Srinivasan")).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
});
test("mentor sees only mentor pages and shared coaching writes include milestones and version", async ({
  page,
}) => {
  const { writes } = await mockApi(page, true);
  await expect(
    page.getByRole("heading", { name: "Mentor Dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mentor Master", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Mentee Progress", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Improvement plan", exact: true })
    .fill("Practice joins");
  await page
    .getByRole("textbox", { name: "Feedback visible to student", exact: true })
    .fill("Review on Friday");
  await page
    .getByRole("button", { name: "Add Milestone", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Milestone 1", exact: true })
    .fill("Finish SQL practice");
  await page
    .getByRole("checkbox", { name: "Complete milestone 1", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Save Coaching Record", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Coaching record updated saved",
  );
  expect(writes[0].body).toMatchObject({
    plan: "Practice joins",
    notes: "Review on Friday",
    version: 0,
    milestones: [{ title: "Finish SQL practice", done: true }],
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Mentee Progress", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Improvement plan", exact: true }),
  ).toHaveValue("Practice joins");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Mentee Progress", exact: true }),
  ).toBeVisible();
});
