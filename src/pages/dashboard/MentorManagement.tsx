import MenteeBulkDialog from './MenteeBulkDialog';
import {emptyMenteeFilters,filterMentees,menteeFilterOptions,selectableMentees,toggleMenteePage,type MenteeFilters} from './mentee-filters';
import MentorProgressPanels from './MentorProgressPanels';
import MentorProfilePhoto,{MentorPhotoEditor} from './MentorProfilePhoto';
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Users,
  UserRoundPlus,
  Download,
  Search,
  Pencil,
  Eye,
  ArrowRight,
  ArrowLeft,
  Gauge,
  GraduationCap,
  CalendarDays,
  CheckCircle2,
  Mail,
  Upload,
  ShieldCheck,
  History,
  X,
} from "lucide-react";
import {
  emptyMentor,
  initialState,
  exportCsv,
  permissions,
  roles,
  type Mentor,
  type MentorState,
} from "./mentor-model";
import "./mentor-management.css";
import { collegeApi, collegeError } from "@/api/collegeApi";
import { normalizeState } from "./mentor-model";
const sections = [
  "Mentor Master",
  "Assign Mentee",
  "Mentor Reports",
  "Reassignment History",
  "Roles & Permissions",
  "Audit Logs",
  "Mentor Dashboard",
  "Mentee Progress",
];
const descriptions = [
  "Manage mentors, capacity, and allocation.",
  "Allocate one or multiple mentees to a mentor.",
  "Analyze mentoring performance, mentee progress, and outcomes.",
  "Reassign mentees between mentors with complete history.",
  "Manage role-based access for mentor management.",
  "Track all mentor management activities.",
  "Overview of key mentoring metrics and career readiness.",
  "Track individual mentee career development and milestones.",
];
const pct = (n: number | null) => (n === null ? "Not assessed" : `${n}%`);
export default function MentorManagement() {
  const [state, setState] = useState<MentorState>(initialState),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const mutating = useRef(false),
    requestId = useRef(0),
    dirty = useRef(false),
    mentorRef = useRef("");
  async function load() {
    const id = ++requestId.current;
    try {
      const raw = await collegeApi.get<MentorState>("mentors/state");
      if (id !== requestId.current) return;
      const data = normalizeState(raw);
      setState(data);
      dirty.current = false;
      setError("");
      const chosen = data.mentors.some((m) => m.id === mentorRef.current)
        ? mentorRef.current
        : data.access.mentor_id || data.mentors[0]?.id || "";
      setMentorId(chosen);
      setStudentId((v) =>
        data.students.some((s) => s.id === v && s.mentorId === chosen)
          ? v
          : data.students.find((s) => s.mentorId === chosen)?.id || "",
      );
      setRoleDraft(data.permissions.Mentor || []);
      if (!data.access.can_manage)
        setTab((v) =>
          ["Mentor Dashboard", "Mentee Progress"].includes(v)
            ? v
            : "Mentor Dashboard",
        );
    } catch (e) {
      if (id === requestId.current) setError(collegeError(e));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const refresh = () => {
      if (!document.hidden && !mutating.current && !dirty.current) void load();
    };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      requestId.current++;
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, []);
  const [tab, setTab] = useState("Mentor Master"),
    [search, setSearch] = useState(""),
    [dept, setDept] = useState(""),
    [status, setStatus] = useState(""),
    [notice, setNotice] = useState(""),
    [editing, setEditing] = useState<Mentor | null>(null),
    [formTab, setFormTab] = useState(0),
    [readOnly, setReadOnly] = useState(false),
    [mentorId, setMentorId] = useState(state.mentors[0]?.id || ""),
    [selected, setSelected] = useState<string[]>([]),
    [step, setStep] = useState(1),
    [bulkOpen,setBulkOpen] = useState(false),
    [to, setTo] = useState(""),
    [reason, setReason] = useState("Change in mentor workload"),
    [role, setRole] = useState("Mentor"),
    [roleDraft, setRoleDraft] = useState(state.permissions.Mentor || []),
    [studentId, setStudentId] = useState(state.students[0]?.id || ""),
    [progressTab, setProgressTab] = useState("Overall Status"),
    [reportTab, setReportTab] = useState("Overview"),
    [studentFilters, setStudentFilters] = useState<MenteeFilters>(emptyMenteeFilters),
    [studentFilterDraft,setStudentFilterDraft] = useState<MenteeFilters>(emptyMenteeFilters),
    [studentPage,setStudentPage] = useState(1);
  mentorRef.current = mentorId;
  const commit = async (next: MentorState, action: string, _detail: string) => {
    if (mutating.current) return false;
    mutating.current = true;
    setSaving(true);
    setNotice("");
    setError("");
    const payload = (m: Mentor) => ({
      staffId: m.staffId,
      department: m.department,
      designation: m.designation,
      phone: m.phone,
      capacity: m.capacity,
      active: m.active,
      bio: m.bio,
      expertise: m.expertise,
      preference: m.preference,
      version: m.version,
    });
    try {
      let invitations = 0,
        failures = 0;
      if (action === "Mentor added") {
        const m = next.mentors.find(
          (m) => !state.mentors.some((v) => v.id === m.id),
        );
        if (!m) throw new Error("Select faculty first.");
        const saved = await collegeApi.save<{
          id: string;
          email_queued: boolean;
        }>("mentors", payload(m));
        invitations = 1;
        failures = saved.email_queued ? 0 : 1;
      } else if (action === "Mentors imported") {
        const added = next.mentors.slice(state.mentors.length);
        const saved = await collegeApi.save<{
          items: { id: string; email_queued: boolean }[];
        }>("mentors/bulk", { mentors: added.map(payload) });
        invitations = saved.items.length;
        failures = saved.items.filter((m) => !m.email_queued).length;
      } else if (action === "Mentor updated") {
        const m = next.mentors.find(
          (m) =>
            JSON.stringify(m) !==
            JSON.stringify(state.mentors.find((v) => v.id === m.id)),
        );
        if (!m) throw new Error("No mentor changes to save.");
        await collegeApi.save(`mentors/profiles/${m.id}`, payload(m), true);
      } else if (
        action === "Mentees assigned" ||
        action === "Mentees reassigned"
      ) {
        const changed = next.students.filter(
          (s) =>
            s.mentorId !== state.students.find((v) => v.id === s.id)?.mentorId,
        );
        await collegeApi.save("mentors/assign", {
          mentor_id: changed[0]?.mentorId,
          student_ids: changed.map((s) => s.id),
          from_mentor_id: action === "Mentees reassigned" ? mentorId : null,
          reason: action === "Mentees reassigned" ? reason : "",
        });
      } else if (action === "Role configuration updated") {
        await collegeApi.save(
          "mentors/permissions",
          { permissions: next.permissions.Mentor },
          true,
        );
      } else if (action === "Coaching record updated") {
        const student = next.students.find(
          (s) =>
            JSON.stringify(s) !==
            JSON.stringify(state.students.find((v) => v.id === s.id)),
        );
        if (!student) throw new Error("No coaching changes to save.");
        await collegeApi.save(
          `mentors/students/${student.id}/coaching`,
          {
            plan: student.plan,
            notes: student.notes,
            milestones: student.milestoneItems,
            version: student.coachingVersion,
          },
          true,
        );
      }

      await load();
      setNotice(
        `${action} saved.${invitations ? ` ${invitations - failures} invitation emails queued.${failures ? ` ${failures} failed; use Resend Invitation.` : ""}` : ""}`,
      );
      return true;
    } catch (e) {
      setError(
        e instanceof Error && !(e as { isAxiosError?: boolean }).isAxiosError
          ? e.message
          : collegeError(e),
      );
      return false;
    } finally {
      mutating.current = false;
      setSaving(false);
    }
  };
  const resend = async (m: Mentor) => {
    if (mutating.current) return;
    mutating.current = true;
    setSaving(true);
    try {
      await collegeApi.save(`mentors/${m.id}/invite`, {});
      setNotice(`Invitation email queued for ${m.email}.`);
      await load();
    } catch (e) {
      setError(collegeError(e));
    } finally {
      mutating.current = false;
      setSaving(false);
    }
  };
  const go = (name: string) => {
    setTab(name);
    setSearch("");
    setDept("");
    setStatus("");
    setSelected([]);
    setStep(1);
    setNotice("");
    setStudentFilters(emptyMenteeFilters());
    setStudentFilterDraft(emptyMenteeFilters());
    setStudentPage(1);
  };
  const mentor = state.mentors.find((m) => m.id === mentorId),
    assigned = state.students.filter((s) => s.mentorId === mentorId),
    student = state.students.find((s) => s.id === studentId);
  const departments = Array.from(
    new Set([
      ...state.mentors.map((m) => m.department),
      ...state.students.map((s) => s.department),
    ]),
  );
  const filtered = state.mentors.filter(
    (m) =>
      (!dept || m.department === dept) &&
      (!status || (status === "Active") === m.active) &&
      `${m.name} ${m.id} ${m.email}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const students = filterMentees(state.students,studentFilters);
  const studentPageCount=Math.max(1,Math.ceil(students.length/20));
  const currentStudentPage=Math.min(studentPage,studentPageCount);
  const visibleStudents=students.slice((currentStudentPage-1)*20,currentStudentPage*20);
  const selectablePage=selectableMentees(visibleStudents);
  const selectedOutsideFilters=selected.filter(id=>!students.some(student=>student.id===id)).length;
  const resetStudentFilters=()=>{setStudentFilterDraft(emptyMenteeFilters());setStudentFilters(emptyMenteeFilters());setStudentPage(1)};
  const avg = (items: typeof state.students) => {
    const values = items.filter((s) => s.readiness !== null);
    return values.length
      ? Math.round(
          values.reduce((a, s) => a + (s.readiness || 0), 0) / values.length,
        )
      : null;
  };
  const toggle = (id: string) =>
    setSelected((v) =>
      v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
    );
  const saveMentor = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.staffId)
      return setNotice("Select an existing faculty member.");
    if (
      state.mentors.some(
        (m) =>
          m.id !== editing.id &&
          m.email.toLowerCase() === editing.email.toLowerCase(),
      )
    )
      return setNotice("A mentor with this email already exists.");
    if (editing.capacity < editing.assignedCount)
      return setNotice("Capacity cannot be below the current allocation.");
    if (
      !editing.name.trim() ||
      !editing.email.trim() ||
      !editing.department.trim()
    )
      return setNotice("Name, email and department are required.");
    const exists = state.mentors.some((m) => m.id === editing.id);
    if (
      await commit(
        {
          ...state,
          mentors: exists
            ? state.mentors.map((m) => (m.id === editing.id ? editing : m))
            : [...state.mentors, editing],
        },
        exists ? "Mentor updated" : "Mentor added",
        `${editing.name} · Faculty mentor access`,
      )
    )
      setEditing(null);
  };
  const allocate = async (transfer = false) => {
    const target = state.mentors.find(
      (m) => m.id === (transfer ? to : mentorId),
    );
    if (!target?.active || !selected.length)
      return setNotice("Choose an active mentor and at least one student.");
    const items = state.students.filter((s) => selected.includes(s.id));
    if (
      items.length !== selected.length ||
      items.some((s) => s.student_status==='inactive' || (transfer ? s.mentorId !== mentorId : !!s.mentorId))
    )
      return setNotice("Student allocation changed. Select students again.");
    if (transfer && (!reason.trim() || to === mentorId))
      return setNotice("Choose a different mentor and enter a reason.");
    if (target.assignedCount + items.length > target.capacity)
      return setNotice(
        "This allocation exceeds the mentor’s maximum capacity.",
      );
    const at = new Date().toISOString();
    if (
      await commit(
        {
          ...state,
          students: state.students.map((s) =>
            selected.includes(s.id) ? { ...s, mentorId: target.id } : s,
          ),
          transfers: transfer
            ? [
                ...items.map((s) => ({
                  id: crypto.randomUUID(),
                  at,
                  student: s.name,
                  from: mentor?.name || "",
                  to: target.name,
                  reason,
                })),
                ...state.transfers,
              ]
            : state.transfers,
        },
        transfer ? "Mentees reassigned" : "Mentees assigned",
        `${items.length} students → ${target.name}`,
      )
    ) {
      setSelected([]);
      setStep(1);
    }
  };
  const mentorSelect = (value: string, onChange: (v: string) => void) => (
    <select
      aria-label="Select mentor"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        setSelected([]);
        setStudentId(
          state.students.find((s) => s.mentorId === e.target.value)?.id || "",
        );
      }}
    >
      <option value="">Select mentor</option>
      {state.mentors.map((m) => (
        <option key={m.id} value={m.id}>
          {m.employeeCode||`Mentor ${m.id.slice(0,8)}`} – {m.name}
          {m.active ? "" : " (Inactive)"}
        </option>
      ))}
    </select>
  );
  const kpis = (items: [typeof Users, string, string | number, string][]) => (
    <div className="mm-kpis">
      {items.map(([Icon, label, value, tone]) => (
        <article className="mm-card mm-kpi" key={label}>
          <span className={`mm-icon ${tone}`}>
            <Icon size={25} />
          </span>
          <div>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        </article>
      ))}
    </div>
  );
  const exportMentors = () =>
    exportCsv("mentor-master.csv", [
      [
        "Mentor ID",
        "Name",
        "Email",
        "Department",
        "Capacity",
        "Assigned",
        "Status",
      ],
      ...filtered.map((m) => [
        m.id,
        m.name,
        m.email,
        m.department,
        m.capacity,
        m.assignedCount,
        m.active ? "Active" : "Inactive",
      ]),
    ]);
  if (error && !state.access.can_manage && !state.access.mentor_id)
    return (
      <section className="mentor-management">
        <div role="alert">{error}</div>
        <button onClick={() => void load()}>Retry</button>
      </section>
    );
  if (loading)
    return (
      <section className="mentor-management" role="status">
        Loading mentor management…
      </section>
    );
  const availableSections = state.access.can_manage
    ? sections
    : ["Mentor Dashboard", "Mentee Progress"];
  return (
    <section
      className="mentor-management"
      aria-busy={saving}
      onChange={() => {
        dirty.current = true;
      }}
    >
      <div className="mm-review">
        <ShieldCheck size={16} />
        <span>
          <b>
            {state.access.can_manage
              ? "Institute Mentor Management"
              : "Faculty · Mentor"}
          </b>{" "}
          · Shared institute records. Changes appear for the assigned mentor and
          student.
        </span>
        <button disabled={saving} onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {error && (
        <div className="mm-notice" role="alert">
          {error}
          <button onClick={() => void load()}>Retry</button>
        </div>
      )}
      {saving && <p role="status">Saving…</p>}
      <header className="mm-header">
        <div>
          <p className="mm-eyebrow">PLACEMENT MANAGEMENT / MENTOR MANAGEMENT</p>
          <h1>{tab}</h1>
          <p>{descriptions[sections.indexOf(tab)]}</p>
        </div>
        <div className="mm-actions">
          {tab === "Mentor Master" ? (
            <>
              <button
                onClick={async()=>{try{const blob=await collegeApi.file('mentors/template');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mentor-import-template.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){setError(collegeError(e))}}}
              >
                <Download size={16} /> Import Template
              </button>
              <label className="mm-import-button">
                <Upload size={16} /> Bulk Import (Excel / CSV)
                <input
                  type="file"
                  accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  aria-label="Bulk import mentors"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024)
                      return setNotice("Import file must be under 2 MB.");
                    if(mutating.current)return;mutating.current=true;setSaving(true);setError('');
                    try {
                      const result=await collegeApi.upload<{items:{id:string;email_queued:boolean}[]}>('mentors/import',file);
                      await load();const failed=result.items.filter(item=>!item.email_queued).length;
                      setNotice(`${result.items.length} mentors imported. ${result.items.length-failed} invitation emails queued.${failed?' Some invitations failed; use resend.':''}`);
                    } catch(error){setError(collegeError(error))} finally{mutating.current=false;setSaving(false)}
                  }}
                />
              </label>
              <button onClick={exportMentors}>
                <Download size={16} /> Export CSV
              </button>
              <button
                disabled={saving}
                className="mm-primary"
                onClick={() => {
                  setReadOnly(false);
                  setEditing(emptyMentor());
                  setFormTab(0);
                }}
              >
                <UserRoundPlus size={16} /> Add Mentor
              </button>
            </>
          ) : (
            <span className="mm-year">
              <CalendarDays size={16} /> Live institute records
            </span>
          )}
        </div>
      </header>
      <nav className="mm-tabs" aria-label="Mentor management sections">
        {availableSections.map((name, i) => (
          <button
            key={name}
            className={tab === name ? "selected" : ""}
            onClick={() => go(name)}
          >
            {i === 6 && <span className="mm-preview-dot" />}
            {name}
          </button>
        ))}
      </nav>
      {notice && (
        <div className="mm-notice" role="status">
          {notice}
          <button aria-label="Dismiss message" onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {tab === "Mentor Master" && (
        <>
          {kpis([
            [Users, "Total Mentors", state.mentors.length, "blue"],
            [
              Users,
              "Total Mentees",
              state.students.filter((s) => s.mentorId).length,
              "green",
            ],
            [
              GraduationCap,
              "Active Mentors",
              state.mentors.filter((m) => m.active).length,
              "purple",
            ],
            [
              Gauge,
              "Max. allowed per Mentor",
              Math.max(0, ...state.mentors.map((m) => m.capacity)),
              "orange",
            ],
          ])}
          <div className="mm-card">
            <div className="mm-filters">
              <label className="mm-search">
                <Search size={17} />
                <input
                  aria-label="Search mentors"
                  placeholder="Search by Mentor Name / ID / Email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label>
                Department
                <select value={dept} onChange={(e) => setDept(e.target.value)}>
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">All</option>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </label>
            </div>
            <div className="mm-table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      "S.No",
                      "Mentor ID",
                      "Mentor Name",
                      "Department",
                      "Max. Load",
                      "Assigned",
                      "Available",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, i) => {
                    const count = m.assignedCount;
                    return (
                      <tr key={m.id}>
                        <td>{i + 1}</td>
                        <td>
                          <b>{m.id.slice(0, 10)}</b>
                        </td>
                        <td>
                          <span className="mm-person">
                            <MentorProfilePhoto kind="staff" id={m.staffId} name={m.name}/>
                            <b>{m.name}</b>
                            <span className="mm-badge green">Mentor</span>
                          </span>
                        </td>
                        <td>{m.department}</td>
                        <td>{m.capacity}</td>
                        <td>{count}</td>
                        <td>{Math.max(0, m.capacity - count)}</td>
                        <td>
                          <span
                            className={`mm-badge ${m.active ? "green" : "gray"}`}
                          >
                            {m.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div className="mm-actions">
                            <button
                              className="mm-icon-button"
                              aria-label={`View ${m.name}`}
                              onClick={() => {
                                setReadOnly(true);
                                setEditing({ ...m });
                                setFormTab(0);
                              }}
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              className="mm-icon-button"
                              aria-label={`Edit ${m.name}`}
                              onClick={() => {
                                setReadOnly(false);
                                setEditing({ ...m });
                                setFormTab(0);
                              }}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="mm-icon-button"
                              aria-label={`Invitation status for ${m.name}`}
                              disabled={saving || !m.active}
                              title={`Resend Invitation · ${m.invitation}`}
                              onClick={() => void resend(m)}
                            >
                              <Mail size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filtered.length && (
                <p className="mm-empty">No mentors match your search.</p>
              )}
            </div>
            <footer className="mm-table-footer">
              Showing {filtered.length} of {state.mentors.length} mentors
              <span>Capacity is checked before every allocation.</span>
            </footer>
          </div>
        </>
      )}
      {tab === "Assign Mentee" && (
        <>
          <div className="mm-steps">
            {["Select Mentor", "Choose Students", "Review & Assign"].map(
              (s, i) => (
                <button
                  className={step >= i + 1 ? "current" : ""}
                  key={s}
                  onClick={() => {
                    if (i === 0 || mentor?.active) setStep(i + 1);
                  }}
                >
                  <span>
                    {step > i + 1 ? <CheckCircle2 size={19} /> : i + 1}
                  </span>
                  {s}
                </button>
              ),
            )}
          </div>
          <div className="mm-card">
            <div className="mm-mentor-picker"><label>Mentor{mentorSelect(mentorId,setMentorId)}</label></div>
            {mentor ? <div className="mm-assignment-summary">
              <div className="mm-selected-mentor"><MentorProfilePhoto kind="staff" id={mentor.staffId} name={mentor.name} large/><div><span className="mm-mentor-code">{mentor.employeeCode||`Mentor ${mentor.id.slice(0,8)}`}</span><h2>{mentor.name}</h2><p>{[mentor.department,mentor.designation].filter(Boolean).join(' · ')||'Faculty mentor'}</p>{mentor.email&&<a href={`mailto:${mentor.email}`}>{mentor.email}</a>}{mentor.phone&&<span className="mm-mentor-contact">{mentor.phone}</span>}{mentor.expertise&&<small>{mentor.expertise}</small>}<span className={`mm-badge ${mentor.active?'green':'gray'}`}>{mentor.active?'Active mentor':'Inactive mentor'}</span></div></div>
              <div className="mm-assignment-stats">{[[Users,'Assigned',mentor.assignedCount],[GraduationCap,'Maximum',mentor.capacity],[CheckCircle2,'Available',Math.max(0,mentor.capacity-mentor.assignedCount)]].map(([Icon,label,value])=>{const StatIcon=Icon as typeof Users;return <div key={String(label)}><StatIcon size={24} aria-hidden="true"/><div><small>{String(label)}</small><strong>{String(value)}<span> students</span></strong></div></div>})}</div>
            </div>:<p className="mm-empty">Choose a mentor to view their profile and allocation capacity.</p>}
            {step === 1 ? (
              <p className="mm-assignment-hint">Review the mentor’s profile and available capacity, then choose students to assign.</p>
            ) : step === 2 ? (
              <>
                <form className="mm-student-filters" aria-label="Filter mentees" onSubmit={event=>{event.preventDefault();setStudentFilters({...studentFilterDraft});setStudentPage(1)}}>
                  <div className="mm-student-filter-fields">
                    {([['batch','Batch'],['degree','Degree'],['department','Department'],['semester','Semester']] as const).map(([key,label])=><label key={key}>{label}<select aria-label={`Filter students by ${label.toLowerCase()}`} value={studentFilterDraft[key]} onChange={event=>setStudentFilterDraft(current=>({...current,[key]:event.target.value}))}><option value="">All {label==='Batch'?'batches':label==='Degree'?'degrees':label==='Department'?'departments':'semesters'}</option>{menteeFilterOptions(state.students,key).map(value=><option value={value} key={value}>{value}</option>)}</select></label>)}
                  </div>
                  <div className="mm-student-filter-actions"><label className="mm-search"><Search size={16}/><input aria-label="Search students" placeholder="Name, registration number or email" value={studentFilterDraft.query} onChange={event=>setStudentFilterDraft(current=>({...current,query:event.target.value}))}/></label><button type="submit" className="mm-primary"><Search size={15}/>Search Students</button><button type="button" onClick={resetStudentFilters}>Clear filters</button></div>
                </form>
                <div className="mm-student-results" aria-live="polite"><span><b>{students.length}</b> matching students · {selectableMentees(students).length} available to assign</span><span>{selected.length} selected{selectedOutsideFilters>0?` · ${selectedOutsideFilters} outside current filters`:''}{selected.length>0&&<button type="button" onClick={()=>setSelected([])}>Clear selection</button>}</span></div>
                <div className="mm-assignment-workspace"><div className="mm-assignment-roster"><div className="mm-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th><input type="checkbox" aria-label="Select all available students on this page" disabled={!selectablePage.length} checked={selectablePage.length>0&&selectablePage.every(student=>selected.includes(student.id))} ref={element=>{if(element)element.indeterminate=selectablePage.some(student=>selected.includes(student.id))&&!selectablePage.every(student=>selected.includes(student.id))}} onChange={()=>setSelected(current=>toggleMenteePage(current,visibleStudents))}/></th>
                        <th>S.No</th>
                        <th>Reg. No</th>
                        <th>Student Name</th>
                        <th>Batch</th>
                        <th>Degree</th>
                        <th>Dept.</th>
                        <th>Sem.</th>
                        <th>Allocation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleStudents.map((s,index) => (
                        <tr key={s.id}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Select ${s.name}`}
                              disabled={!!s.mentorId||s.student_status==='inactive'}
                              checked={selected.includes(s.id)}
                              onChange={() => toggle(s.id)}
                            />
                          </td>
                          <td>{(currentStudentPage-1)*20+index+1}</td>
                          <td>{s.rollNumber || s.id}</td>
                          <td>
                            <span className="mm-person"><MentorProfilePhoto kind="students" id={s.id} name={s.name}/><b>{s.name}</b></span>
                          </td>
                          <td>{s.batch}</td>
                          <td>{s.degree}</td>
                          <td>{s.department}</td>
                          <td>{s.semester}</td>
                          <td>
                            <span
                              className={`mm-badge ${s.mentorId ? "gray" : "green"}`}
                            >
                              {s.mentorId ? 'Assigned' : s.student_status==='inactive'?'Inactive':'Available'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!students.length&&<tr><td colSpan={9}><div className="mm-empty">No students match these filters. Try another selection or clear the filters.</div></td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="mm-student-pagination"><span>{students.length?`${(currentStudentPage-1)*20+1}–${Math.min(currentStudentPage*20,students.length)} of ${students.length}`:'0 students'}</span><div><button type="button" disabled={currentStudentPage===1} onClick={()=>setStudentPage(currentStudentPage-1)}>Previous</button><span>Page {currentStudentPage} of {studentPageCount}</span><button type="button" disabled={currentStudentPage===studentPageCount} onClick={()=>setStudentPage(currentStudentPage+1)}>Next</button></div></div>
                </div><aside className="mm-allocation-sidebar"><h2>Assignment Summary</h2>{[[CalendarDays,'Scheduled Sessions',null],[History,'Pending Assignments',selected.length],[Users,'Mentoring Attended',null],[GraduationCap,'After Assignment',(mentor?.assignedCount||0)+selected.length],[CheckCircle2,'Availabilities',Math.max(0,(mentor?.capacity||0)-(mentor?.assignedCount||0)-selected.length)]].map(([Icon,label,value])=>{const SummaryIcon=Icon as typeof Users;return <div className="mm-allocation-summary-row" key={String(label)}><SummaryIcon size={16} aria-hidden="true"/><span>{String(label)}</span><b>{value===null?'Not recorded':String(value)}</b></div>})}<p className="mm-muted">Session scheduling and mentoring attendance have no saved records yet.</p>{(mentor?.assignedCount||0)+selected.length>(mentor?.capacity||0)&&<p className="mm-bulk-error" role="alert">Selection exceeds this mentor’s capacity. Remove students before assigning.</p>}</aside></div>
              </>
            ) : (
              <div className="mm-empty">
                <h2>Review assignment</h2>
                <p>
                  {selected.length} students will be assigned to{" "}
                  <b>{mentor?.name}</b>.
                </p>
                {state.students
                  .filter((s) => selected.includes(s.id))
                  .map((s) => (
                    <p key={s.id}>
                      {s.rollNumber || s.id} · {s.name}
                    </p>
                  ))}
              </div>
            )}
            <footer className="mm-form-footer mm-assignment-footer"><div className="mm-assignment-secondary-actions"><button type="button" disabled={!mentor?.active||saving} onClick={()=>setBulkOpen(true)}><Upload size={15}/>Bulk Assignment (Excel)</button><button type="button" disabled={!mentor} onClick={()=>go('Reassignment History')}><History size={15}/>Reassign / Transfer</button></div>
              <span>{selected.length} students selected</span><button type="button" disabled={saving} onClick={()=>go('Mentor Master')}>Cancel</button>
              {step > 1 && (
                <button onClick={() => setStep(step - 1)}>
                  <ArrowLeft size={15} /> Back
                </button>
              )}
              <button
                className="mm-primary"
                disabled={saving||(step > 1 && !selected.length) || !mentor?.active||(step>1&&(mentor.assignedCount+selected.length>mentor.capacity))}
                onClick={() => (step < 3 ? setStep(step + 1) : allocate())}
              >
                {step === 3
                  ? "Assign Mentees"
                  : step === 1
                    ? "Choose Students"
                    : "Review & Assign"}
                <ArrowRight size={16} />
              </button>
            </footer>
          </div>
        </>
      )}
      {tab === "Reassignment History" && (
        <div className="mm-grid">
          <div className="mm-card">
            <h2>Reassign Mentee / Transfer</h2>
            <div className="mm-field-grid">
              <label>From Mentor{mentorSelect(mentorId, setMentorId)}</label>
              <label>
                To Mentor
                <select value={to} onChange={(e) => setTo(e.target.value)}>
                  <option value="">Select destination</option>
                  {state.mentors
                    .filter((m) => m.id !== mentorId && m.active)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <fieldset>
              <legend>Select Students *</legend>
              {assigned.map((s) => (
                <label className="mm-check" key={s.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                  {s.name} ({s.rollNumber || s.id})
                </label>
              ))}
              {!assigned.length && <p>No students assigned to this mentor.</p>}
            </fieldset>
            <label>
              Reason *
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </label>
            <footer className="mm-form-footer">
              <button onClick={() => setSelected([])}>Cancel</button>
              <button
                className="mm-primary"
                disabled={!selected.length || !to}
                onClick={() => allocate(true)}
              >
                Reassign
              </button>
            </footer>
          </div>
          <div className="mm-card">
            <h2>
              <History size={19} /> Transfer History
            </h2>
            {!state.transfers.length && (
              <p className="mm-empty">No reassignments recorded yet.</p>
            )}
            {state.transfers.map((t) => (
              <article className="mm-history" key={t.id}>
                <b>{t.student}</b>
                <p>
                  {t.from} → {t.to}
                </p>
                <small>
                  {t.reason} · {new Date(t.at).toLocaleString()}
                </small>
              </article>
            ))}
          </div>
        </div>
      )}
      {tab === "Roles & Permissions" && (
        <div className="mm-role-layout">
          <aside className="mm-card">
            <h2>Roles</h2>
            {roles.map((r) => (
              <button
                className={role === r ? "mm-role selected" : "mm-role"}
                key={r}
                onClick={() => {
                  setRole(r);
                  setRoleDraft(
                    r === "Mentor"
                      ? state.permissions.Mentor || []
                      : permissions,
                  );
                }}
              >
                <Users size={16} />
                {r}
              </button>
            ))}
          </aside>
          <div className="mm-card">
            <h2>Permissions – {role} Role</h2>
            <p className="mm-muted">
              Mentor permissions are enforced by the server. Institute placement
              officers manage faculty and allocations.
            </p>
            <div className="mm-permissions">
              {permissions.map((p) => (
                <label className="mm-check" key={p}>
                  <input
                    type="checkbox"
                    disabled={role !== "Mentor"}
                    checked={roleDraft.includes(p)}
                    onChange={() =>
                      setRoleDraft((v) =>
                        v.includes(p) ? v.filter((x) => x !== p) : [...v, p],
                      )
                    }
                  />
                  {p}
                </label>
              ))}
            </div>
            <footer className="mm-form-footer">
              <button
                disabled={saving || role !== "Mentor"}
                className="mm-primary"
                onClick={() =>
                  commit(
                    {
                      ...state,
                      permissions: { ...state.permissions, [role]: roleDraft },
                    },
                    "Role configuration updated",
                    role,
                  )
                }
              >
                Save Changes
              </button>
            </footer>
          </div>
        </div>
      )}
      {tab === "Audit Logs" && (
        <div className="mm-card">
          <div className="mm-filters">
            <label className="mm-search">
              <Search size={16} />
              <input
                aria-label="Search audit logs"
                placeholder="Search actions and details"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <button
              className="mm-primary"
              onClick={() =>
                exportCsv("mentor-audit.csv", [
                  ["Date & Time", "Action", "Details"],
                  ...state.logs.map((l) => [l.at, l.action, l.detail]),
                ])
              }
            >
              <Download size={16} /> Export
            </button>
          </div>
          <div className="mm-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {state.logs
                  .filter((l) =>
                    `${l.action} ${l.detail}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((l) => (
                    <tr key={l.id}>
                      <td>{new Date(l.at).toLocaleString()}</td>
                      <td>{l.actor}</td>
                      <td>
                        <b>{l.action}</b>
                      </td>
                      <td>{l.detail}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!state.logs.length && (
              <p className="mm-empty">Your saved changes will appear here.</p>
            )}
          </div>
        </div>
      )}
      {tab === "Mentor Reports" && (
        <>
          <nav className="mm-subtabs">
            {[
              "Overview",
              "Mentor Wise",
              "Department Wise",
              "Engagement",
              "Placement",
            ].map((t) => (
              <button
                className={reportTab === t ? "selected" : ""}
                key={t}
                onClick={() => setReportTab(t)}
              >
                {t}
              </button>
            ))}
          </nav>
          {kpis([
            [
              Users,
              "Active Mentors",
              state.mentors.filter((m) => m.active).length,
              "green",
            ],
            [
              GraduationCap,
              "Total Mentees",
              state.students.filter((s) => s.mentorId).length,
              "blue",
            ],
            [
              Gauge,
              "Avg. Readiness",
              pct(avg(state.students.filter((s) => s.mentorId))),
              "orange",
            ],
            [
              CheckCircle2,
              "Milestones completed",
              state.students.reduce((n, s) => n + s.milestones + (s.aiTasksCompleted||0), 0),
              "purple",
            ],
          ])}
          <div className="mm-grid">
            <div className="mm-card">
              <h2>Mentee Distribution by Department</h2>
              <div className="mm-distribution">
                <div className="mm-donut" style={{background: ringBackground(departments.map(d=>state.students.filter(s=>s.mentorId&&s.department===d).length))}}>
                  <b>
                    {state.students.filter((s) => s.mentorId).length}
                    <small>Mentees</small>
                  </b>
                </div>
                <div>
                  {departments.filter(d=>state.students.some(s=>s.mentorId&&s.department===d)).map((d, i) => (
                    <p key={d}>
                      <i
                        style={{
                          background: [
                            "#6675ff",
                            "#12c8ab",
                            "#009bff",
                            "#ffbd24",
                            "#aa4bff",
                          ][i % 5],
                        }}
                      />
                      {d||"Department not recorded"}
                      <b>
                        {
                          state.students.filter(
                            (s) => s.mentorId && s.department === d,
                          ).length
                        }
                      </b>
                    </p>
                  ))}
                </div>
              </div>
            </div>
            <div className="mm-card">
              <div className="mm-heading">
                <h2>
                  {reportTab === "Department Wise"
                    ? "Department Readiness"
                    : reportTab === "Engagement"
                      ? "Mentoring Engagement"
                      : reportTab === "Placement"
                        ? "Placement Status"
                        : "Mentors by Mentee Readiness"}
                </h2>
                <button
                  onClick={() =>
                    exportCsv("mentor-reports.csv", [
                      ["Mentor", "Mentees", "Readiness"],
                      ...state.mentors.map((m) => [
                        m.name,
                        state.students.filter((s) => s.mentorId === m.id)
                          .length,
                        pct(
                          avg(
                            state.students.filter((s) => s.mentorId === m.id),
                          ),
                        ),
                      ]),
                    ])
                  }
                >
                  <Download size={15} /> Export
                </button>
              </div>
              {reportTab === "Department Wise"
                ? departments.map((d) => (
                    <div className="mm-report-row" key={d}>
                      <b>{d}</b>
                      <span>
                        {pct(
                          avg(
                            state.students.filter(
                              (s) => s.department === d && s.mentorId,
                            ),
                          ),
                        )}
                      </span>
                    </div>
                  ))
                : reportTab === "Placement"
                  ? ["Placed", "Shortlisted", "On hold", "Not shortlisted", "Pending decision", "Not recorded"].map((p) => (
                      <div className="mm-report-row" key={p}>
                        <b>{p}</b>
                        <span>
                          {
                            state.students.filter((s) => s.placement === p)
                              .length
                          }
                        </span>
                      </div>
                    ))
                  : state.mentors.map((m) => {
                      const own = state.students.filter(
                        (s) => s.mentorId === m.id,
                      );
                      return (
                        <div className="mm-report-row" key={m.id}>
                          <b>{m.name}</b>
                          <span>{own.length} mentees</span>
                          {reportTab === "Engagement" ? (
                            <span>
                              {own.reduce((a, s) => a + s.milestones + (s.aiTasksCompleted||0), 0)}{" "}
                              milestones
                            </span>
                          ) : (
                            <>
                              <progress max="100" value={avg(own) || 0} />
                              <b>{pct(avg(own))}</b>
                            </>
                          )}
                        </div>
                      );
                    })}
            </div>
          </div>
        </>
      )}
      {(tab === "Mentor Dashboard" || tab === "Mentee Progress") && (
        <>
          <div className="mm-context">
            <label>
              Mentor
              {mentorSelect(mentorId, (v) => {
                setMentorId(v);
                setStudentId(
                  state.students.find((s) => s.mentorId === v)?.id || "",
                );
              })}
            </label>
            <span>Assigned mentees and their released assessment records.</span>
          </div>
          {tab === "Mentor Dashboard" ? (
            <>
              {kpis([
                [Users, "My Mentees", assigned.length, "blue"],
                [
                  GraduationCap,
                  "Milestones Completed",
                  assigned.reduce((n, s) => n + s.milestones + (s.aiTasksCompleted||0), 0),
                  "green",
                ],
                [Gauge, "Career Readiness", pct(avg(assigned)), "purple"],
                [
                  CalendarDays,
                  "Plans Created",
                  assigned.reduce((total,s) => total + (s.plan?1:0) + (s.aiPlans||0),0),
                  "orange",
                ],
              ])}
              <div className="mm-grid">
                <div className="mm-card">
                  <h2>Mentee Readiness</h2>
                  <div className="mm-distribution">
                    <div className="mm-readiness" style={{background: ringBackground([assigned.filter(s=>s.readiness!==null&&s.readiness>=80).length,assigned.filter(s=>s.readiness!==null&&s.readiness>=60&&s.readiness<80).length,assigned.filter(s=>s.readiness!==null&&s.readiness<60).length,assigned.filter(s=>s.readiness===null).length],["#10b981","#3b82f6","#f59e0b","#dfe6f5"])}}>
                      <b>
                        {pct(avg(assigned))}
                        <small>Overall</small>
                      </b>
                    </div>
                    <div>
                      {[
                        [
                          "Ready (≥80%)",
                          assigned.filter((s) => (s.readiness || 0) >= 80)
                            .length,
                        ],
                        [
                          "In Progress (60–79%)",
                          assigned.filter(
                            (s) =>
                              s.readiness !== null &&
                              s.readiness >= 60 &&
                              s.readiness < 80,
                          ).length,
                        ],
                        [
                          "Needs Support (<60%)",
                          assigned.filter(
                            (s) => s.readiness !== null && s.readiness < 60,
                          ).length,
                        ],
                        [
                          "Not assessed",
                          assigned.filter((s) => s.readiness === null).length,
                        ],
                      ].map(([l, n]) => (
                        <p key={l}>
                          <span>{l}</span>
                          <b>{n}</b>
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mm-card">
                  <h2>Upcoming Mentor Actions</h2>
                  {[
                    ["Review mentee progress", "Mentee Progress"],
                    ["Provide mentoring for students", "Mentee Progress"],
                    ["Create improvement plans", "Mentee Progress"],
                    ...(state.access.can_manage
                      ? [["Review allocation", "Assign Mentee"]]
                      : []),
                  ].map(([l, t]) => (
                    <button
                      className="mm-action-row"
                      key={l}
                      onClick={() => {
                        go(t);
                        setStudentId(assigned[0]?.id || "");
                      }}
                    >
                      <span>
                        <CalendarDays size={18} />
                        {l}
                      </span>
                      <ArrowRight size={17} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="mm-card">
                <h2>My Mentees</h2>
                {assigned.map((s) => (
                  <button
                    className="mm-action-row"
                    key={s.id}
                    onClick={() => {
                      setStudentId(s.id);
                      go("Mentee Progress");
                    }}
                  >
                    <span className="mm-person"><MentorProfilePhoto kind="students" id={s.id} name={s.name}/>{s.name} · {s.rollNumber || s.id}</span>
                    <span>
                      {pct(s.readiness)} <ArrowRight size={15} />
                    </span>
                  </button>
                ))}
                {!assigned.length && (
                  <p className="mm-empty">No mentees assigned.</p>
                )}
              </div>
            </>
          ) : (
            <>
              <label className="mm-student-select">
                Mentee
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                >
                  <option value="">Select mentee</option>
                  {assigned.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.rollNumber || s.id}
                    </option>
                  ))}
                </select>
              </label>
              {student && student.mentorId === mentorId ? (
                <>
                  <nav className="mm-subtabs">
                    {[
                      "Overall Status",
                      "Milestones",
                      "Competency",
                      "Career Plan",
                      "Coaching",
                      "Placement",
                    ].map((t) => (
                      <button
                        key={t}
                        className={progressTab === t ? "selected" : ""}
                        onClick={() => setProgressTab(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </nav>
                  <div className="mm-student-banner">
                    <MentorProfilePhoto kind="students" id={student.id} name={student.name} large/>
                    <div>
                      <h2>{student.name}</h2>
                      <p>
                        {student.rollNumber || student.id} | {student.degree} –{" "}
                        {student.department}
                      </p>
                      <b>Career Readiness · {pct(student.readiness)}</b>
                    </div>
                    {[
                      ["Attendance", pct(student.attendance)],
                      ["Competency", pct(student.competency)],
                      ["AI Learning Progress", pct(student.aiProgress??null)],
                      ["Placement Status", student.placement],
                    ].map(([l, v]) => (
                      <div className="mm-mini-stat" key={l}>
                        <small>{l}</small>
                        <strong>{v}</strong>
                      </div>
                    ))}
                  </div>
                  <MentorProgressPanels key={student.id} student={student} tab={progressTab}/>
                  {["Career Plan","Coaching","Milestones"].includes(progressTab) && <div className="mm-grid mm-mentor-editor">
                    <form
                      className="mm-card"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = new FormData(e.currentTarget);
                        commit(
                          {
                            ...state,
                            students: state.students.map((s) =>
                              s.id === student.id
                                ? {
                                    ...s,
                                    notes: String(form.get("notes")),
                                    plan: String(form.get("plan")),
                                    milestoneItems: JSON.parse(
                                      String(form.get("milestones") || "[]"),
                                    ),
                                  }
                                : s,
                            ),
                          },
                          "Coaching record updated",
                          student.name,
                        );
                      }}
                      key={student.id + progressTab + student.coachingVersion}
                    >
                      <h2>
                        {progressTab === "Coaching" ? "Mentor Coaching Notes" : progressTab === "Milestones" ? "Mentor Milestones" : "Mentor – Career Plan"}
                      </h2>
                      <p className="mm-muted">
                        Mentor-authored plan and feedback, shared with the
                        student.
                      </p>
                      {progressTab === "Career Plan" ? <label>Improvement plan<textarea name="plan" defaultValue={student.plan} placeholder="Add a goal, activity and target date…" rows={5}/></label> : <input type="hidden" name="plan" value={student.plan}/>}
                      {progressTab === "Coaching" ? <label>Feedback visible to student<textarea name="notes" defaultValue={student.notes} placeholder="Record guidance and follow-up actions…" rows={5}/></label> : <input type="hidden" name="notes" value={student.notes}/>}
                      {progressTab === "Milestones" ? <MentorMilestones items={student.milestoneItems}/> : <input type="hidden" name="milestones" value={JSON.stringify(student.milestoneItems)}/>}
                      <footer className="mm-form-footer">
                        <button disabled={saving} className="mm-primary">
                          Save Coaching Record
                        </button>
                      </footer>
                    </form>
                  </div>}
                </>
              ) : (
                <div className="mm-card mm-empty">
                  Select an assigned mentee to review progress.
                </div>
              )}
            </>
          )}
        </>
      )}
      {bulkOpen&&<MenteeBulkDialog onClose={()=>setBulkOpen(false)} onPreview={ids=>{setSelected(ids);setStep(3);setBulkOpen(false);setNotice(`${ids.length} students selected from Excel. Review before assigning.`)}}/>}
      {editing && (
        <div className="mm-modal-backdrop">
          <section
            className="mm-modal"
            role="dialog"
            aria-modal="true"
            aria-label={readOnly ? "Mentor details" : "Add / Edit Mentor"}
          >
            <header className="mm-heading">
              <h2>{readOnly ? "Mentor Details" : "Add / Edit Mentor"}</h2>
              <button
                aria-label="Close mentor form"
                onClick={() => setEditing(null)}
              >
                <X size={19} />
              </button>
            </header>
            <nav className="mm-subtabs">
              {[
                "Mentor Details",
                "Expertise & Areas",
                "Allocation & Preference",
              ].map((t, i) => (
                <button
                  type="button"
                  key={t}
                  className={formTab === i ? "selected" : ""}
                  onClick={() => setFormTab(i)}
                >
                  {t}
                </button>
              ))}
            </nav>
            <form onSubmit={saveMentor}>
              <fieldset disabled={readOnly}>
                <div className="mm-edit-layout">
                  <div className="mm-photo">
                    <MentorPhotoEditor key={editing.id||editing.staffId} mentorId={editing.id} staffId={editing.staffId} name={editing.name} readOnly={readOnly}/>
                  </div>
                  <div className="mm-field-grid">
                    {formTab === 0 ? (
                      <>
                        <label>
                          Faculty *
                          <select
                            required
                            disabled={!!editing.id}
                            aria-label="Existing faculty"
                            value={editing.staffId}
                            onChange={(e) => {
                              const f = state.faculty.find(
                                (f) => f.id === e.target.value,
                              );
                              if (f)
                                setEditing({
                                  ...editing,
                                  staffId: f.id,
                                  name: f.name,
                                  email: f.email,
                                });
                            }}
                          >
                            <option value="">Select existing faculty</option>
                            {state.faculty
                              .filter(
                                (f) => !f.mentor_id || f.id === editing.staffId,
                              )
                              .map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name} · {f.employee_code || f.email}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Mentor Name *
                          <input
                            disabled
                            required
                            value={editing.name}
                            onChange={(e) =>
                              setEditing({ ...editing, name: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Department *
                          <input
                            required
                            value={editing.department}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                department: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Designation *
                          <input
                            required
                            value={editing.designation}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                designation: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Email ID *
                          <input
                            disabled
                            required
                            type="email"
                            value={editing.email}
                            onChange={(e) =>
                              setEditing({ ...editing, email: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Mobile Number
                          <input
                            type="tel"
                            value={editing.phone}
                            onChange={(e) =>
                              setEditing({ ...editing, phone: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Maximum Mentee Allocation *
                          <input
                            type="number"
                            required
                            min="1"
                            max="1000"
                            value={editing.capacity}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                capacity: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Mentor Status
                          <span className="mm-check">
                            <input
                              type="checkbox"
                              checked={editing.active}
                              onChange={(e) =>
                                setEditing({
                                  ...editing,
                                  active: e.target.checked,
                                })
                              }
                            />
                            {editing.active ? "Active" : "Inactive"}
                          </span>
                        </label>
                      </>
                    ) : formTab === 1 ? (
                      <>
                        <label className="mm-full">
                          Expertise & Areas
                          <input
                            value={editing.expertise}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                expertise: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="mm-full">
                          Mentor Bio / Expertise
                          <textarea
                            rows={5}
                            maxLength={500}
                            value={editing.bio}
                            onChange={(e) =>
                              setEditing({ ...editing, bio: e.target.value })
                            }
                          />
                          <small>{editing.bio.length} / 500</small>
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="mm-full">
                          Allocation Preferences
                          <textarea
                            rows={4}
                            value={editing.preference}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                preference: e.target.value,
                              })
                            }
                            placeholder="Preferred departments, batches and mentoring areas"
                          />
                        </label>
                        <p className="mm-full mm-invite">
                          <Mail size={20} />
                          <span>
                            An invitation is sent to{" "}
                            <b>{editing.email || "the mentor’s email"}</b> when
                            mentor access is assigned. Existing faculty keep
                            their current login; invited faculty receive a
                            password setup link.
                          </span>
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </fieldset>
              <footer className="mm-form-footer">
                <button type="button" onClick={() => setEditing(null)}>
                  {readOnly ? "Close" : "Cancel"}
                </button>
                {!readOnly && (
                  <button
                    disabled={saving || !editing.staffId}
                    className="mm-primary"
                  >
                    Save Mentor
                  </button>
                )}
              </footer>
            </form>
          </section>
        </div>
      )}
      <footer className="mm-footer">
        <ShieldCheck size={16} /> Create & Manage Mentors <span>•</span>{" "}
        Allocate & Assign <span>•</span> Track Progress <span>•</span> Reassign
        & Audit
      </footer>
    </section>
  );
}

function MentorMilestones({
  items,
}: {
  items: import("./mentor-model").Milestone[];
}) {
  const [draft, setDraft] = useState(items);
  return (
    <fieldset>
      <legend>Milestones</legend>
      <input type="hidden" name="milestones" value={JSON.stringify(draft)} />
      {draft.map((m, i) => (
        <div key={m.id} className="mm-milestone-edit">
          <input
            type="checkbox"
            aria-label={`Complete milestone ${i + 1}`}
            checked={m.done}
            onChange={(e) =>
              setDraft((v) =>
                v.map((x) =>
                  x.id === m.id ? { ...x, done: e.target.checked } : x,
                ),
              )
            }
          />
          <input
            aria-label={`Milestone ${i + 1}`}
            required
            maxLength={200}
            value={m.title}
            onChange={(e) =>
              setDraft((v) =>
                v.map((x) =>
                  x.id === m.id ? { ...x, title: e.target.value } : x,
                ),
              )
            }
          />
          <input
            type="date"
            aria-label={`Milestone ${i + 1} due date`}
            value={m.due || ""}
            onChange={(e) =>
              setDraft((v) =>
                v.map((x) =>
                  x.id === m.id ? { ...x, due: e.target.value || null } : x,
                ),
              )
            }
          />
          <button
            type="button"
            aria-label={`Remove milestone ${i + 1}`}
            onClick={() => setDraft((v) => v.filter((x) => x.id !== m.id))}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setDraft((v) => [
            ...v,
            { id: crypto.randomUUID(), title: "", due: null, done: false },
          ])
        }
      >
        Add Milestone
      </button>
    </fieldset>
  );
}

function ringBackground(counts:number[],colors=["#6675ff","#12c8ab","#009bff","#ffbd24","#aa4bff"]){const total=counts.reduce((a,b)=>a+b,0);if(!total)return "#dfe6f5";let cursor=0;return `conic-gradient(${counts.map((n,i)=>{const start=cursor;cursor+=n/total*100;return `${colors[i%colors.length]} ${start}% ${cursor}%`}).join(',')})`;}
