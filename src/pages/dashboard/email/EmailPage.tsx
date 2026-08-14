import { useCallback, useEffect, useState } from "react";
import {
  Mail, Loader2, CheckCircle2, AlertCircle, ShieldCheck, RefreshCw, Globe, Send,
  FileText, Trash2, Users, Calendar as CalendarIcon, Download, Upload, Zap, Clock,
  Eye, Sparkles, Plus, FileSpreadsheet
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
  "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm";
const cardHead =
  "px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2";
const headText =
  "text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest";
const label =
  "text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400";
const input =
  "mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-400/50 transition";

function statusPill(status: string | null) {
  const s = (status || "").toLowerCase();
  const ok = s === "verified" || s === "active" || s === "sent";
  const pending = s === "pending" || s === "not_started" || s === "scheduled";
  const processing = s === "processing";
  
  const cls = ok
    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
    : pending
    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
    : processing
    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
    : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cls}`}>
      {status ? status : "Not configured"}
    </span>
  );
}

type Tab = "manual" | "bulk" | "auto" | "scheduled" | "templates" | "config";

export default function EmailPage() {
  const [tab, setTab] = useState<Tab>("manual");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight leading-tight text-slate-900 dark:text-slate-100">
          Email Communications
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage manual replies, mass bulk emails, automated responses, scheduled dispatches, and sender domains.
        </p>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm ring-1 ring-slate-100 w-full overflow-x-auto dark:bg-slate-900 dark:border-slate-800 dark:ring-slate-800">
        {[
          { key: "manual" as Tab, label: "Manual Reply", icon: Send },
          { key: "bulk" as Tab, label: "Bulk / Mass Mail", icon: Users },
          { key: "auto" as Tab, label: "Auto-Reply", icon: Zap },
          { key: "scheduled" as Tab, label: "Scheduled (Calendar)", icon: CalendarIcon },
          { key: "templates" as Tab, label: "Templates", icon: FileText },
          { key: "config" as Tab, label: "Sender & Domain", icon: ShieldCheck },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`h-9 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                active
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      {tab === "manual" && <ManualReplySection />}
      {tab === "bulk" && <BulkMailSection />}
      {tab === "auto" && <AutoReplySection />}
      {tab === "scheduled" && <ScheduledSection />}
      {tab === "templates" && <TemplatesSection />}
      {tab === "config" && <SenderConfigSection />}
    </div>
  );
}

/* ================= 1. MANUAL REPLY SECTION ================= */

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

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (!templateId) return;
    const t = templates.find((x) => x.id === templateId);
    if (t) {
      if (!subject) setSubject(t.subject || t.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEmail || !subject || !body) {
      setError("Please fill in recipient email, subject, and body.");
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
      setError(errorDetail(e) || "Failed to send email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {success}
          </div>
        )}

        <section className={card}>
          <div className={cardHead}>
            <Send size={15} className="text-indigo-500" />
            <h2 className={headText}>Send Manual Email / Reply</h2>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={label}>Recipient Email *</label>
                <input
                  type="email"
                  className={input}
                  placeholder="student@domain.edu"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Recipient Name</label>
                <input
                  type="text"
                  className={input}
                  placeholder="e.g. Rahul Sharma"
                  value={toName}
                  onChange={(e) => setToName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <label className={label}>Apply Email Template</label>
                <select
                  className={input}
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  <option value="">-- Select Template --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={label}>Email Message Body *</label>
              <textarea
                className={`${input} min-h-[140px] font-sans`}
                placeholder="Dear Student, thank you for contacting us..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={includeSignature}
                  onChange={(e) => setIncludeSignature(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Attach default sender signature
              </label>

              <button
                type="submit"
                disabled={sending}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 shadow-md shadow-indigo-100 dark:shadow-none"
              >
                {sending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Send Email
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* LIVE PREVIEW COLUMN */}
      <div className="space-y-6">
        <section className={card}>
          <div className={cardHead}>
            <Eye size={15} className="text-indigo-500" />
            <h2 className={headText}>Live Preview</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="text-xs space-y-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <p className="text-slate-400">
                <span className="font-bold text-slate-600 dark:text-slate-300">To:</span>{" "}
                {toEmail || "recipient@example.com"}
              </p>
              <p className="text-slate-400">
                <span className="font-bold text-slate-600 dark:text-slate-300">Subject:</span>{" "}
                {subject || "Email Subject"}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 min-h-[160px] text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {body || "Your email message body will preview here..."}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ================= 2. BULK MAIL SECTION ================= */

function BulkMailSection() {
  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<BulkRecipient[]>([]);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

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
        if (cols.length >= 1 && cols[0]) {
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

  const handleSendBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recipients.length === 0) {
      setError("Please upload a CSV file with at least 1 recipient.");
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
        `Mass email campaign launched successfully! ${res.total_sent || recipients.length} emails queued for delivery.`
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

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {success}
        </div>
      )}

      {/* TOP INSTRUCTION CARD + DOWNLOAD SAMPLE */}
      <section className={card}>
        <div className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-slate-900 dark:to-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="text-indigo-600 dark:text-indigo-400" size={20} />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Bulk Email / Mass Broadcast to Students
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Download the standard sample CSV template, populate your student list, and upload it to send mass emails.
            </p>
          </div>

          <button
            type="button"
            onClick={downloadSampleCsv}
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-sm shrink-0"
          >
            <Download size={14} /> Download Sample CSV
          </button>
        </div>
      </section>

      {/* BROADCAST FORM + RECIPIENTS PREVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className={card}>
            <div className={cardHead}>
              <Users size={15} className="text-indigo-500" />
              <h2 className={headText}>Broadcast Details</h2>
            </div>
            <form onSubmit={handleSendBulk} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={label}>Campaign / Event Name *</label>
                  <input
                    type="text"
                    className={input}
                    placeholder="e.g. Annual Sports Meet Invite"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                  />
                </div>
                <div>
                  <label className={label}>Subject Line *</label>
                  <input
                    type="text"
                    className={input}
                    placeholder="Important Notice: Event Announcement"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className={label}>Message Body *</label>
                <textarea
                  className={`${input} min-h-[130px]`}
                  placeholder="Dear Students, we are excited to invite you to..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              {/* FILE UPLOAD BOX */}
              <div>
                <label className={label}>Upload Student Data (CSV / Excel) *</label>
                <div className="mt-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800/40 transition relative">
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="mx-auto text-indigo-500 mb-2" size={26} />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Click or drag & drop student CSV / Excel file here
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Expected columns: <code className="font-mono">email, name, phone, course</code>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
                <p className="text-xs font-semibold text-slate-500">
                  Total Recipients Loaded:{" "}
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                    {recipients.length}
                  </span>
                </p>

                <button
                  type="submit"
                  disabled={sending || recipients.length === 0}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 shadow-md shadow-indigo-100 dark:shadow-none"
                >
                  {sending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  Send Mass Broadcast ({recipients.length})
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* RECIPIENTS TABLE PREVIEW */}
        <div>
          <section className={card}>
            <div className={cardHead}>
              <Users size={15} className="text-indigo-500" />
              <h2 className={headText}>Uploaded Recipients ({recipients.length})</h2>
            </div>
            <div className="p-4 max-h-[460px] overflow-y-auto">
              {recipients.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No recipients loaded yet. Upload a CSV to view rows here.
                </div>
              ) : (
                <div className="space-y-2">
                  {recipients.slice(0, 100).map((r, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs space-y-0.5"
                    >
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {r.name || "Student"}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {r.email}
                      </p>
                    </div>
                  ))}
                  {recipients.length > 100 && (
                    <p className="text-[11px] text-center text-slate-400 py-1">
                      + {recipients.length - 100} more recipients
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ================= 3. AUTO-REPLY SECTION ================= */

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
      setSuccess(`Automated Reply is now ${nextState ? "ENABLED ✅" : "DISABLED"}.`);
    } catch (e) {
      setError(errorDetail(e) || "Failed to update auto-reply setting.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {success}
        </div>
      )}

      <section className={card}>
        <div className={cardHead}>
          <Zap size={15} className="text-indigo-500" />
          <h2 className={headText}>Automated Reply Rules</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50/50 dark:bg-slate-800/40">
            <div className="flex items-start gap-3">
              <Sparkles size={20} className="mt-1 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Instant Auto-Reply to New Leads
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                  When enabled, any visitor or student who leaves their email address during a voice call or chat conversation will automatically receive an instant follow-up email.
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={autoReply}
              disabled={saving}
              onClick={toggleAutoReply}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                autoReply ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                  autoReply ? "left-[26px]" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ================= 4. SCHEDULED SEND & CALENDAR SECTION ================= */

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
      setError("Please complete all required fields and pick a schedule date.");
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

      setSuccess(`Email dispatch successfully scheduled for ${new Date(scheduledAt).toLocaleString()}!`);
      setSubject("");
      setBody("");
      setRecipientEmail("");
      setCampaignName("");
      loadDispatches();
    } catch (e) {
      setError(errorDetail(e) || "Failed to schedule email.");
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
        <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SCHEDULE FORM */}
        <div className="lg:col-span-2 space-y-6">
          <section className={card}>
            <div className={cardHead}>
              <Clock size={15} className="text-indigo-500" />
              <h2 className={headText}>Schedule Future Dispatch</h2>
            </div>
            <form onSubmit={handleScheduleSubmit} className="p-6 space-y-5">
              {/* MODE SELECTOR */}
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <button
                  type="button"
                  onClick={() => setScheduleMode("manual")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    scheduleMode === "manual"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  Schedule Single Email
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode("bulk")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    scheduleMode === "bulk"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  Schedule Bulk Campaign
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
                  <label className={label}>Campaign Name *</label>
                  <input
                    type="text"
                    className={input}
                    placeholder="e.g. Scheduled Entrance Exam Reminder"
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
                  placeholder="Scheduled Announcement"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div>
                <label className={label}>Message Body *</label>
                <textarea
                  className={`${input} min-h-[120px]`}
                  placeholder="Your message to be dispatched at the selected date & time..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={scheduling}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition flex items-center gap-2 shadow-md shadow-indigo-100 dark:shadow-none"
                >
                  {scheduling ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Clock size={16} />
                  )}
                  Schedule Dispatch
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* CALENDAR PICKER COLUMN */}
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
          <CalendarIcon size={15} className="text-indigo-500" />
          <h2 className={headText}>Scheduled Dispatches Queue</h2>
        </div>
        <div className="p-6">
          {dispatches.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No scheduled email dispatches in queue.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                    <th className="py-2.5 pr-4">Type / Name</th>
                    <th className="py-2.5 pr-4">Subject</th>
                    <th className="py-2.5 pr-4">Target Date & Time</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-300">
                  {dispatches.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-3 pr-4 font-semibold text-xs">
                        {item.type === "bulk" ? item.campaign_name || "Bulk Campaign" : item.recipient || "Single Email"}
                      </td>
                      <td className="py-3 pr-4 text-xs">{item.subject}</td>
                      <td className="py-3 pr-4 text-xs font-mono">
                        {new Date(item.scheduled_at).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4">{statusPill(item.status)}</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleCancel(item.id)}
                          className="text-xs text-red-600 hover:text-red-700 font-semibold"
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

/* ================= 5. TEMPLATES SECTION ================= */

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
      setError("Could not delete that template.");
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* CREATE TEMPLATE FORM */}
      <section className={card}>
        <div className={cardHead}>
          <Plus size={15} className="text-indigo-500" />
          <h2 className={headText}>Create New Template</h2>
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
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
            >
              {saving && <Loader2 size={14} className="animate-spin" />} Save Template
            </button>
          </div>
        </form>
      </section>

      {/* SAVED TEMPLATES LIST */}
      <section className={card}>
        <div className={cardHead}>
          <FileText size={15} className="text-indigo-500" />
          <h2 className={headText}>Saved Templates ({templates.length})</h2>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400">
              <Loader2 className="animate-spin mr-2" size={18} /> Loading templates…
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto text-slate-400" size={32} />
              <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
                No custom templates yet
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {templates.map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {t.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {t.subject || "No default subject"}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(t.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

/* ================= 6. SENDER & DOMAIN CONFIG SECTION ================= */

function SenderConfigSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 dark:text-slate-400">
        <Loader2 className="animate-spin mr-2" size={18} /> Loading communications…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {success}
        </div>
      )}

      {/* SENDER IDENTITY */}
      <section className={card}>
        <div className={cardHead}>
          <Mail size={14} className="text-indigo-500" />
          <h2 className={headText}>Sender Identity Configuration</h2>
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
                placeholder="admissions@yourdomain.edu"
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
              className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2"
            >
              {saving && <Loader2 size={16} className="animate-spin" />} Save Changes
            </button>
          </div>
        </form>
      </section>

      {/* SENDING DOMAIN & DNS */}
      <section className={card}>
        <div className={`${cardHead} justify-between`}>
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-indigo-500" />
            <h2 className={headText}>Sending Domain & DNS Records</h2>
          </div>
          <div className="flex items-center gap-3">
            {statusPill(settings?.domain_status ?? null)}
            <button
              onClick={verify}
              disabled={verifying}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 flex items-center gap-1.5"
            >
              {verifying ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}{" "}
              Verify
            </button>
          </div>
        </div>
        <div className="p-6">
          {dnsRecords.length === 0 ? (
            <div className="text-center py-8">
              <ShieldCheck className="mx-auto text-slate-300 dark:text-slate-700" size={32} />
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 font-medium">
                No DNS records yet
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <th className="py-2 pr-4 font-bold">Type</th>
                    <th className="py-2 pr-4 font-bold">Name</th>
                    <th className="py-2 pr-4 font-bold">Value</th>
                    <th className="py-2 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-300">
                  {dnsRecords.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800 align-top">
                      <td className="py-2.5 pr-4 font-mono text-xs">
                        {String(r.type ?? r.record ?? "—")}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs break-all">
                        {String(r.name ?? "—")}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs break-all">
                        {String(r.value ?? "—")}
                      </td>
                      <td className="py-2.5">{statusPill((r.status as string) ?? null)}</td>
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
