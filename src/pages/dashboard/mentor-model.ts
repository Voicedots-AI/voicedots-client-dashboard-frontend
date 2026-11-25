export type Milestone = {
  id: string;
  title: string;
  due: string | null;
  done: boolean;
};
export type Mentor = {
  id: string;
  staffId: string;
  userId?: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  phone: string;
  capacity: number;
  active: boolean;
  bio: string;
  expertise: string;
  preference: string;
  photo: string;
  invitation: string;
  version: number;
  assignedCount: number;
  employeeCode?: string;
};
export type AcademicYear = {id:string;label:string;starts_on?:string;ends_on?:string};
export type Mentee = {
  academicYearIds?:string[];
  student_status?:string;
  hasPhoto?:boolean;
  aiProgress?:number|null;
  aiTasksCompleted?:number;
  aiTasksTotal?:number;
  aiPlans?:number;
  id: string;
  rollNumber: string;
  name: string;
  email: string;
  department: string;
  degree: string;
  batch: string;
  semester: string | null;
  mentorId: string;
  readiness: number | null;
  competency: number | null;
  attendance: number | null;
  progress: number | null;
  milestones: number;
  milestoneItems: Milestone[];
  notes: string;
  plan: string;
  placement: string;
  coachingVersion: number;
  dimensions: { name: string; value: number }[];
  assessmentSessionId: string | null;
  assessmentAt: string | null;
};
export type Audit = {
  id: string;
  at: string;
  action: string;
  detail: string;
  actor: string;
};
export type Transfer = {
  id: string;
  at: string;
  student: string;
  from: string;
  to: string;
  reason: string;
};
export type Faculty = {
  id: string;
  name: string;
  email: string;
  employee_code: string;
  user_id: string;
  mentor_id: string | null;
};
export type MentorState = {
  academicYears?:AcademicYear[];
  mentors: Mentor[];
  students: Mentee[];
  faculty: Faculty[];
  logs: Audit[];
  transfers: Transfer[];
  permissions: Record<string, string[]>;
  access: { can_manage: boolean; mentor_id: string | null };
};
export const permissions = [
  "View assigned mentees",
  "View placement eligibility",
  "Update coaching & action records",
  "Access mentor progress analytics",
  "View mentee assessment & progress",
  "Create improvement plans",
  "Manage mentee notes",
];
export const roles = ["Institute Placement Officer", "Mentor"];
export const emptyMentor = (): Mentor => ({
  id: "",
  staffId: "",
  name: "",
  email: "",
  department: "",
  designation: "",
  phone: "",
  capacity: 60,
  active: true,
  bio: "",
  expertise: "",
  preference: "",
  photo: "",
  assignedCount: 0,
  invitation: "not_sent",
  version: 0,
});
export const initialState = (): MentorState => ({
  mentors: [],
  students: [],
  faculty: [],
  logs: [],
  transfers: [],
  permissions: { Mentor: [] },
  access: { can_manage: false, mentor_id: null },
});
export function normalizeState(raw: MentorState): MentorState {
  return {
    ...raw,
    mentors: raw.mentors,
    students: raw.students.map((s) => {
      const items =
        (s as unknown as { milestones: Milestone[] }).milestones || [];
      return {
        ...s,
        attendance: s.attendance == null ? null : Number(s.attendance),
        progress: items.length
          ? Math.round(
              (items.filter((m) => m.done).length * 100) / items.length,
            )
          : null,
        milestones: items.filter((m) => m.done).length,
        milestoneItems: items,
        department: s.department || "",
        batch: s.batch || "",
        dimensions: s.dimensions || [],
        placement: s.placement || "Not recorded",
      };
    }),
  };
}
export function exportCsv(name: string, rows: (string | number)[][]) {
  const value = rows
    .map((row) =>
      row
        .map(
          (v) =>
            `"${String(v)
              .replace(/^[=+@\-\t\r]/, "'$&")
              .replaceAll('"', '""')}"`,
        )
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\ufeff" + value], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function importMentors(
  csv: string,
  existing: Mentor[],
  faculty: Faculty[],
): Mentor[] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
      if (quoted && csv[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\r" || c === "\n") && !quoted) {
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
      if (c === "\r" && csv[i + 1] === "\n") i++;
    } else cell += c;
  }
  if (quoted) throw new Error("CSV has an unclosed quoted field.");
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  const header = (rows.shift() || []).map((v) =>
    v
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase(),
  );
  for (const field of ["staff_id", "capacity"])
    if (!header.includes(field))
      throw new Error(`Missing column: ${field}. Use the import template.`);
  if (!rows.length || rows.length > 1000)
    throw new Error("Import between 1 and 1,000 mentors at a time.");
  const ids = new Set(existing.map((m) => m.staffId));
  return rows.map((values, i) => {
    const get = (name: string) => values[header.indexOf(name)]?.trim() || "";
    const staff = faculty.find((f) => f.id === get("staff_id")),
      capacity = Number(get("capacity"));
    if (
      !staff ||
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 1000
    )
      throw new Error(
        `Row ${i + 2}: choose an existing faculty ID and capacity (1–1000).`,
      );
    if (ids.has(staff.id))
      throw new Error(
        `Row ${i + 2}: faculty member is already a mentor or repeated.`,
      );
    ids.add(staff.id);
    return {
      ...emptyMentor(),
      staffId: staff.id,
      name: staff.name,
      email: staff.email,
      capacity,
      department: get("department"),
      designation: get("designation"),
      phone: get("phone"),
      expertise: get("expertise"),
    };
  });
}
