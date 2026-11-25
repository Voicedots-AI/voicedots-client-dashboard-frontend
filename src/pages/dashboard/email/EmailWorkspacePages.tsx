import { useEffect, useState, type ReactNode } from "react";
import { Inbox, MailPlus, Send, Sparkles, Link2, Loader2, Paperclip, RefreshCw, Clock, Calendar, CheckCircle2, Trash2, AlertCircle, Copy, Eye, FileText, Plus, Save, type LucideIcon } from "lucide-react";
import { BTN, BTN_DANGER, BTN_SECONDARY, CARD, EmptyState, INPUT, LABEL, SectionHeader } from "@/components/comms/CommsKit";
import CampaignAudienceSelector, { type SelectedContact } from "@/components/campaigns/CampaignAudienceSelector";
import emailApi, { type EmailAccount, type EmailTemplate, type EmailThread, type EmailThreadDetail } from "@/api/emailApi";
import { apiErrorDetail } from "@/lib/apiError";

type ThreadResponse = { threads: EmailThread[] };

function Empty({ icon, title, text, children }: { icon: LucideIcon; title: string; text: string; children?: ReactNode }) {
  return <EmptyState icon={icon} tone="mail" title={title} text={text}>{children}</EmptyState>;
}

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "");

/** Two-letter monogram from an address like "Asha Rao <asha@x.com>". */
const monogram = (from: string) => {
  const name = from.replace(/<.*>/, "").trim() || from;
  return name.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
};

export function InboxPage() {
  const [state, setState] = useState<ThreadResponse | null>(null);
  const [selected, setSelected] = useState<EmailThreadDetail | null>(null);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => { emailApi.threads().then(setState).catch(() => setState({ threads: [] })); }, []);
  if (!state) return <div className={`${CARD} flex items-center justify-center gap-2 py-20 text-[13px] text-[#6B7A99] dark:text-slate-400`}><Loader2 size={18} className="animate-spin text-[#ED5173]" /> Loading inbox…</div>;
  if (!state.threads?.length) return <Empty icon={Inbox} title="No conversations yet" text="Connect a Gmail account in Settings, or sync it, to see conversations here." />;

  const sendReply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    setSending(true);
    setNotice("");
    try {
      await emailApi.reply(selected.id, { body_text: form.get("body"), body_html: "", idempotency_key: crypto.randomUUID(), attachment_ids: [] });
      setNotice("Reply queued.");
      formEl.reset();
    } catch {
      setNotice("Reply couldn't be sent. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <ul className={`${CARD} h-fit max-h-[70vh] divide-y divide-sky-100/80 overflow-y-auto p-1.5 dark:divide-white/[0.06]`} aria-label="Conversations">
        {state.threads.map((x) => {
          const active = selected?.id === x.id;
          const unread = x.unread_count > 0;
          return (
            <li key={x.id}>
              <button
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => { setNotice(""); emailApi.thread(x.id).then(setSelected); }}
                className={`flex w-full gap-3 rounded-xl p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#137EFD] ${active ? "bg-[#FFF0F3] dark:bg-rose-500/[0.08]" : "hover:bg-[#F8FBFF] dark:hover:bg-white/[0.03]"}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ED5173] to-[#FF8A3D] text-[12px] font-semibold text-white">{monogram(x.participants?.[0] || "?")}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-[13px] ${unread ? "font-semibold text-[#0B1B3F] dark:text-white" : "font-medium text-[#28395E] dark:text-slate-300"}`}>{x.subject || "(No subject)"}</span>
                    {unread && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#ED5173] px-1.5 text-[10px] font-semibold text-white">{x.unread_count}</span>}
                  </span>
                  <span className="block truncate text-[12px] text-[#6B7A99] dark:text-slate-400">{x.participants?.join(", ")}</span>
                  {x.latest_message_at && <span className="block text-[11px] text-[#9AA8C2] dark:text-slate-500">{when(x.latest_message_at)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected ? (
        <section className={`${CARD} min-w-0 space-y-4 p-4 sm:p-5`}>
          <h2 className="text-[17px] font-semibold text-[#0B1B3F] dark:text-white">{selected.subject || "(No subject)"}</h2>
          <div className="space-y-3">
            {selected.messages.map((item) => {
              const outgoing = item.direction === "outbound";
              return (
                <article key={item.id} className={`rounded-xl p-4 ring-1 ${outgoing ? "bg-[#F4F9FF] ring-sky-100 dark:bg-blue-500/[0.06] dark:ring-blue-500/15" : "bg-white ring-sky-100/80 dark:bg-white/[0.02] dark:ring-white/[0.07]"}`}>
                  <div className="mb-2 flex flex-wrap items-center gap-x-2 text-[12px] text-[#6B7A99] dark:text-slate-400">
                    <span className="font-semibold text-[#0B1B3F] dark:text-slate-200">{item.from}</span>
                    {when(item.sent_at || item.received_at) && <span>· {when(item.sent_at || item.received_at)}</span>}
                    <span className="ml-auto rounded-full bg-[#EEF3FB] px-2 py-0.5 text-[10px] font-semibold capitalize text-[#55648A] dark:bg-white/[0.06] dark:text-slate-300">{item.status}</span>
                  </div>
                  <div className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#28395E] dark:text-slate-300">{item.body_text}</div>
                </article>
              );
            })}
          </div>
          <form onSubmit={sendReply} className="space-y-3 border-t border-sky-100 pt-4 dark:border-white/[0.06]">
            <label className={LABEL}>
              Reply
              <textarea name="body" required rows={5} placeholder="Write your reply…" className={INPUT} />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={sending} className={BTN}>
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send reply
              </button>
              {notice && <span className="text-[13px] text-[#6B7A99] dark:text-slate-400">{notice}</span>}
            </div>
          </form>
        </section>
      ) : (
        <Empty icon={Inbox} title="Select a conversation" text="Choose a thread on the left to read it and reply." />
      )}
    </div>
  );
}

export function SingleEmailPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [variablesJson, setVariablesJson] = useState("{}");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    emailApi.accounts().then((accs) => {
      setAccounts(accs);
      if (accs.length > 0) setSelectedAccount(accs[0].id);
    }).catch(() => setAccounts([]));
    emailApi.templates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  const handleTemplateChange = (templateVersionId: string) => {
    setSelectedTemplateId(templateVersionId);
    if (!templateVersionId) return;
    const tpl = templates.find((t) => t.current_version_id === templateVersionId || t.id === templateVersionId);
    if (tpl?.version) {
      if (tpl.version.subject) setSubject(tpl.version.subject);
      if (tpl.version.body_text) setBodyText(tpl.version.body_text);
      if (tpl.version.variables && tpl.version.variables.length > 0) {
        const initialVars: Record<string, string> = {};
        tpl.version.variables.forEach((v) => {
          initialVars[v] = `[${v}]`;
        });
        setVariablesJson(JSON.stringify(initialVars, null, 2));
      }
    }
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAccount) return setMessage("Please connect an Email account first in Settings.");
    if (!to.trim()) return setMessage("Please enter a recipient email address.");
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const files = form.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0);
      const uploaded = await Promise.all(files.map((file) => emailApi.uploadAttachment(file)));
      let parsedVars = {};
      try {
        parsedVars = JSON.parse(variablesJson || "{}");
      } catch {
        parsedVars = {};
      }
      await emailApi.send({
        account_id: selectedAccount,
        to: [to.trim()],
        subject: subject.trim() || "No Subject",
        body_text: bodyText.trim(),
        body_html: "",
        template_version_id: selectedTemplateId || null,
        variables: parsedVars,
        attachment_ids: uploaded.map((x) => x.id),
        idempotency_key: crypto.randomUUID(),
      });
      setMessage("✓ Email queued successfully.");
      setTo("");
      setSubject("");
      setBodyText("");
      setSelectedTemplateId("");
      setVariablesJson("{}");
    } catch (err: any) {
      setMessage(`Failed: ${err.message || "Could not send email"}`);
    } finally {
      setBusy(false);
    }
  };
  const selectedTemplate = templates.find((t) => t.current_version_id === selectedTemplateId || t.id === selectedTemplateId);

  return (
    <form onSubmit={submit} className={`${CARD} space-y-5 p-5 sm:p-6`}>
      <div className="border-b border-sky-100 pb-4 dark:border-white/[0.06]">
        <h2 className="text-[17px] font-semibold text-[#0B1B3F] dark:text-white">Compose an email</h2>
        <p className="mt-0.5 text-[13px] text-[#6B7A99] dark:text-slate-400">Send an immediate 1-to-1 email or apply an approved template.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL}>From Account *</label>
          <select
            className={INPUT}
            disabled={!accounts.length}
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
          >
            {accounts.length === 0 ? (
              <option value="">No email accounts connected yet (go to Settings)</option>
            ) : (
              accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email_address} ({a.provider})
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className={LABEL}>Choose Template (Optional)</label>
          <select
            className={INPUT}
            value={selectedTemplateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
          >
            <option value="">Custom message (no template)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.current_version_id}>
                {t.name} ({t.category || "General"})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedTemplate && selectedTemplate.version && (
        <div className="rounded-xl bg-[#F4F9FF] p-3 text-xs text-[#28395E] ring-1 ring-sky-100 dark:bg-white/[0.03] dark:text-slate-300 dark:ring-white/[0.07]">
          <div className="mb-1 flex items-center justify-between font-semibold text-[#0F5FC4] dark:text-blue-300">
            <span>Template: {selectedTemplate.name}</span>
            {selectedTemplate.version.variables && selectedTemplate.version.variables.length > 0 && (
              <span className="rounded-md bg-[#E3EEFF] px-2 py-0.5 font-mono text-[11px] text-[#0F5FC4] dark:bg-blue-500/10 dark:text-blue-300">
                Variables: {selectedTemplate.version.variables.map((v) => `{{${v}}}`).join(", ")}
              </span>
            )}
          </div>
        </div>
      )}

      <div>
        <label className={LABEL}>Recipient Email *</label>
        <input
          name="to"
          type="email"
          required
          placeholder="applicant@example.com"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={INPUT}
        />
      </div>

      <div>
        <label className={LABEL}>Subject *</label>
        <input
          name="subject"
          required
          placeholder="Email Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={INPUT}
        />
      </div>

      {selectedTemplate?.version?.variables && selectedTemplate.version.variables.length > 0 && (
        <div>
          <label className={LABEL}>
            Template Variables (JSON)
          </label>
          <textarea
            name="variables"
            rows={2}
            value={variablesJson}
            onChange={(e) => setVariablesJson(e.target.value)}
            className={`${INPUT} font-mono text-xs`}
          />
        </div>
      )}

      <div>
        <label className={LABEL}>Message Body</label>
        <textarea
          name="body"
          rows={7}
          placeholder="Write your email body here..."
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          className={INPUT}
        />
      </div>

      <label className="block cursor-pointer rounded-xl border border-dashed border-sky-200 bg-[#F8FBFF] p-3 text-xs transition hover:border-[#137EFD] dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-[#137EFD]">
        <Paperclip className="mr-2 inline text-slate-400" size={16} />
        <span className="font-medium text-slate-700 dark:text-slate-300">Attachments</span>
        <input name="attachments" type="file" multiple className="ml-3 text-xs" />
      </label>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={busy || !accounts.length}
          className={BTN}
        >
          {busy ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
          Send Email
        </button>
        {message && (
          <p className={`text-xs font-medium ${message.startsWith("✓") ? "text-[#118A4B] dark:text-emerald-300" : "text-[#C42D52] dark:text-rose-300"}`}>
            {message}
          </p>
        )}
      </div>
    </form>
  );
}

export function TemplatesPage() {
  const [items, setItems] = useState<EmailTemplate[]>([]);
  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [preview, setPreview] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const load = () => emailApi.templates().then(setItems);
  useEffect(() => { void load(); }, []);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const p = { name: f.get("name"), category: f.get("category"), subject: f.get("subject"), body_text: f.get("body_text"), body_html: f.get("body_html") };
    setSaving(true);
    setNotice("");
    try {
      if (selected) await emailApi.updateTemplate(selected.id, p);
      else await emailApi.createTemplate(p);
    } catch (error) {
      // Show the server's reason (e.g. a name already in use) instead of a
      // generic message that sent people re-checking fields that were fine.
      setNotice(apiErrorDetail(error) || "The template couldn't be saved. Check the fields and try again.");
      setSaving(false);
      return;
    }
    setNotice(selected ? "New version saved." : "Template created.");
    setSelected(null);
    setPreview(null);
    setSaving(false);
    // The save already succeeded; a failed refresh must not report it as failed.
    await load().catch(() => setNotice("Template saved. Refresh the page to see it in the list."));
  };

  const runPreview = async (form: HTMLFormElement | null) => {
    if (!form) return;
    const f = new FormData(form);
    setPreview(await emailApi.previewTemplate({ subject: f.get("subject"), body_text: f.get("body_text") || "", body_html: f.get("body_html") || "", variables: {} }));
  };

  const k = selected?.id ?? "new";

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className={`${CARD} h-fit p-2`} aria-label="Templates">
        <button
          type="button"
          onClick={() => { setSelected(null); setPreview(null); setNotice(""); }}
          className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors ${!selected ? "bg-[#E3EEFF] text-[#0F5FC4] dark:bg-blue-500/10 dark:text-blue-300" : "text-[#137EFD] hover:bg-[#F4F9FF] dark:hover:bg-white/[0.04]"}`}
        >
          <Plus size={15} /> New template
        </button>
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-[#6B7A99] dark:text-slate-400">No templates yet. Create your first one.</p>
        ) : (
          <ul className="space-y-0.5">
            {items.map((t) => {
              const active = selected?.id === t.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    onClick={() => { setPreview(null); setNotice(""); emailApi.template(t.id).then(setSelected); }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#137EFD] ${active ? "bg-[#FFF0F3] dark:bg-rose-500/[0.08]" : "hover:bg-[#F4F9FF] dark:hover:bg-white/[0.04]"}`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-gradient-to-br from-[#ED5173] to-[#FF8A3D] text-white" : "bg-[#EEF3FB] text-[#6B7A99] dark:bg-white/[0.06] dark:text-slate-400"}`}>
                      <FileText size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-[#0B1B3F] dark:text-slate-200">{t.name}</span>
                      <span className="block truncate text-[11px] capitalize text-[#6B7A99] dark:text-slate-500">{t.category || "General"}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <form onSubmit={save} className={`${CARD} min-w-0 space-y-4 p-5 sm:p-6`}>
        <SectionHeader
          title={selected ? "Edit template" : "New template"}
          description={selected?.version ? `Version ${selected.version.version} · Variables: ${selected.version.variables.map((v) => `{{${v}}}`).join(", ") || "none"}` : "Use {{variable}} placeholders in the subject and body."}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={LABEL}>Template name<input name="name" key={k + "name"} defaultValue={selected?.name} required placeholder="e.g. Admission follow-up" className={INPUT} /></label>
          <label className={LABEL}>Category<input name="category" key={k + "category"} defaultValue={selected?.category || "general"} className={INPUT} /></label>
        </div>
        <label className={LABEL}>Subject<input name="subject" key={k + "subject"} defaultValue={selected?.version?.subject} required placeholder="Hi {{name}}, your application update" className={INPUT} /></label>
        <label className={LABEL}>Plain-text body<textarea name="body_text" key={k + "text"} defaultValue={selected?.version?.body_text} rows={8} className={INPUT} /></label>
        <label className={LABEL}>HTML body <span className="font-normal text-[#9AA8C2]">(optional)</span><textarea name="body_html" key={k + "html"} defaultValue={selected?.version?.body_html} rows={6} className={`${INPUT} font-mono text-xs`} /></label>
        <div className="flex flex-wrap items-center gap-2 border-t border-sky-100 pt-4 dark:border-white/[0.06]">
          <button type="submit" disabled={saving} className={BTN}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{selected ? "Save new version" : "Create template"}</button>
          <button type="button" onClick={(e) => runPreview(e.currentTarget.form)} className={BTN_SECONDARY}><Eye size={15} /> Preview</button>
          {selected && <button type="button" onClick={async () => { await emailApi.duplicateTemplate(selected.id); await load(); setNotice("Template duplicated."); }} className={BTN_SECONDARY}><Copy size={15} /> Duplicate</button>}
          {notice && <span className="text-[13px] text-[#6B7A99] dark:text-slate-400">{notice}</span>}
        </div>
        {preview && (
          <div className="rounded-xl bg-[#F4F9FF] p-4 ring-1 ring-sky-100 dark:bg-white/[0.03] dark:ring-white/[0.07]">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#6B7A99] dark:text-slate-500">Preview</p>
            {typeof preview.subject === "string" ? (
              <>
                <p className="text-[14px] font-semibold text-[#0B1B3F] dark:text-white">{preview.subject}</p>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[#28395E] dark:text-slate-300">{preview.body_text}</p>
              </>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-mono text-[12px] text-[#28395E] dark:text-slate-300">{JSON.stringify(preview, null, 2)}</pre>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
const BREVO = "brevo";

export function CampaignsPage() {
  const [items, setItems] = useState<Array<Record<string, any>>>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // FORM STATE
  const [campaignName, setCampaignName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  // A connected Gmail account id, or BREVO for a verified Brevo sender address.
  const [senderAccountId, setSenderAccountId] = useState("");
  const [manualRecipients, setManualRecipients] = useState("");
  const [stagedContacts, setStagedContacts] = useState<SelectedContact[]>([]);
  const [stagedFile, setStagedFile] = useState<File | null>(null);

  // TIMER / RUN SCHEDULE STATE
  const [scheduleMode, setScheduleMode] = useState<"now" | "timer">("now");
  const [scheduledFor, setScheduledFor] = useState("");

  const load = () => {
    emailApi.campaigns().then((x) => setItems(x.campaigns)).catch(() => {});
  };

  useEffect(() => {
    load();
    emailApi.templates().then(setTemplates).catch(() => {});
    emailApi.accounts().then((accs) => {
      setAccounts(accs);
      const gmail = accs.find((a) => a.provider === "google" && a.status === "connected");
      setSenderAccountId(gmail ? gmail.id : BREVO);
      if (gmail) setSenderName((name) => name || gmail.display_name || "");
    }).catch(() => setSenderAccountId(BREVO));
  }, []);

  const gmailAccounts = accounts.filter((a) => a.provider === "google");
  const sendingAccount = gmailAccounts.find((a) => a.id === senderAccountId);

  const totalSelectedRecipients = stagedContacts.length + (manualRecipients ? manualRecipients.split(/[\n,]/).filter((x) => x.trim().includes("@")).length : 0);

  const handleCreateAndRunCampaign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);

    try {
      if (!selectedTemplateId) {
        throw new Error("Please select an approved email template.");
      }
      if (sendingAccount && sendingAccount.status !== "connected") {
        throw new Error(`${sendingAccount.email_address} is not connected. Reconnect it in Email settings first.`);
      }
      if (!sendingAccount && !senderEmail.trim()) {
        throw new Error("Please enter the verified Brevo sender email.");
      }
      if (scheduleMode === "timer" && scheduledFor && new Date(scheduledFor).getTime() < Date.now()) {
        throw new Error("The scheduled time is in the past. Pick a later time or choose Send now.");
      }
      if (scheduleMode === "timer" && !scheduledFor) {
        throw new Error("Please pick a date and time for the scheduled timer.");
      }
      if (totalSelectedRecipients === 0 && !stagedFile) {
        throw new Error("Please select recipients from Leads, Students, or upload an Excel sheet.");
      }

      // 1. CREATE CAMPAIGN DRAFT
      const campaign: any = await emailApi.createCampaign({
        name: campaignName.trim(),
        template_version_id: selectedTemplateId,
        sender_name: senderName.trim() || "VoiceDots Mailer",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(sendingAccount
          ? { transport: "gmail", email_account_id: sendingAccount.id }
          : { transport: "brevo", sender_email: senderEmail.trim() }),
      });

      // 2. ADD RECIPIENTS FROM LEADS / STUDENTS / MANUAL
      const recipients: Array<Record<string, any>> = [];

      stagedContacts.forEach((sc) => {
        if (sc.destination && sc.destination.includes("@")) {
          recipients.push({
            email: sc.destination.trim(),
            variables: {
              name: sc.name || "Recipient",
              ...(sc.extra || {}),
            },
            lead_reference: sc.extra?.lead_id || sc.extra?.roll_number || undefined,
          });
        }
      });

      if (manualRecipients.trim()) {
        const lines = manualRecipients.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
        lines.forEach((email) => {
          if (email.includes("@")) {
            recipients.push({
              email,
              variables: { name: email.split("@")[0] },
            });
          }
        });
      }

      if (recipients.length > 0) {
        await emailApi.addCampaignRecipients(campaign.id, recipients);
      }

      // 3. UPLOAD SHEET IF STAGED
      if (stagedFile) {
        await emailApi.uploadRecipients(campaign.id, stagedFile);
      }

      // 4. SCHEDULE TIMER OR SEND IMMEDIATELY
      const targetTime =
        scheduleMode === "timer" && scheduledFor
          ? new Date(scheduledFor).toISOString()
          : new Date().toISOString();

      let result: { queued?: number; skipped?: number; missing_variables?: string[] };
      try {
        result = await emailApi.scheduleCampaign(campaign.id, targetTime);
      } catch (err) {
        await load();
        throw new Error(`${apiErrorDetail(err) || "The campaign couldn't be scheduled."} It was saved as a draft.`);
      }
      const via = sendingAccount ? ` from ${sendingAccount.email_address}` : "";
      const skipped = result?.skipped
        ? ` ${result.skipped} recipient(s) were skipped because they have no value for ${(result.missing_variables || []).map((v) => `{{${v}}}`).join(", ") || "the template variables"}.`
        : "";
      setNotice(
        (scheduleMode === "timer"
          ? `Campaign scheduled${via} for ${new Date(targetTime).toLocaleString()}.`
          : `Campaign is sending${via}.`) + skipped
      );

      // Reset form
      setCampaignName("");
      setStagedContacts([]);
      setStagedFile(null);
      setManualRecipients("");
      setScheduledFor("");
      await load();
    } catch (err: any) {
      console.error(err);
      setError(apiErrorDetail(err) || err.message || "Failed to create campaign.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold text-[#0B1B3F] dark:text-white">
            Email Campaigns
          </h2>
          <p className="mt-0.5 text-[13px] text-[#6B7A99] dark:text-slate-400">
            Schedule and dispatch template campaigns to Leads, registered college students, or uploaded contact lists.
          </p>
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl bg-[#DDF7E8] px-4 py-3 text-[13px] font-medium text-[#0E6E3C] ring-1 ring-[#B5EBCB] dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-[#FDE4EA] px-4 py-3 text-[13px] font-medium text-[#A62146] ring-1 ring-[#F7C3D0] dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* NEW CAMPAIGN FORM */}
      <form onSubmit={handleCreateAndRunCampaign} className={`${CARD} space-y-5 p-5 sm:p-6`}>
        <h3 className="text-[16px] font-semibold text-[#0B1B3F] dark:text-white">
          New Email Campaign
        </h3>

        {/* STEP 1: CAMPAIGN DETAILS & SENDER */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>
              Campaign Name *
            </label>
            <input
              required
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. Campus Placement Drive Reminder"
              className={INPUT}
            />
          </div>

          <div>
            <label className={LABEL}>
              Email Template *
            </label>
            <select
              required
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className={INPUT}
            >
              <option value="">Choose an email template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.current_version_id}>
                  {t.name} ({t.category || "General"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL}>
              Sender Name *
            </label>
            <input
              required
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Verified Sender Name (e.g. Placement Cell)"
              className={INPUT}
            />
          </div>

          <div>
            <label className={LABEL}>
              Send From *
            </label>
            <select
              value={senderAccountId}
              onChange={(e) => {
                setSenderAccountId(e.target.value);
                const acc = gmailAccounts.find((a) => a.id === e.target.value);
                if (acc?.display_name) setSenderName(acc.display_name);
              }}
              className={INPUT}
            >
              {gmailAccounts.map((a) => (
                <option key={a.id} value={a.id} disabled={a.status !== "connected"}>
                  {a.email_address} (Gmail{a.status !== "connected" ? ` – ${a.status}, reconnect in Settings` : ""})
                </option>
              ))}
              <option value={BREVO}>Other verified sender (Brevo)</option>
            </select>
            {senderAccountId === BREVO && (
              <input
                type="email"
                required
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="Sender email verified in Brevo"
                className={`${INPUT} mt-2`}
              />
            )}
            {!gmailAccounts.length && (
              <p className="mt-1 text-[11px] text-[#6B7A99] dark:text-slate-400">
                Connect a Gmail account in Email settings to send campaigns from it.
              </p>
            )}
          </div>
        </div>

        {/* TEMPLATE PREVIEW BANNER */}
        {(() => {
          const tpl = templates.find((t) => t.current_version_id === selectedTemplateId || t.id === selectedTemplateId);
          if (!tpl || !tpl.version) return null;
          return (
            <div className="rounded-xl bg-[#F4F9FF] p-4 text-xs text-[#28395E] ring-1 ring-sky-100 dark:bg-white/[0.03] dark:text-slate-300 dark:ring-white/[0.07]">
              <div className="mb-2 flex items-center justify-between font-semibold text-[#0F5FC4] dark:text-blue-300">
                <span>Selected Template: {tpl.name} ({tpl.category})</span>
                {tpl.version.variables && tpl.version.variables.length > 0 && (
                  <span className="rounded-md bg-[#E3EEFF] px-2 py-0.5 font-mono text-[11px] text-[#0F5FC4] dark:bg-blue-500/10 dark:text-blue-300">
                    Variables: {tpl.version.variables.map((v) => `{{${v}}}`).join(", ")}
                  </span>
                )}
              </div>
              <div className="font-medium text-slate-900 dark:text-slate-100">
                <span className="text-slate-500">Subject:</span> {tpl.version.subject}
              </div>
              <p className="mt-1.5 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white/70 p-2 text-slate-600 dark:bg-black/20 dark:text-slate-400">
                {tpl.version.body_text}
              </p>
            </div>
          );
        })()}

        {/* STEP 2: AUDIENCE SELECTOR (LEADS, COLLEGE STUDENTS BY DEGREE/BRANCH, UPLOAD EXCEL SHEET) */}
        <div className="pt-2">
          <label className="mb-2 block text-[12px] font-medium text-[#55648A] dark:text-slate-400">
            Whom to Send (Audience Target)
          </label>
          <CampaignAudienceSelector
            channel="email"
            busy={busy}
            onAddContacts={async (contacts) => {
              setStagedContacts((prev) => {
                const map = new Map(prev.map((c) => [c.destination.toLowerCase(), c]));
                contacts.forEach((c) => {
                  if (c.destination) map.set(c.destination.toLowerCase(), c);
                });
                return Array.from(map.values());
              });
            }}
            onUploadFile={async (file) => {
              setStagedFile(file);
            }}
          />
        </div>

        {/* AUDIENCE STAGING SUMMARY */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F4F9FF] p-4 text-xs ring-1 ring-sky-100 dark:bg-white/[0.03] dark:ring-white/[0.07]">
          <div>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Selected Audience Total:
            </span>{" "}
            <span className="font-semibold text-[#0F5FC4] dark:text-blue-300">
              {stagedContacts.length} contact(s) staged
            </span>
            {stagedFile && (
              <span className="ml-2 font-medium text-emerald-700 dark:text-emerald-400">
                + Uploaded Sheet: {stagedFile.name}
              </span>
            )}
          </div>
          {stagedContacts.length > 0 && (
            <button
              type="button"
              onClick={() => setStagedContacts([])}
              className="text-xs text-rose-600 hover:underline"
            >
              Clear Selected Audience
            </button>
          )}
        </div>

        {/* MANUAL EMAIL PASTE (FALLBACK) */}
        <details className="rounded-xl p-3 text-xs ring-1 ring-sky-100 dark:ring-white/[0.07]">
          <summary className="cursor-pointer font-medium text-slate-600 dark:text-slate-400">
            Or type/paste raw emails manually
          </summary>
          <textarea
            rows={3}
            value={manualRecipients}
            onChange={(e) => setManualRecipients(e.target.value)}
            placeholder="john@example.com, jane@example.com, or one email per line"
            className={`${INPUT} mt-2`}
          />
        </details>

        {/* STEP 3: CAMPAIGN TIMER & SCHEDULE */}
        <div className="space-y-3 rounded-xl bg-[#F4F9FF] p-4 ring-1 ring-sky-100 dark:bg-white/[0.03] dark:ring-white/[0.07]">
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
            Campaign Timer & Delivery Schedule
          </label>
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="email-schedule-mode"
                checked={scheduleMode === "now"}
                onChange={() => setScheduleMode("now")}
                className="accent-[#137EFD]"
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">Send Immediately</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="email-schedule-mode"
                checked={scheduleMode === "timer"}
                onChange={() => setScheduleMode("timer")}
                className="accent-[#137EFD]"
              />
              <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                <Clock size={14} /> Run on Timer (Schedule Date & Time)
              </span>
            </label>
          </div>

          {scheduleMode === "timer" && (
            <div className="space-y-1.5 pt-1">
              <label className="block text-[11px] font-medium text-slate-500">
                Select Date and Time to run email campaign:
              </label>
              <input
                type="datetime-local"
                required={scheduleMode === "timer"}
                value={scheduledFor}
                min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                onChange={(e) => setScheduledFor(e.target.value)}
                className={`${INPUT} max-w-sm dark:[color-scheme:dark]`}
              />
              <p className="text-[10px] text-slate-400">
                Emails will be rendered with personal template variables and sent automatically when the timer reaches this time.
              </p>
            </div>
          )}
        </div>

        {/* SUBMIT BUTTON */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={busy || !campaignName.trim() || !selectedTemplateId || (totalSelectedRecipients === 0 && !stagedFile)}
            className={BTN}
          >
            {busy ? (
              <Loader2 className="animate-spin" size={16} />
            ) : scheduleMode === "timer" ? (
              <Calendar size={16} />
            ) : (
              <MailPlus size={16} />
            )}
            {scheduleMode === "timer" ? "Schedule Email Campaign Timer" : "Launch Email Campaign Now"}
            {totalSelectedRecipients > 0 ? ` (${totalSelectedRecipients} recipients)` : ""}
          </button>
        </div>
      </form>

      {/* RECENT CAMPAIGNS LIST */}
      <div className="space-y-3">
        <h3 className="text-[16px] font-semibold text-[#0B1B3F] dark:text-white">
          Recent Email Campaigns
        </h3>
        {items.length === 0 ? (
          <div className={`${CARD} p-8 text-center text-[13px] text-[#6B7A99] dark:text-slate-400`}>
            No email campaigns created yet.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((c) => (
              <div
                key={c.id}
                className={`${CARD} flex flex-col justify-between p-4`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-[#0B1B3F] dark:text-white">
                      {c.name}
                    </h4>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        c.status === "scheduled"
                          ? "bg-[#FFF1DA] text-[#A86A00] dark:bg-amber-500/10 dark:text-amber-300"
                          : c.status === "running"
                          ? "bg-[#E3EEFF] text-[#0F5FC4] dark:bg-blue-500/10 dark:text-blue-300"
                          : c.status === "completed"
                          ? "bg-[#DDF7E8] text-[#118A4B] dark:bg-emerald-500/10 dark:text-emerald-300"
                          : "bg-[#EEF3FB] text-[#55648A] dark:bg-white/[0.06] dark:text-slate-300"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#6B7A99] dark:text-slate-400">
                    Sender: <span className="font-medium text-slate-700 dark:text-slate-300">{c.sender_email}</span>
                  </p>
                  {c.scheduled_for && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                      <Clock size={12} />
                      Scheduled for: {new Date(c.scheduled_for).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-sky-100 pt-3 text-[11px] text-[#6B7A99] dark:border-white/[0.06] dark:text-slate-400">
                  <span>Transport: Brevo</span>
                  <div className="flex gap-2">
                    {c.status === "scheduled" && (
                      <button
                        type="button"
                        onClick={async () => {
                          await emailApi.transitionCampaign(c.id, "cancel");
                          load();
                        }}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm(`Delete campaign "${c.name}"?`)) {
                          await emailApi.deleteCampaign(c.id);
                          load();
                        }
                      }}
                      className="text-slate-400 hover:text-rose-600"
                      title="Delete Campaign"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
export function AutomationsPage() {
  return <Empty icon={Sparkles} title="No email automations yet" text="Automations will send a template after a trigger — like a call ending — with an optional condition and delay." />;
}

export function EmailSettingsPage() {
  const [accounts, setAccounts] = useState<EmailAccount[] | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const load = () => emailApi.accounts().then(setAccounts).catch(() => setAccounts([]));
  useEffect(() => { void load(); }, []);
  const connect = async (provider: "google" | "microsoft") => {
    const result = await emailApi.connect(provider);
    window.location.assign(result.authorization_url);
  };

  if (accounts === null) return <div className={`${CARD} flex items-center justify-center gap-2 py-20 text-[13px] text-[#6B7A99] dark:text-slate-400`}><Loader2 size={18} className="animate-spin text-[#ED5173]" /> Loading accounts…</div>;

  if (!accounts.length) {
    return (
      <Empty icon={Link2} title="No Gmail account connected" text="Connect your mailbox securely with Google sign-in. VoiceDots never sees your password.">
        <button type="button" onClick={() => connect("google")} className={BTN}><Link2 size={15} /> Connect Gmail</button>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((a) => {
        const ok = a.status === "connected";
        return (
          <div key={a.id} className={`${CARD} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between`}>
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ED5173] to-[#FF8A3D] text-white"><Inbox size={20} /></span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-[#0B1B3F] dark:text-white">{a.email_address}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-[#6B7A99] dark:text-slate-400">
                  <span className={`inline-flex items-center gap-1.5 font-semibold capitalize ${ok ? "text-[#118A4B] dark:text-emerald-300" : "text-[#A86A00] dark:text-amber-300"}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />{a.status}
                  </span>
                  {a.last_sync_at && <span>· Last synced {when(a.last_sync_at)}</span>}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ok ? (
                <>
                  <button type="button" disabled={syncing === a.id} onClick={async () => { setSyncing(a.id); try { await emailApi.sync(a.id); await load(); } finally { setSyncing(null); } }} className={BTN_SECONDARY}>
                    <RefreshCw size={14} className={syncing === a.id ? "animate-spin" : ""} /> Sync now
                  </button>
                  <button type="button" onClick={async () => { await emailApi.disconnect(a.id); load(); }} className={BTN_DANGER}>Disconnect</button>
                </>
              ) : (
                <button type="button" onClick={async () => { const result = await emailApi.reconnect(a.id); window.location.assign(result.authorization_url); }} className={BTN}>
                  <Link2 size={15} /> Reconnect Gmail
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
