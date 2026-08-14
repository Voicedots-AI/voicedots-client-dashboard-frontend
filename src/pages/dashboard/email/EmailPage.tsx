import { useCallback, useEffect, useState } from "react";
import {
  Loader2, CheckCircle2, AlertCircle, ShieldCheck, RefreshCw, Globe, Send,
  FileText, Trash2, Users, Calendar as CalendarIcon, Download, Upload, Zap, Clock,
  Eye, Sparkles, FileSpreadsheet, Copy, Check, Search
} from "lucide-react";
import communicationAPI, {
  type EmailSettings, type DnsRecord, type EmailTemplateSummary,
  type BulkRecipient, type ScheduledDispatchItem
} from "@/api/communication";
import { downloadSampleCsv } from "@/utils/sampleCsv";
import { CalendarPicker } from "@/components/CalendarPicker";

const errorDetail = (e: unknown): string => {
  if (e && typeof e === "object" && "response" in e) {
    const detail = (e as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return "";
};

const card =
  "bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700";
const cardHead =
  "px-6 py-4 border-b-2 border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30";
const headText =
  "text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest";
const label =
  "text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400";
const input =
  "mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-indigo-600 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 font-medium transition-all";

function statusPill(status: string | null) {
  const s = (status || "").toLowerCase();
  const ok = s === "verified" || s === "active" || s === "sent";
  const pending = s === "pending" || s === "not_started" || s === "scheduled";
  const processing = s === "processing";

  const cls = ok
    ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700 font-bold"
    : pending
    ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700 font-bold"
    : processing
    ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700 font-bold"
    : "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-semibold";
  return (
    <span className={`px-3 py-1 rounded-full text-[11px] border-2 shadow-xs ${cls}`}>
      {status ? status.toUpperCase() : "NOT CONFIGURABLE"}
    </span>
  );
}

type Tab = "manual" | "bulk" | "auto" | "scheduled" | "templates" | "config";

export default function EmailPage() {
  const [tab, setTab] = useState<Tab>("manual");

  const optionTabs = [
    { key: "manual" as Tab, optionNum: "1", title: "Manual Reply", desc: "Single Email Dispatch", icon: Send },
    { key: "bulk" as Tab, optionNum: "2", title: "Bulk / Mass Mail", desc: "CSV/Excel Broadcast", icon: Users },
    { key: "auto" as Tab, optionNum: "3", title: "Auto-Reply", desc: "Trigger Rules", icon: Zap },
    { key: "scheduled" as Tab, optionNum: "4", title: "Calendar Schedule", desc: "Scheduled Queue", icon: CalendarIcon },
    { key: "templates" as Tab, optionNum: "5", title: "Templates", desc: "Preset Library", icon: FileText },
    { key: "config" as Tab, optionNum: "6", title: "Domain & DNS", desc: "Sender Verification", icon: ShieldCheck },
  ];

  return (
    <div className="space-y-8">
      {/* PAGE TITLE & HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Email Communications Hub
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Interactive Mode
            </span>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Choose an option below to manage manual replies, mass bulk campaigns, auto-reply rules, calendar scheduling, or domain verification.
          </p>
        </div>
      </div>

      {/* PROMINENT INTERACTIVE OPTIONS BAR */}
      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Available Options (Click an option to switch mode):
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {optionTabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all duration-200 relative group cursor-pointer flex flex-col justify-between min-h-[96px] ${
                  active
                    ? "border-indigo-600 bg-indigo-50/90 dark:bg-indigo-950/50 dark:border-indigo-400 shadow-md ring-2 ring-indigo-500/20 scale-[1.02]"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:scale-[1.01]"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`h-6 w-6 rounded-lg text-[11px] font-black flex items-center justify-center border ${
                      active
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 group-hover:border-indigo-400"
                    }`}
                  >
                    #{t.optionNum}
                  </span>
                  <Icon
                    size={16}
                    className={active ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-400 group-hover:text-indigo-500"}
                  />
                </div>

                <div className="mt-2">
                  <p className={`text-xs font-black leading-snug ${active ? "text-indigo-950 dark:text-indigo-100" : "text-slate-800 dark:text-slate-200"}`}>
                    {t.title}
                  </p>
                  <p className={`text-[10px] font-semibold mt-0.5 truncate ${active ? "text-indigo-700 dark:text-indigo-300" : "text-slate-400"}`}>
                    {t.desc}
                  </p>
                </div>

                {active && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-indigo-600 ring-2 ring-white dark:ring-slate-950 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ACTIVE OPTION CONTENT AREA */}
      <div className="transition-all duration-300">
        {tab === "manual" && <ManualReplySection />}
        {tab === "bulk" && <BulkMailSection />}
        {tab === "auto" && <AutoReplySection />}
        {tab === "scheduled" && <ScheduledSection />}
        {tab === "templates" && <TemplatesSection />}
        {tab === "config" && <SenderConfigSection />}
      </div>
    </div>
  );
}

/* ================= OPTION 1: MANUAL REPLY ================= */

function ManualReplySection() {
  const [toEmail, setToEmail] = useState("");
  const [toName, setToName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [includeSignature, setIncludeSignature] = useState(true);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [templates, setTemplates] = useState<EmailTemplateSummary[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  useEffect(() => {
    communicationAPI.listTemplates().then(setTemplates).catch(() => {});
  }, []);

  const applyTemplate = (tId: string) => {
    setSelectedTemplate(tId);
    if (!tId) return;
    const found = templates.find((x) => x.id === tId);
    if (found) {
      if (!subject) setSubject(found.subject || found.name);
      setBody((prev) => prev || `Dear Student,\n\nThank you for reaching out to us.\n\nBest regards,\nAdmissions Team`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEmail || !subject || !body) {
      setError("Please enter Recipient Email, Subject, and Email Body.");
      return;
    }
    setSending(true);
    setError("");
    setSuccess("");
    try {
      await communicationAPI.sendManualEmail({
        to_email: toEmail,
        to_name: toName,
        subject,
        body,
        template_id: selectedTemplate || undefined,
        include_signature: includeSignature,
      });
      setSuccess(`Email successfully sent to ${toEmail}!`);
      setToEmail("");
      setToName("");
      setSubject("");
      setBody("");
    } catch (e) {
      setError(errorDetail(e) || "Failed to send manual email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {error && (
          <div className="flex items-start gap-2.5 rounded-2xl border-2 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-5 py-3.5 text-sm text-red-800 dark:text-red-300 font-semibold">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2.5 rounded-2xl border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-5 py-3.5 text-sm text-emerald-800 dark:text-emerald-300 font-semibold">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" /> {success}
          </div>
        )}

        <section className={card}>
          <div className={cardHead}>
            <div className="flex items-center gap-2">
              <span className="h-6 px-2 rounded-md bg-indigo-600 text-white text-[11px] font-black">
                OPTION #1
              </span>
              <h2 className={headText}>Manual Email / Reply Dispatcher</h2>
            </div>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
              <Sparkles size={13} /> Direct Send
            </span>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* QUICK PRESET TEMPLATE PILLS */}
            {templates.length > 0 && (
              <div className="space-y-1.5">
                <label className={label}>Quick Apply Saved Template:</label>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => applyTemplate(t.id)}
                      className={`px-3 py-1.5 rounded-xl border-2 text-xs font-bold transition-all ${
                        selectedTemplate === t.id
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                          : "border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      + {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={label}>Recipient Email *</label>
                <input
                  type="email"
                  className={input}
                  placeholder="student@dscet.ac.in"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Recipient Name (Optional)</label>
                <input
                  type="text"
                  className={input}
                  placeholder="e.g. Rahul Sharma"
                  value={toName}
                  onChange={(e) => setToName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className={label}>Subject Line *</label>
              <input
                type="text"
                className={input}
                placeholder="Update regarding your admission application"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className={label}>Email Message Body *</label>
                <span className="text-[10px] font-bold text-slate-400">
                  {body.length} characters
                </span>
              </div>
              <textarea
                className={`${input} min-h-[150px] font-sans leading-relaxed`}
                placeholder="Dear Student, thank you for contacting Dhanalakshmi Srinivasan CET..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t-2 border-slate-100 dark:border-slate-800 pt-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-extrabold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={includeSignature}
                  onChange={(e) => setIncludeSignature(e.target.checked)}
                  className="h-4 w-4 rounded border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Include Official Organization Signature
              </label>

              <button
                type="submit"
                disabled={sending}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95 cursor-pointer"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Dispatch Email Now
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* LIVE PREVIEW CARD */}
      <div className="space-y-6">
        <section className={card}>
          <div className={cardHead}>
            <div className="flex items-center gap-2">
              <Eye size={16} className="text-indigo-600 dark:text-indigo-400" />
              <h2 className={headText}>Live Interactive Preview</h2>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Real-Time
            </span>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-2 border-b-2 border-slate-100 dark:border-slate-800 pb-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-400">TO:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {toEmail || "student@dscet.ac.in"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-400">SUBJECT:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                  {subject || "Admission Follow-Up"}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl border-2 border-slate-200 dark:border-slate-800 p-4 min-h-[180px] text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
              {body || "Your typed email content will format and render live in this interactive card container..."}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ================= OPTION 2: BULK / MASS MAIL ================= */

function BulkMailSection() {
  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<BulkRecipient[]>([]);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length <= 1) {
        setError("CSV file is empty or missing data rows.");
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const parsed: BulkRecipient[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        if (cols.length >= 1 && cols[0] && cols[0].includes("@")) {
          const rec: BulkRecipient = { email: cols[0] };
          headers.forEach((h, idx) => {
            if (cols[idx]) rec[h] = cols[idx];
          });
          parsed.push(rec);
        }
      }

      setRecipients(parsed);
      setError("");
    };
    reader.readAsText(file);
  };

  const removeRecipient = (index: number) => {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recipients.length === 0) {
      setError("Please upload a CSV/Excel file with at least 1 student recipient.");
      return;
    }
    if (!campaignName || !subject || !body) {
      setError("Please enter Campaign Name, Subject, and Email Body.");
      return;
    }

    setSending(true);
    setError("");
    setSuccess("");
    try {
      const res = await communicationAPI.sendBulkEmail({
        campaign_name: campaignName,
        subject,
        body,
        recipients,
      });
      setSuccess(
        `Mass broadcast launched successfully! ${res.total_sent || recipients.length} emails queued for processing.`
      );
      setRecipients([]);
      setCampaignName("");
      setSubject("");
      setBody("");
    } catch (e) {
      setError(errorDetail(e) || "Failed to launch bulk email campaign.");
    } finally {
      setSending(false);
    }
  };

  const filteredRecipients = recipients.filter((r) =>
    (r.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.course || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border-2 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-5 py-3.5 text-sm text-red-800 dark:text-red-300 font-semibold">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2.5 rounded-2xl border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-5 py-3.5 text-sm text-emerald-800 dark:text-emerald-300 font-semibold">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" /> {success}
        </div>
      )}

      {/* SAMPLE CSV DOWNLOAD PROMINENT INTERACTIVE CARD */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-6 px-2.5 rounded-md bg-white/20 text-white text-xs font-black">
                OPTION #2
              </span>
              <h2 className="text-xl font-black tracking-tight">
                Mass Bulk Email Broadcast with Student Data Upload
              </h2>
            </div>
            <p className="text-xs text-indigo-100 font-medium max-w-2xl">
              Upload your student email dataset in CSV/Excel format. Download our ready-to-use sample template to format your data correctly.
            </p>
          </div>

          <button
            type="button"
            onClick={downloadSampleCsv}
            className="px-5 py-3 bg-white text-indigo-700 hover:bg-indigo-50 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-md hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
          >
            <Download size={16} /> Download Sample CSV Template
          </button>
        </div>
      </section>

      {/* FORM & RECIPIENTS PREVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className={card}>
            <div className={cardHead}>
              <div className="flex items-center gap-2">
                <Users size={16} className="text-indigo-600 dark:text-indigo-400" />
                <h2 className={headText}>Broadcast Campaign Details</h2>
              </div>
            </div>

            <form onSubmit={handleSendBulk} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={label}>Event / Campaign Name *</label>
                  <input
                    type="text"
                    className={input}
                    placeholder="e.g. Annual Symposium Announcement"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                  />
                </div>
                <div>
                  <label className={label}>Subject Line *</label>
                  <input
                    type="text"
                    className={input}
                    placeholder="Important Notice: Event Details"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className={label}>Message Body *</label>
                <textarea
                  className={`${input} min-h-[130px]`}
                  placeholder="Dear Students, we are pleased to invite you to..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              {/* INTERACTIVE DRAG & DROP ZONE */}
              <div>
                <label className={label}>Upload Student CSV / Excel File *</label>
                <div className="mt-2 border-3 border-dashed border-indigo-300 dark:border-indigo-800 hover:border-indigo-500 rounded-2xl p-6 text-center bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all relative group cursor-pointer">
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />
                  <Upload className="mx-auto text-indigo-600 dark:text-indigo-400 mb-2 group-hover:scale-110 transition-transform" size={28} />
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                    Click to browse or drag & drop student CSV file here
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                    Format: <code className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">email, name, phone, course</code>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t-2 border-slate-100 dark:border-slate-800 pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Students Loaded:
                  </span>
                  <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-black">
                    {recipients.length} Recipient(s)
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={sending || recipients.length === 0}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95 cursor-pointer"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Launch Mass Email Broadcast
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* INTERACTIVE RECIPIENT LIST PREVIEW */}
        <div>
          <section className={card}>
            <div className={cardHead}>
              <div className="flex items-center gap-2">
                <Users size={16} className="text-indigo-600 dark:text-indigo-400" />
                <h2 className={headText}>Recipients List ({recipients.length})</h2>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {recipients.length > 0 && (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search student name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 outline-none"
                  />
                </div>
              )}

              <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                {recipients.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-xs font-medium space-y-2">
                    <FileSpreadsheet className="mx-auto text-slate-300 dark:text-slate-700" size={32} />
                    <p>No student records loaded.</p>
                    <p className="text-[11px]">Upload a CSV file to preview student rows here.</p>
                  </div>
                ) : (
                  filteredRecipients.map((r, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs hover:border-indigo-200 transition"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-extrabold text-slate-900 dark:text-slate-100 truncate">
                          {r.name || "Student"}
                        </p>
                        <p className="text-slate-500 font-mono text-[11px] truncate">{r.email}</p>
                        {r.course && (
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                            {r.course}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeRecipient(idx)}
                        className="text-slate-400 hover:text-red-600 p-1 transition shrink-0"
                        title="Remove row"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ================= OPTION 3: AUTO-REPLY ================= */

function AutoReplySection() {
  const [autoReply, setAutoReply] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    communicationAPI.getEmailSettings().then((s) => {
      setAutoReply(!!s.auto_reply_enabled);
    }).catch(() => {});
  }, []);

  const toggleAutoReply = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const nextState = !autoReply;
      await communicationAPI.updateEmailSettings({ auto_reply_enabled: nextState });
      setAutoReply(nextState);
      setSuccess(`Automated Reply Rule is now ${nextState ? "ENABLED ✅" : "DISABLED"}.`);
    } catch (e) {
      setError(errorDetail(e) || "Failed to update auto-reply setting.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border-2 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-5 py-3.5 text-sm text-red-800 dark:text-red-300 font-semibold">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2.5 rounded-2xl border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-5 py-3.5 text-sm text-emerald-800 dark:text-emerald-300 font-semibold">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" /> {success}
        </div>
      )}

      <section className={card}>
        <div className={cardHead}>
          <div className="flex items-center gap-2">
            <span className="h-6 px-2 rounded-md bg-indigo-600 text-white text-[11px] font-black">
              OPTION #3
            </span>
            <h2 className={headText}>Automated Reply Triggers</h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between rounded-2xl border-2 border-indigo-100 dark:border-slate-800 p-6 bg-gradient-to-r from-indigo-50/40 to-slate-50/40 dark:from-slate-900 dark:to-slate-800/40">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <Sparkles size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Instant Automated Follow-Up on Lead Capture
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl font-medium">
                  When enabled, any visitor or student leaving their email during a voice agent call or conversation will automatically receive an instant follow-up response.
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={autoReply}
              disabled={saving}
              onClick={toggleAutoReply}
              className={`relative h-8 w-14 rounded-full transition-all duration-300 cursor-pointer ${
                autoReply ? "bg-indigo-600 ring-4 ring-indigo-500/20" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-all duration-300 ${
                  autoReply ? "left-[28px]" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ================= OPTION 4: SCHEDULED SEND (CALENDAR) ================= */

function ScheduledSection() {
  const [scheduleMode, setScheduleMode] = useState<"manual" | "bulk">("manual");
  const [scheduledAt, setScheduledAt] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().slice(0, 16)
  );
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [dispatches, setDispatches] = useState<ScheduledDispatchItem[]>([]);

  const loadDispatches = useCallback(async () => {
    const list = await communicationAPI.listScheduledDispatches();
    setDispatches(list);
  }, []);

  useEffect(() => {
    loadDispatches();
  }, [loadDispatches]);

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !body || !scheduledAt) {
      setError("Please complete Subject, Body, and pick a future Schedule date.");
      return;
    }

    setScheduling(true);
    setError("");
    setSuccess("");
    try {
      await communicationAPI.scheduleEmail({
        mode: scheduleMode,
        scheduled_at: scheduledAt,
        subject,
        body,
        recipient_email: scheduleMode === "manual" ? recipientEmail : undefined,
        campaign_name: scheduleMode === "bulk" ? campaignName : undefined,
      });

      setSuccess(`Email successfully scheduled for ${new Date(scheduledAt).toLocaleString()}!`);
      setSubject("");
      setBody("");
      setRecipientEmail("");
      setCampaignName("");
      loadDispatches();
    } catch (e) {
      setError(errorDetail(e) || "Failed to schedule dispatch.");
    } finally {
      setScheduling(false);
    }
  };

  const handleCancel = async (id: string) => {
    await communicationAPI.cancelScheduledDispatch(id);
    setDispatches((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border-2 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-5 py-3.5 text-sm text-red-800 dark:text-red-300 font-semibold">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2.5 rounded-2xl border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-5 py-3.5 text-sm text-emerald-800 dark:text-emerald-300 font-semibold">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" /> {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SCHEDULE FORM */}
        <div className="lg:col-span-2 space-y-6">
          <section className={card}>
            <div className={cardHead}>
              <div className="flex items-center gap-2">
                <span className="h-6 px-2 rounded-md bg-indigo-600 text-white text-[11px] font-black">
                  OPTION #4
                </span>
                <h2 className={headText}>Scheduled Send & Calendar Integration</h2>
              </div>
            </div>

            <form onSubmit={handleScheduleSubmit} className="p-6 space-y-5">
              <div className="flex items-center gap-3 border-b-2 border-slate-100 dark:border-slate-800 pb-4">
                <button
                  type="button"
                  onClick={() => setScheduleMode("manual")}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                    scheduleMode === "manual"
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  Schedule Single Email
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode("bulk")}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                    scheduleMode === "bulk"
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  Schedule Mass Campaign
                </button>
              </div>

              {scheduleMode === "manual" ? (
                <div>
                  <label className={label}>Recipient Email *</label>
                  <input
                    type="email"
                    className={input}
                    placeholder="student@domain.edu"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <label className={label}>Campaign / Event Name *</label>
                  <input
                    type="text"
                    className={input}
                    placeholder="e.g. Scheduled Exam Notification"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className={label}>Subject Line *</label>
                <input
                  type="text"
                  className={input}
                  placeholder="Scheduled Subject Line"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div>
                <label className={label}>Message Body *</label>
                <textarea
                  className={`${input} min-h-[120px]`}
                  placeholder="Type message to be dispatched at the scheduled calendar date & time..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between border-t-2 border-slate-100 dark:border-slate-800 pt-4">
                <span className="text-xs font-extrabold text-slate-500 font-mono">
                  Selected Target: {new Date(scheduledAt).toLocaleString()}
                </span>
                <button
                  type="submit"
                  disabled={scheduling}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-black rounded-xl transition flex items-center gap-2 shadow-lg active:scale-95 cursor-pointer"
                >
                  {scheduling ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}
                  Schedule Dispatch
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* EMBEDDED INTERACTIVE CALENDAR */}
        <div>
          <CalendarPicker
            selectedDateTime={scheduledAt}
            onChange={(val) => setScheduledAt(val)}
          />
        </div>
      </div>

      {/* SCHEDULED QUEUE TABLE */}
      <section className={card}>
        <div className={cardHead}>
          <div className="flex items-center gap-2">
            <CalendarIcon size={16} className="text-indigo-600 dark:text-indigo-400" />
            <h2 className={headText}>Scheduled Dispatches Queue ({dispatches.length})</h2>
          </div>
        </div>
        <div className="p-6">
          {dispatches.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs font-medium">
              No scheduled dispatches in queue.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 font-bold border-b-2 border-slate-100 dark:border-slate-800">
                    <th className="py-2.5 pr-4">Type / Name</th>
                    <th className="py-2.5 pr-4">Subject</th>
                    <th className="py-2.5 pr-4">Scheduled Date & Time</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-300">
                  {dispatches.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-3 pr-4 font-bold text-xs">
                        {item.type === "bulk" ? item.campaign_name || "Bulk Campaign" : item.recipient || "Single Email"}
                      </td>
                      <td className="py-3 pr-4 text-xs font-medium">{item.subject}</td>
                      <td className="py-3 pr-4 text-xs font-mono">
                        {new Date(item.scheduled_at).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4">{statusPill(item.status)}</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleCancel(item.id)}
                          className="text-xs text-red-600 hover:text-red-700 font-bold"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ================= OPTION 5: TEMPLATES ================= */

function TemplatesSection() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [templates, setTemplates] = useState<EmailTemplateSummary[]>([]);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await communicationAPI.listTemplates());
      setError("");
    } catch (e) {
      setError(errorDetail(e) || "Templates are unavailable right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !htmlContent) return;
    setSaving(true);
    try {
      await communicationAPI.listTemplates();
      setName("");
      setSubject("");
      setHtmlContent("");
      load();
    } catch (e) {
      setError(errorDetail(e) || "Could not save template.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await communicationAPI.deleteTemplate(id);
      setTemplates((t) => t.filter((x) => x.id !== id));
    } catch {
      setError("Could not delete template.");
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border-2 border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-5 py-3.5 text-sm text-amber-800 dark:text-amber-300 font-semibold">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" /> {error}
        </div>
      )}

      <section className={card}>
        <div className={cardHead}>
          <div className="flex items-center gap-2">
            <span className="h-6 px-2 rounded-md bg-indigo-600 text-white text-[11px] font-black">
              OPTION #5
            </span>
            <h2 className={headText}>Create Custom Template</h2>
          </div>
        </div>
        <form onSubmit={handleCreateTemplate} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Template Name *</label>
              <input
                className={input}
                placeholder="e.g. Admission Confirmation"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className={label}>Default Subject Line</label>
              <input
                className={input}
                placeholder="Subject line for this template"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={label}>HTML / Text Content *</label>
            <textarea
              className={`${input} min-h-[110px] font-mono text-xs`}
              placeholder="<h1>Welcome</h1><p>Dear {{name}}, thank you for contacting us...</p>"
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              {saving && <Loader2 size={14} className="animate-spin" />} Save Template
            </button>
          </div>
        </form>
      </section>

      <section className={card}>
        <div className={cardHead}>
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-indigo-600 dark:text-indigo-400" />
            <h2 className={headText}>Saved Templates Library ({templates.length})</h2>
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400 font-semibold">
              <Loader2 className="animate-spin mr-2" size={18} /> Loading templates…
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto text-slate-300 dark:text-slate-700" size={36} />
              <p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                No custom templates created yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                      {t.name}
                    </p>
                    <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                      {t.subject || "No default subject"}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(t.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ================= OPTION 6: SENDER & DOMAIN CONFIG ================= */

function SenderConfigSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [signature, setSignature] = useState("");
  const [autoReply, setAutoReply] = useState(false);

  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);

  const parseDnsRecords = (records: unknown): DnsRecord[] => {
    if (Array.isArray(records)) return records;
    if (typeof records === "string") {
      try {
        const parsed = JSON.parse(records);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [];
      }
    }
    return [];
  };

  const hydrate = (s: EmailSettings) => {
    setSettings(s);
    setFromName(s.from_name ?? "");
    setFromEmail(s.from_email ?? "");
    setReplyTo(s.reply_to ?? "");
    setSignature(s.signature ?? "");
    setAutoReply(!!s.auto_reply_enabled);
    setDnsRecords(parseDnsRecords(s.dns_records));
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const s = await communicationAPI.getEmailSettings();
      hydrate(s);
    } catch (e) {
      setError(errorDetail(e) || "Could not load email settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await communicationAPI.updateEmailSettings({
        from_name: fromName || null,
        from_email: fromEmail || null,
        reply_to: replyTo || null,
        signature: signature || null,
        auto_reply_enabled: autoReply,
      });
      if (updated && typeof updated === "object" && "from_email" in updated) hydrate(updated);
      setSuccess("Sender configuration saved.");
    } catch (e) {
      setError(errorDetail(e) || "Could not save sender configuration.");
    } finally {
      setSaving(false);
    }
  };

  const verify = async () => {
    setVerifying(true);
    setError("");
    setSuccess("");
    try {
      await communicationAPI.verifyDomain();
      const dns = await communicationAPI.getDnsRecords();
      setDnsRecords(parseDnsRecords(dns.dns_records));
      setSettings((p) => (p ? { ...p, domain_status: dns.domain_status } : p));
      setSuccess("Domain check complete.");
    } catch (e) {
      setError(errorDetail(e) || "Domain verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  const copyText = (val: string, idx: number) => {
    navigator.clipboard.writeText(val);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 font-semibold">
        <Loader2 className="animate-spin mr-2" size={18} /> Loading domain configuration…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border-2 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-5 py-3.5 text-sm text-red-800 dark:text-red-300 font-semibold">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2.5 rounded-2xl border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-5 py-3.5 text-sm text-emerald-800 dark:text-emerald-300 font-semibold">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" /> {success}
        </div>
      )}

      {/* SENDER IDENTITY */}
      <section className={card}>
        <div className={cardHead}>
          <div className="flex items-center gap-2">
            <span className="h-6 px-2 rounded-md bg-indigo-600 text-white text-[11px] font-black">
              OPTION #6
            </span>
            <h2 className={headText}>Sender Identity Configuration</h2>
          </div>
        </div>
        <form onSubmit={save} className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={label}>Sender Name</label>
              <input
                className={input}
                value={fromName}
                placeholder="Admissions Office"
                onChange={(e) => setFromName(e.target.value)}
              />
            </div>
            <div>
              <label className={label}>Sender Email</label>
              <input
                className={input}
                type="email"
                value={fromEmail}
                placeholder="admissions@dscet.ac.in"
                onChange={(e) => setFromEmail(e.target.value)}
              />
            </div>
            <div>
              <label className={label}>Reply-To</label>
              <input
                className={input}
                type="email"
                value={replyTo}
                placeholder="optional"
                onChange={(e) => setReplyTo(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Signature</label>
              <textarea
                className={`${input} min-h-[90px]`}
                value={signature}
                placeholder="Warm regards, Admissions Team"
                onChange={(e) => setSignature(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-black rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
            >
              {saving && <Loader2 size={16} className="animate-spin" />} Save Configuration
            </button>
          </div>
        </form>
      </section>

      {/* SENDING DOMAIN & DNS TABLE */}
      <section className={card}>
        <div className={`${cardHead} justify-between`}>
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-indigo-600 dark:text-indigo-400" />
            <h2 className={headText}>Sending Domain & Interactive DNS Verification</h2>
          </div>
          <div className="flex items-center gap-3">
            {statusPill(settings?.domain_status ?? null)}
            <button
              onClick={verify}
              disabled={verifying}
              className="px-4 py-2 text-xs font-black rounded-xl border-2 border-indigo-200 dark:border-slate-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
            >
              {verifying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Verify
            </button>
          </div>
        </div>
        <div className="p-6">
          {dnsRecords.length === 0 ? (
            <div className="text-center py-8">
              <ShieldCheck className="mx-auto text-slate-300 dark:text-slate-700" size={32} />
              <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                No DNS records yet
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b-2 border-slate-100 dark:border-slate-800">
                    <th className="py-2.5 pr-4 font-extrabold">Type</th>
                    <th className="py-2.5 pr-4 font-extrabold">Host / Name</th>
                    <th className="py-2.5 pr-4 font-extrabold">Value / Record Content</th>
                    <th className="py-2.5 pr-4 font-extrabold">Status</th>
                    <th className="py-2.5 text-right font-extrabold">Action</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-300">
                  {dnsRecords.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800 align-top">
                      <td className="py-3 pr-4 font-mono text-xs font-bold">
                        {String(r.type ?? r.record ?? "—")}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs font-bold break-all">
                        {String(r.name ?? "—")}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs break-all max-w-xs">
                        {String(r.value ?? "—")}
                      </td>
                      <td className="py-3 pr-4">{statusPill((r.status as string) ?? null)}</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => copyText(String(r.value ?? ""), i)}
                          className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          {copiedIdx === i ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          {copiedIdx === i ? "Copied!" : "Copy"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
