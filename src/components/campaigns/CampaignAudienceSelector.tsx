import { useState, useEffect, useMemo } from "react";
import {
  Users,
  GraduationCap,
  FileSpreadsheet,
  Search,
  CheckSquare,
  Square,
  Filter,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  Upload,
} from "lucide-react";
import leadsApi from "@/api/leads";
import { collegeApi, type CollegeStudent } from "@/api/collegeApi";
import type { Lead } from "@/types/lead.types";

export type SelectedContact = {
  name: string;
  destination: string; // Phone for WhatsApp, Email for Email
  email?: string;
  phone?: string;
  source: "lead" | "student" | "sheet";
  extra?: Record<string, string>;
};

interface CampaignAudienceSelectorProps {
  channel: "whatsapp" | "email";
  onAddContacts: (contacts: SelectedContact[]) => Promise<void>;
  onUploadFile?: (file: File) => Promise<void>;
  busy?: boolean;
}

export default function CampaignAudienceSelector({
  channel,
  onAddContacts,
  onUploadFile,
  busy = false,
}: CampaignAudienceSelectorProps) {
  const [activeTab, setActiveTab] = useState<"leads" | "students" | "sheet">("leads");

  // LEADS STATE
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>("all");
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  // STUDENTS STATE
  const [students, setStudents] = useState<CollegeStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedProgram, setSelectedProgram] = useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedGradYear, setSelectedGradYear] = useState<string>("all");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // EXCEL / SHEET STATE
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  // FEEDBACK STATE
  const [actionNotice, setActionNotice] = useState("");

  // LOAD LEADS
  useEffect(() => {
    let active = true;
    const fetchLeads = async () => {
      setLoadingLeads(true);
      try {
        const res = await leadsApi.getLeads({ limit: 150 });
        if (active) {
          setLeads(res.data || []);
        }
      } catch (err) {
        console.error("Failed to load leads", err);
      } finally {
        if (active) setLoadingLeads(false);
      }
    };
    fetchLeads();
    return () => {
      active = false;
    };
  }, []);

  // LOAD REGISTERED COLLEGE STUDENTS
  useEffect(() => {
    let active = true;
    const fetchStudents = async () => {
      setLoadingStudents(true);
      try {
        // The student service caps a page at 100 (limit=500 was a 422, so the
        // College Students list stayed empty). Page through instead, which also
        // removes the old 500-student ceiling for a whole-college campaign.
        const PAGE = 100, MAX = 5000;
        const list: CollegeStudent[] = [];
        for (let offset = 0; offset < MAX; offset += PAGE) {
          const res = await collegeApi.get<{ items?: CollegeStudent[]; candidates?: CollegeStudent[]; total?: number }>(
            `students?limit=${PAGE}&offset=${offset}`
          );
          const page = res.candidates || res.items || [];
          list.push(...page);
          if (page.length < PAGE || (res.total != null && list.length >= res.total)) break;
        }
        if (active) setStudents(list);
      } catch (err) {
        console.error("Failed to load college students", err);
      } finally {
        if (active) setLoadingStudents(false);
      }
    };
    fetchStudents();
    return () => {
      active = false;
    };
  }, []);

  // EXTRACT UNIQUE PROGRAMS, DEPARTMENTS, GRADUATION YEARS
  const { programs, departments, gradYears } = useMemo(() => {
    const progs = new Set<string>();
    const depts = new Set<string>();
    const years = new Set<string>();

    students.forEach((s) => {
      if (s.program) progs.add(s.program);
      if (s.department_code) depts.add(s.department_code);
      if (s.graduation_year) years.add(String(s.graduation_year));
    });

    return {
      programs: Array.from(progs).sort(),
      departments: Array.from(depts).sort(),
      gradYears: Array.from(years).sort(),
    };
  }, [students]);

  // FILTERED LEADS
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Must have valid contact information for target channel
      const dest = channel === "whatsapp" ? (lead.phone || lead.mobile) : lead.email;
      if (!dest || !dest.trim()) return false;

      if (leadStatusFilter !== "all" && lead.status !== leadStatusFilter) {
        return false;
      }
      if (leadSearch.trim()) {
        const query = leadSearch.toLowerCase();
        const matchesName = lead.name?.toLowerCase().includes(query);
        const matchesEmail = lead.email?.toLowerCase().includes(query);
        const matchesPhone = (lead.phone || lead.mobile)?.toLowerCase().includes(query);
        if (!matchesName && !matchesEmail && !matchesPhone) return false;
      }
      return true;
    });
  }, [leads, leadStatusFilter, leadSearch, channel]);

  // FILTERED STUDENTS
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Must have valid contact information for target channel
      const dest = channel === "whatsapp" ? s.phone : s.email;
      if (!dest || !dest.trim()) return false;

      if (selectedProgram !== "all" && s.program !== selectedProgram) {
        return false;
      }
      if (selectedDepartment !== "all" && s.department_code !== selectedDepartment) {
        return false;
      }
      if (selectedGradYear !== "all" && String(s.graduation_year) !== selectedGradYear) {
        return false;
      }
      if (studentSearch.trim()) {
        const query = studentSearch.toLowerCase();
        const matchesName = s.full_name?.toLowerCase().includes(query);
        const matchesRoll = s.roll_number?.toLowerCase().includes(query);
        const matchesPhone = s.phone?.toLowerCase().includes(query);
        const matchesEmail = s.email?.toLowerCase().includes(query);
        if (!matchesName && !matchesRoll && !matchesPhone && !matchesEmail) return false;
      }
      return true;
    });
  }, [students, selectedProgram, selectedDepartment, selectedGradYear, studentSearch, channel]);

  // TOGGLE LEAD
  const toggleLead = (id: string) => {
    const next = new Set(selectedLeadIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeadIds(next);
  };

  // TOGGLE ALL FILTERED LEADS
  const toggleAllLeads = () => {
    const allFilteredIds = filteredLeads.map((l) => l.conversation_id);
    const allSelected = allFilteredIds.every((id) => selectedLeadIds.has(id));
    const next = new Set(selectedLeadIds);
    if (allSelected) {
      allFilteredIds.forEach((id) => next.delete(id));
    } else {
      allFilteredIds.forEach((id) => next.add(id));
    }
    setSelectedLeadIds(next);
  };

  // TOGGLE STUDENT
  const toggleStudent = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudentIds(next);
  };

  // TOGGLE ALL FILTERED STUDENTS
  const toggleAllStudents = () => {
    const allFilteredIds = filteredStudents.map((s) => s.id);
    const allSelected = allFilteredIds.every((id) => selectedStudentIds.has(id));
    const next = new Set(selectedStudentIds);
    if (allSelected) {
      allFilteredIds.forEach((id) => next.delete(id));
    } else {
      allFilteredIds.forEach((id) => next.add(id));
    }
    setSelectedStudentIds(next);
  };

  // SUBMIT LEADS
  const handleAddSelectedLeads = async () => {
    const selected = leads.filter((l) => selectedLeadIds.has(l.conversation_id));
    const payload: SelectedContact[] = selected
      .map((l) => {
        const dest = channel === "whatsapp" ? (l.phone || l.mobile || "") : (l.email || "");
        return {
          name: l.name || "Lead",
          destination: dest,
          email: l.email,
          phone: l.phone || l.mobile,
          source: "lead" as const,
          extra: {
            lead_id: l.conversation_id,
            status: l.status || "",
            company: l.business_description || "",
            email: l.email || "",
            phone: l.phone || l.mobile || "",
          },
        };
      })
      .filter((c) => c.destination);

    if (!payload.length) return;
    try {
      await onAddContacts(payload);
      setActionNotice(`Successfully added ${payload.length} lead(s) to audience.`);
      setSelectedLeadIds(new Set());
      setTimeout(() => setActionNotice(""), 4000);
    } catch (err: any) {
      setActionNotice(err.message || "Failed to add leads.");
    }
  };

  // SUBMIT STUDENTS
  const handleAddSelectedStudents = async () => {
    const selected = students.filter((s) => selectedStudentIds.has(s.id));
    const payload: SelectedContact[] = selected
      .map((s) => {
        const dest = channel === "whatsapp" ? (s.phone || "") : (s.email || "");
        return {
          name: s.full_name || "Student",
          destination: dest,
          email: s.email,
          phone: s.phone,
          source: "student" as const,
          extra: {
            roll_number: s.roll_number || "",
            program: s.program || "",
            department: s.department_code || "",
            graduation_year: String(s.graduation_year || ""),
            batch: s.batch_label || "",
            email: s.email || "",
            phone: s.phone || "",
          },
        };
      })
      .filter((c) => c.destination);

    if (!payload.length) return;
    try {
      await onAddContacts(payload);
      setActionNotice(`Successfully added ${payload.length} student(s) to audience.`);
      setSelectedStudentIds(new Set());
      setTimeout(() => setActionNotice(""), 4000);
    } catch (err: any) {
      setActionNotice(err.message || "Failed to add students.");
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-50 pb-4 dark:border-slate-800">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Select Campaign Audience
          </h3>
          <p className="text-xs text-slate-500">
            Choose recipient source: Lead contacts, registered college students (by branch/class), or upload an Excel sheet.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-violet-50 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("leads")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "leads"
                ? "bg-white text-indigo-700 shadow-sm dark:bg-indigo-700 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
            }`}
          >
            <Users size={14} />
            Lead People
            {leads.length > 0 && (
              <span className="ml-1 rounded-full bg-violet-100 px-1.5 py-0.2 text-[10px] text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                {leads.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("students")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "students"
                ? "bg-white text-indigo-700 shadow-sm dark:bg-indigo-700 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
            }`}
          >
            <GraduationCap size={14} />
            College Students
            {students.length > 0 && (
              <span className="ml-1 rounded-full bg-violet-100 px-1.5 py-0.2 text-[10px] text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                {students.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sheet")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "sheet"
                ? "bg-white text-indigo-700 shadow-sm dark:bg-indigo-700 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
            }`}
          >
            <FileSpreadsheet size={14} />
            Upload Excel / CSV
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 size={16} />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* TAB 1: LEAD USERS */}
      {activeTab === "leads" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Filter Status:</span>
              {["all", "Qualified", "Follow Up", "Unqualified"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setLeadStatusFilter(st)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                    leadStatusFilter === st
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {st === "all" ? "All Leads" : st}
                </button>
              ))}
            </div>

            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search leads by name, phone, email..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {filteredLeads.length} lead{filteredLeads.length === 1 ? "" : "s"} with valid{" "}
              {channel === "whatsapp" ? "phone number" : "email address"}
            </span>
            <button
              type="button"
              onClick={toggleAllLeads}
              className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {filteredLeads.length > 0 &&
              filteredLeads.every((l) => selectedLeadIds.has(l.conversation_id)) ? (
                <>
                  <CheckSquare size={14} /> Deselect All
                </>
              ) : (
                <>
                  <Square size={14} /> Select All Filtered ({filteredLeads.length})
                </>
              )}
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800">
            {loadingLeads ? (
              <div className="flex items-center justify-center py-10 text-xs text-slate-500">
                <Loader2 size={16} className="mr-2 animate-spin text-indigo-600" />
                Loading leads...
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No matching leads found.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 font-medium text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={
                          filteredLeads.length > 0 &&
                          filteredLeads.every((l) => selectedLeadIds.has(l.conversation_id))
                        }
                        onChange={toggleAllLeads}
                        className="rounded text-indigo-600"
                      />
                    </th>
                    <th className="px-3 py-2.5">Lead Name</th>
                    <th className="px-3 py-2.5">{channel === "whatsapp" ? "Phone" : "Email"}</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredLeads.map((lead) => {
                    const isSelected = selectedLeadIds.has(lead.conversation_id);
                    const contactVal =
                      channel === "whatsapp" ? (lead.phone || lead.mobile) : lead.email;
                    return (
                      <tr
                        key={lead.conversation_id}
                        onClick={() => toggleLead(lead.conversation_id)}
                        className={`cursor-pointer transition ${
                          isSelected
                            ? "bg-indigo-50/70 dark:bg-indigo-950/30"
                            : "hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleLead(lead.conversation_id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded text-indigo-600"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                          {lead.name || "(Unnamed lead)"}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">
                          {contactVal}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              lead.status === "Qualified"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : lead.status === "Follow Up"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {lead.status || "Lead"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              {selectedLeadIds.size} lead(s) selected
            </span>
            <button
              type="button"
              disabled={busy || selectedLeadIds.size === 0}
              onClick={handleAddSelectedLeads}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
              Add {selectedLeadIds.size} Lead(s) to Audience
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: COLLEGE STUDENTS (DEGREE, BRANCH, CLASS/PERSON SELECTOR) */}
      {activeTab === "students" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {/* DEGREE / PROGRAM SELECTOR */}
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Degree / Program
              </label>
              <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="all">All Degrees ({programs.length})</option>
                {programs.map((prog) => (
                  <option key={prog} value={prog}>
                    {prog}
                  </option>
                ))}
              </select>
            </div>

            {/* BRANCH / DEPARTMENT SELECTOR */}
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Branch / Department
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="all">All Branches ({departments.length})</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* CLASS / GRADUATION YEAR SELECTOR */}
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Class / Year
              </label>
              <select
                value={selectedGradYear}
                onChange={(e) => setSelectedGradYear(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="all">All Classes ({gradYears.length})</option>
                {gradYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Class of {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* SEARCH SPECIFIC PERSON */}
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Specific Person / Search
              </label>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Name, roll no, phone..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-7 pr-2.5 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {filteredStudents.length} student{filteredStudents.length === 1 ? "" : "s"} with valid{" "}
              {channel === "whatsapp" ? "phone number" : "email address"}
            </span>
            <button
              type="button"
              onClick={toggleAllStudents}
              className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {filteredStudents.length > 0 &&
              filteredStudents.every((s) => selectedStudentIds.has(s.id)) ? (
                <>
                  <CheckSquare size={14} /> Deselect All
                </>
              ) : (
                <>
                  <Square size={14} /> Select All Filtered ({filteredStudents.length})
                </>
              )}
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800">
            {loadingStudents ? (
              <div className="flex items-center justify-center py-10 text-xs text-slate-500">
                <Loader2 size={16} className="mr-2 animate-spin text-indigo-600" />
                Loading registered students...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No matching students found for the selected degree, branch, or year.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 font-medium text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={
                          filteredStudents.length > 0 &&
                          filteredStudents.every((s) => selectedStudentIds.has(s.id))
                        }
                        onChange={toggleAllStudents}
                        className="rounded text-indigo-600"
                      />
                    </th>
                    <th className="px-3 py-2.5">Student Name</th>
                    <th className="px-3 py-2.5">Roll No</th>
                    <th className="px-3 py-2.5">Degree & Branch</th>
                    <th className="px-3 py-2.5">Class</th>
                    <th className="px-3 py-2.5">{channel === "whatsapp" ? "Phone" : "Email"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStudents.map((s) => {
                    const isSelected = selectedStudentIds.has(s.id);
                    const contactVal = channel === "whatsapp" ? s.phone : s.email;
                    return (
                      <tr
                        key={s.id}
                        onClick={() => toggleStudent(s.id)}
                        className={`cursor-pointer transition ${
                          isSelected
                            ? "bg-indigo-50/70 dark:bg-indigo-950/30"
                            : "hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleStudent(s.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded text-indigo-600"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                          {s.full_name}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-500">
                          {s.roll_number || "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          <span className="font-medium text-indigo-700 dark:text-indigo-300">
                            {s.program || "Course"}
                          </span>
                          {s.department_code && (
                            <span className="ml-1 text-slate-500">({s.department_code})</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {s.graduation_year ? `Class of ${s.graduation_year}` : "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">
                          {contactVal || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              {selectedStudentIds.size} student(s) selected
            </span>
            <button
              type="button"
              disabled={busy || selectedStudentIds.size === 0}
              onClick={handleAddSelectedStudents}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />}
              Add {selectedStudentIds.size} Student(s) to Audience
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: UPLOAD EXCEL / CSV SHEET (NUMBER + USERNAME) */}
      {activeTab === "sheet" && (
        <div className="space-y-4 rounded-xl border border-dashed border-violet-200 bg-violet-50/20 p-5 dark:border-slate-700 dark:bg-slate-950/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Upload Spreadsheet with {channel === "whatsapp" ? "Phone Numbers" : "Emails"} & Usernames
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Upload a <strong>.xlsx</strong> or <strong>.csv</strong> sheet containing columns:{" "}
                <code className="rounded bg-violet-100 px-1 py-0.5 font-mono text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {channel === "whatsapp" ? "phone / mobile" : "email"}
                </code>{" "}
                and{" "}
                <code className="rounded bg-violet-100 px-1 py-0.5 font-mono text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  username / name
                </code>
                . Extra columns are preserved for variables.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const header = channel === "whatsapp" ? "username,phone\n" : "username,email\n";
                const sample =
                  channel === "whatsapp"
                    ? "John Doe,+919999999999\nJane Smith,+918888888888"
                    : "John Doe,john@example.com\nJane Smith,jane@example.com";
                const blob = new Blob([header + sample], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `sample_${channel}_contacts.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <Download size={13} /> Download Sample CSV
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                setUploadedFile(e.target.files?.[0] || null);
                setUploadError("");
                setUploadSuccess("");
              }}
              className="rounded-xl border border-slate-300 bg-white p-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-violet-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-violet-200 dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              type="button"
              disabled={busy || !uploadedFile}
              onClick={async () => {
                if (!uploadedFile || !onUploadFile) return;
                setUploadError("");
                setUploadSuccess("");
                try {
                  await onUploadFile(uploadedFile);
                  // Some callers only stage the file until the campaign is created, so this
                  // must not claim the contacts were already processed.
                  setUploadSuccess(`Sheet "${uploadedFile.name}" added to this campaign.`);
                } catch (err: any) {
                  setUploadError(err.message || "Failed to upload file.");
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Upload & Validate Sheet
            </button>
          </div>

          {uploadSuccess && (
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 size={15} />
              {uploadSuccess}
            </div>
          )}
          {uploadError && (
            <div className="flex items-center gap-2 text-xs font-medium text-rose-600 dark:text-rose-400">
              <AlertCircle size={15} />
              {uploadError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

