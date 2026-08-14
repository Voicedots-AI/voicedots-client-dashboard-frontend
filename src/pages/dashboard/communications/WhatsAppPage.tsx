import { useEffect, useState } from "react";
import {
  Loader2, CheckCircle2, AlertCircle, Users, Download, Upload,
  MessageSquare, Smartphone, CheckCheck, FileText, Key, Info
} from "lucide-react";
import communicationAPI, {
  type WhatsAppConfig, type WhatsAppTemplateItem
} from "@/api/communication";
import { downloadSampleCsv } from "@/utils/sampleCsv";

const errorDetail = (e: unknown): string => {
  if (e && typeof e === "object" && "response" in e) {
    const detail = (e as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return "";
};

const card =
  "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-all";
const cardHead =
  "px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30";
const headText =
  "text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest";
const label =
  "text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400";
const input =
  "mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-emerald-600 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 font-medium transition-all";

function statusPill(status: string | null) {
  const s = (status || "").toLowerCase();
  const ok = s === "verified" || s === "active" || s === "sent" || s === "registered" || s === "approved" || s === "delivered_meta";
  const pending = s === "pending" || s === "not_started" || s === "scheduled";

  const cls = ok
    ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700 font-bold"
    : pending
    ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700 font-bold"
    : "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-semibold";
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] border font-bold ${cls}`}>
      {status ? status.toUpperCase() : "REGISTERED"}
    </span>
  );
}

type WspTab = "wsp_send" | "wsp_bulk" | "wsp_templates" | "wsp_config";

export default function WhatsAppPage() {
  const [tab, setTab] = useState<WspTab>("wsp_send");

  const wspTabs = [
    { key: "wsp_send" as WspTab, title: "WhatsApp Direct", icon: MessageSquare, badge: "WSP" },
    { key: "wsp_bulk" as WspTab, title: "WhatsApp Bulk", icon: Users, badge: "Mass" },
    { key: "wsp_templates" as WspTab, title: "Meta Templates", icon: FileText },
    { key: "wsp_config" as WspTab, title: "Meta WBA Account", icon: Smartphone },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            WhatsApp Communications
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Meta Cloud API
            </span>
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Registered Number: +91 91766 00994 | Phone ID: 1281160101749255 | WBA ID: 3706222942850504
          </p>
        </div>
      </div>

      {/* META 24-HOUR & TEST RECIPIENT EXPLANATION BANNER */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 text-xs text-amber-900 dark:text-amber-200 font-medium leading-relaxed">
        <Info size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="font-extrabold text-amber-950 dark:text-amber-100">
            Why Meta WhatsApp Messages Require Setup for Delivery to Your Personal Phone:
          </p>
          <ul className="list-disc pl-4 mt-1 space-y-1 text-[11px]">
            <li>
              <strong>Meta Test Recipient Rule</strong>: In Meta Developer Console, Meta Cloud API only delivers messages to phone numbers added under <code className="bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded font-mono font-bold">To: Test Phone Numbers</code> until your business verification is completed.
            </li>
            <li>
              <strong>Meta 24-Hour Customer Window</strong>: Outside a 24-hour window (where you message the business number first), Meta requires using a <strong>Meta Pre-Approved Template</strong> (e.g. <i>Admission Status Update</i>).
            </li>
            <li>
              <strong>Meta Access Token</strong>: Paste your Meta System User Token under <strong>Meta WBA Account</strong> tab or input field below for live API delivery.
            </li>
          </ul>
        </div>
      </div>

      {/* SEGMENTED TAB BAR */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-inner w-full overflow-x-auto scrollbar-none">
        {wspTabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 min-w-[140px] px-3.5 py-2.5 rounded-xl text-xs font-black transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer relative group ${
                active
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shadow-sm border border-emerald-300 dark:border-emerald-700 scale-[1.01]"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/40"
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-transform duration-200 group-hover:scale-110 ${
                  active
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 group-hover:bg-emerald-50"
                }`}
              >
                <Icon size={14} />
              </div>
              <span className="truncate">{t.title}</span>
              {t.badge && (
                <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 text-[9px] font-black">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENTS */}
      <div className="transition-all duration-200">
        {tab === "wsp_send" && <WhatsAppDirectSendSection />}
        {tab === "wsp_bulk" && <WhatsAppBulkSection />}
        {tab === "wsp_templates" && <WhatsAppTemplatesSection />}
        {tab === "wsp_config" && <WhatsAppAccountConfigSection />}
      </div>
    </div>
  );
}

/* ================= 1. DIRECT WHATSAPP SEND ================= */

function WhatsAppDirectSendSection() {
  const [toPhone, setToPhone] = useState("");
  const [toName, setToName] = useState("");
  const [message, setMessage] = useState("");
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem("meta_wsp_token") || "");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [templates, setTemplates] = useState<WhatsAppTemplateItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  useEffect(() => {
    communicationAPI.listWhatsAppTemplates().then(setTemplates).catch(() => {});
  }, []);

  const handleTemplateApply = (tId: string) => {
    setSelectedTemplate(tId);
    if (!tId) return;
    const t = templates.find((x) => x.id === tId);
    if (t) {
      let bodyText = t.body;
      if (toName) bodyText = bodyText.replace("{{1}}", toName);
      setMessage(bodyText);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toPhone || !message) {
      setError("Please enter target Student Phone Number and WhatsApp Message.");
      return;
    }

    if (accessToken) {
      localStorage.setItem("meta_wsp_token", accessToken);
    }

    setSending(true);
    setError("");
    setSuccess("");
    try {
      const res = await communicationAPI.sendWhatsAppManual({
        to_phone: toPhone,
        to_name: toName,
        template_id: selectedTemplate || undefined,
        message,
        access_token: accessToken || undefined,
      });
      setSuccess(
        `WhatsApp message dispatched via Meta Cloud API (+91 91766 00994)! ID: ${res.whatsapp_msg_id || 'wmid'}`
      );
      setToPhone("");
      setToName("");
      setMessage("");
    } catch (e) {
      setError(errorDetail(e) || "Failed to send WhatsApp message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {error && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-300 font-semibold">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300 font-semibold">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> {success}
          </div>
        )}

        <section className={card}>
          <div className={cardHead}>
            <div className="flex items-center gap-2">
              <MessageSquare size={15} className="text-emerald-600 dark:text-emerald-400" />
              <h2 className={headText}>Direct WhatsApp Message Dispatch</h2>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              Sender: +91 91766 00994
            </span>
          </div>

          <form onSubmit={handleSend} className="p-6 space-y-5">
            {templates.length > 0 && (
              <div className="space-y-1.5">
                <label className={label}>Apply Meta Approved WhatsApp Template:</label>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleTemplateApply(t.id)}
                      className={`px-3 py-1 rounded-xl border text-xs font-bold transition-all ${
                        selectedTemplate === t.id
                          ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-slate-700 dark:text-slate-300"
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
                <label className={label}>Student WhatsApp Phone Number *</label>
                <input
                  type="text"
                  className={input}
                  placeholder="+91 98765 43210"
                  value={toPhone}
                  onChange={(e) => setToPhone(e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Student Name (Optional)</label>
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
              <div className="flex items-center justify-between">
                <label className={label}>WhatsApp Message Content *</label>
                <span className="text-[10px] font-bold text-slate-400">
                  {message.length} chars
                </span>
              </div>
              <textarea
                className={`${input} min-h-[140px] font-sans leading-relaxed`}
                placeholder="Dear Student, your admission application status at Dhanalakshmi Srinivasan CET is..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {/* OPTIONAL META ACCESS TOKEN INPUT */}
            <div>
              <div className="flex items-center gap-1.5">
                <Key size={13} className="text-emerald-600" />
                <label className={label}>Meta System User Token (Optional for Live Graph API)</label>
              </div>
              <input
                type="password"
                className={input}
                placeholder="EAAG... (Paste token generated from developers.facebook.com)"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
            </div>

            <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 pt-4">
              <button
                type="submit"
                disabled={sending}
                className="px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-black rounded-xl transition flex items-center gap-2 cursor-pointer shadow-sm"
              >
                {sending ? <Loader2 size={15} className="animate-spin" /> : <MessageSquare size={15} />}
                Send WhatsApp Message
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* LIVE PREVIEW CARD */}
      <div>
        <section className={card}>
          <div className={cardHead}>
            <div className="flex items-center gap-2">
              <Smartphone size={15} className="text-emerald-600 dark:text-emerald-400" />
              <h2 className={headText}>Live WhatsApp Preview</h2>
            </div>
          </div>

          <div className="p-4 bg-slate-900 rounded-b-2xl">
            <div className="bg-[#0b141a] rounded-2xl p-4 min-h-[300px] border border-slate-800 flex flex-col justify-between space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="h-9 w-9 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                  VD
                </div>
                <div>
                  <p className="text-xs font-black text-white">Voicedots (+91 91766 00994)</p>
                  <p className="text-[10px] text-emerald-400 font-bold">Official Business Account</p>
                </div>
              </div>

              <div className="bg-[#005c4b] text-white p-3.5 rounded-xl rounded-tr-none text-xs max-w-[85%] ml-auto space-y-1 shadow-md">
                <p className="whitespace-pre-wrap leading-relaxed">
                  {message || "Your typed WhatsApp message content will preview here in real-time..."}
                </p>
                <div className="flex items-center justify-end gap-1 text-[9px] text-emerald-200 pt-1">
                  <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <CheckCheck size={12} className="text-emerald-300" />
                </div>
              </div>

              <div className="text-[10px] text-center text-slate-500 font-medium">
                Sent via Meta WhatsApp Cloud API (Phone ID: 1281160101749255)
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ================= 2. WHATSAPP BULK BROADCAST ================= */

function WhatsAppBulkSection() {
  const [campaignName, setCampaignName] = useState("");
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState<{ phone: string; name?: string; course?: string }[]>([]);
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

      const parsed: { phone: string; name?: string; course?: string }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        const phoneCol = cols.find((c) => /^\+?\d{10,15}$/.test(c.replace(/[\s-]/g, "")));
        if (phoneCol || cols[1] || cols[0]) {
          parsed.push({
            phone: phoneCol || cols[1] || cols[0],
            name: cols[0] !== phoneCol ? cols[0] : "Student",
            course: cols[2] || undefined,
          });
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
      setError("Please upload a CSV file containing student phone numbers.");
      return;
    }
    if (!campaignName || !message) {
      setError("Please enter Campaign Name and WhatsApp Message.");
      return;
    }

    setSending(true);
    setError("");
    setSuccess("");
    try {
      const res = await communicationAPI.sendWhatsAppBulk({
        campaign_name: campaignName,
        message,
        recipients,
      });
      setSuccess(
        `Mass WhatsApp campaign '${campaignName}' launched! ${res.total_queued || recipients.length} messages queued via Meta WBA +91 91766 00994.`
      );
      setRecipients([]);
      setCampaignName("");
      setMessage("");
    } catch (e) {
      setError(errorDetail(e) || "Failed to launch WhatsApp broadcast.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-300 font-semibold">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300 font-semibold">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> {success}
        </div>
      )}

      <section className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl px-6 py-4 text-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-base font-black tracking-tight flex items-center gap-2">
              <MessageSquare size={18} /> Mass WhatsApp Broadcast to Students
            </h2>
            <p className="text-xs text-emerald-100 font-medium">
              Broadcast Meta WhatsApp messages to student phone numbers (+91 91766 00994 / Phone ID: 1281160101749255).
            </p>
          </div>

          <button
            type="button"
            onClick={downloadSampleCsv}
            className="px-4 py-2 bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
          >
            <Download size={14} /> Download Sample CSV
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className={card}>
            <div className={cardHead}>
              <div className="flex items-center gap-2">
                <Users size={15} className="text-emerald-600 dark:text-emerald-400" />
                <h2 className={headText}>Campaign Details</h2>
              </div>
            </div>

            <form onSubmit={handleSendBulk} className="p-6 space-y-5">
              <div>
                <label className={label}>WhatsApp Campaign Name *</label>
                <input
                  type="text"
                  className={input}
                  placeholder="e.g. Admission Counseling Reminder"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>

              <div>
                <label className={label}>WhatsApp Message Content *</label>
                <textarea
                  className={`${input} min-h-[120px]`}
                  placeholder="Dear Students, we are pleased to inform you that..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <div>
                <label className={label}>Upload Student Phone Dataset (CSV / Excel) *</label>
                <div className="mt-1.5 border-2 border-dashed border-emerald-300 dark:border-emerald-800 hover:border-emerald-500 rounded-xl p-5 text-center bg-emerald-50/30 dark:bg-emerald-950/20 transition relative group cursor-pointer">
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />
                  <Upload className="mx-auto text-emerald-600 dark:text-emerald-400 mb-1.5" size={24} />
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                    Click or drag & drop student phone CSV file here
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                    Headers: <code className="font-mono font-bold text-emerald-600 dark:text-emerald-400">phone, name, course</code>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Recipients Loaded: <span className="text-emerald-600 font-extrabold">{recipients.length}</span>
                </span>

                <button
                  type="submit"
                  disabled={sending || recipients.length === 0}
                  className="px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-black rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <MessageSquare size={15} />}
                  Launch WhatsApp Broadcast ({recipients.length})
                </button>
              </div>
            </form>
          </section>
        </div>

        <div>
          <section className={card}>
            <div className={cardHead}>
              <div className="flex items-center gap-2">
                <Users size={15} className="text-emerald-600 dark:text-emerald-400" />
                <h2 className={headText}>Student Numbers ({recipients.length})</h2>
              </div>
            </div>

            <div className="p-4 space-y-2 max-h-[380px] overflow-y-auto">
              {recipients.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs font-medium space-y-2">
                  <Smartphone className="mx-auto text-slate-300 dark:text-slate-700" size={30} />
                  <p>No phone numbers loaded.</p>
                </div>
              ) : (
                recipients.map((r, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-extrabold text-slate-900 dark:text-slate-100 truncate">
                        {r.name || "Student"}
                      </p>
                      <p className="text-slate-500 font-mono text-[11px] truncate">{r.phone}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ================= 3. WHATSAPP TEMPLATES ================= */

function WhatsAppTemplatesSection() {
  const [templates, setTemplates] = useState<WhatsAppTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    communicationAPI.listWhatsAppTemplates().then((t) => {
      setTemplates(t);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <section className={card}>
        <div className={cardHead}>
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-emerald-600 dark:text-emerald-400" />
            <h2 className={headText}>Meta Approved WhatsApp Templates ({templates.length})</h2>
          </div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            WBA Account ID: 3706222942850504
          </span>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500 font-semibold">
              <Loader2 className="animate-spin mr-2" size={18} /> Loading Meta WhatsApp templates…
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                      {t.name}
                    </p>
                    {statusPill(t.status)}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-sans leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-2">
                    {t.body}
                  </p>
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 pt-1">
                    <span>Category: {t.category}</span>
                    <span>Lang: {t.language}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ================= 4. WHATSAPP ACCOUNT CONFIG ================= */

function WhatsAppAccountConfigSection() {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);

  useEffect(() => {
    communicationAPI.getWhatsAppConfig().then(setConfig).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <section className={card}>
        <div className={cardHead}>
          <div className="flex items-center gap-2">
            <Smartphone size={15} className="text-emerald-600 dark:text-emerald-400" />
            <h2 className={headText}>Meta WhatsApp Business Cloud API Configuration</h2>
          </div>
          {statusPill(config?.status ?? "REGISTERED")}
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <p className={label}>Registered Phone Number</p>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100 font-mono mt-1">
                {config?.phone_number || "+91 91766 00994"}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <p className={label}>Phone Number ID</p>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100 font-mono mt-1">
                {config?.phone_number_id || "1281160101749255"}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <p className={label}>WhatsApp Business Account ID (WBA ID)</p>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100 font-mono mt-1">
                {config?.wba_id || "3706222942850504"}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <p className={label}>Meta Developer App ID</p>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100 font-mono mt-1">
                {config?.app_id || "1701104621066285"}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 font-bold">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>Webhooks & Permanent Meta Cloud Token Subscribed</span>
            </div>
            <span className="font-mono text-[11px]">Daily Limit: {config?.daily_limit || 250} msgs</span>
          </div>
        </div>
      </section>
    </div>
  );
}
