import { useEffect, useState } from "react";
import { Inbox, MailPlus, Send, Sparkles, Link2, Loader2, Paperclip, RefreshCw, Clock, Calendar, Users, GraduationCap, CheckCircle2, Trash2, AlertCircle } from "lucide-react";
import CampaignAudienceSelector, { type SelectedContact } from "@/components/campaigns/CampaignAudienceSelector";
import emailApi, { type EmailAccount, type EmailTemplate, type EmailThread, type EmailThreadDetail } from "@/api/emailApi";

type ThreadResponse = { threads: EmailThread[] };

function Empty({ icon: Icon, title, text }: { icon: typeof Inbox; title: string; text: string }) {
  return <div className="rounded-2xl border border-dashed border-violet-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900"><Icon className="mx-auto text-indigo-600" size={30} /><h2 className="mt-4 font-bold">{title}</h2><p className="mt-2 text-sm text-slate-500">{text}</p></div>;
}

export function InboxPage() {
  const [state, setState] = useState<ThreadResponse | null>(null);
  const [selected, setSelected] = useState<EmailThreadDetail | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => { emailApi.threads().then(setState).catch(() => setState({ threads: [] })); }, []);
  if (!state) return <Empty icon={Loader2} title="Loading inbox" text="Your connected mailbox is being prepared." />;
  if (!state.threads?.length) return <Empty icon={Inbox} title="No conversations yet" text="Connect an account or sync your mailbox to see conversations." />;
  return <div className="grid gap-5 lg:grid-cols-[320px_1fr]"><div className="rounded-2xl border bg-white dark:border-slate-800 dark:bg-slate-900">{state.threads.map((x) => <button type="button" onClick={() => emailApi.thread(x.id).then(setSelected)} key={x.id} className="block w-full border-b p-4 text-left last:border-0 dark:border-slate-800"><b>{x.subject || "(No subject)"}</b><p className="text-xs text-slate-500">{x.participants?.join(", ")} · {x.unread_count} unread</p></button>)}</div>{selected ? <div className="space-y-4 rounded-2xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="font-bold">{selected.subject || "(No subject)"}</h2>{selected.messages.map(item => <article key={item.id} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><div className="mb-2 text-xs text-slate-500">{item.from} · {item.status}</div><div className="whitespace-pre-wrap text-sm">{item.body_text}</div></article>)}<form onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); await emailApi.reply(selected.id, { body_text: form.get("body"), body_html: "", idempotency_key: crypto.randomUUID(), attachment_ids: [] }); setNotice("Reply queued."); event.currentTarget.reset(); }} className="space-y-3"><textarea name="body" required rows={5} placeholder="Reply" className="w-full rounded-xl border p-3"/><button className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white">Reply</button>{notice && <span className="ml-3 text-sm text-slate-500">{notice}</span>}</form></div> : <Empty icon={Inbox} title="Select a conversation" text="Choose a thread to view messages and reply." />}</div>;
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
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-violet-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b pb-3 dark:border-slate-800">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Compose Single Email</h2>
        <p className="text-xs text-slate-500">Send an immediate 1-to-1 email or apply an approved template.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">From Account *</label>
          <select
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
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
          <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Choose Template (Optional)</label>
          <select
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
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
        <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
          <div className="mb-1 flex items-center justify-between font-semibold text-indigo-700 dark:text-indigo-400">
            <span>Template: {selectedTemplate.name}</span>
            {selectedTemplate.version.variables && selectedTemplate.version.variables.length > 0 && (
              <span className="rounded bg-indigo-100 px-2 py-0.5 text-[11px] text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                Variables: {selectedTemplate.version.variables.map((v) => `{{${v}}}`).join(", ")}
              </span>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Recipient Email *</label>
        <input
          name="to"
          type="email"
          required
          placeholder="applicant@example.com"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Subject *</label>
        <input
          name="subject"
          required
          placeholder="Email Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
        />
      </div>

      {selectedTemplate?.version?.variables && selectedTemplate.version.variables.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Template Variables (JSON)
          </label>
          <textarea
            name="variables"
            rows={2}
            value={variablesJson}
            onChange={(e) => setVariablesJson(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Message Body</label>
        <textarea
          name="body"
          rows={7}
          placeholder="Write your email body here..."
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
        />
      </div>

      <label className="block cursor-pointer rounded-xl border border-dashed border-slate-300 p-3 text-xs hover:border-indigo-400 dark:border-slate-700">
        <Paperclip className="mr-2 inline text-slate-400" size={16} />
        <span className="font-medium text-slate-700 dark:text-slate-300">Attachments</span>
        <input name="attachments" type="file" multiple className="ml-3 text-xs" />
      </label>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={busy || !accounts.length}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
          Send Email
        </button>
        {message && (
          <p className={`text-xs font-medium ${message.startsWith("✓") ? "text-emerald-600" : "text-rose-600"}`}>
            {message}
          </p>
        )}
      </div>
    </form>
  );
}

export function TemplatesPage() { const [items,setItems]=useState<EmailTemplate[]>([]); const [selected,setSelected]=useState<EmailTemplate|null>(null); const [preview,setPreview]=useState<Record<string,string>|null>(null); const load=()=>emailApi.templates().then(setItems); useEffect(()=>{void load()},[]); const save=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const p={name:f.get("name"),category:f.get("category"),subject:f.get("subject"),body_text:f.get("body_text"),body_html:f.get("body_html")}; if (selected) await emailApi.updateTemplate(selected.id,p); else await emailApi.createTemplate(p);setSelected(null);await load()}; return <div className="grid gap-5 lg:grid-cols-[300px_1fr]"><div className="space-y-2">{items.map(t=><button key={t.id} onClick={()=>emailApi.template(t.id).then(setSelected)} className="block w-full rounded-xl border bg-white p-4 text-left"><b>{t.name}</b><p className="text-xs text-slate-500">{t.category}</p></button>)}</div><form onSubmit={save} className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-bold">{selected?"Edit template":"New template"}</h2><input name="name" key={selected?.id+"name"} defaultValue={selected?.name} required placeholder="Template name" className="w-full rounded-xl border p-3"/><input name="category" key={selected?.id+"category"} defaultValue={selected?.category||"general"} className="w-full rounded-xl border p-3"/><input name="subject" key={selected?.id+"subject"} defaultValue={selected?.version?.subject} required placeholder="Subject with {{variables}}" className="w-full rounded-xl border p-3"/><textarea name="body_text" key={selected?.id+"text"} defaultValue={selected?.version?.body_text} rows={8} className="w-full rounded-xl border p-3"/><textarea name="body_html" key={selected?.id+"html"} defaultValue={selected?.version?.body_html} rows={8} className="w-full rounded-xl border p-3 font-mono text-sm"/><div className="flex gap-2"><button className="rounded-xl bg-indigo-600 px-4 py-2 text-white">Save version</button>{selected&&<button type="button" onClick={async()=>{await emailApi.duplicateTemplate(selected.id);await load()}} className="rounded-xl border px-4 py-2">Duplicate</button>}<button type="button" onClick={async()=>setPreview(await emailApi.previewTemplate({subject:new FormData(document.querySelector('form')!).get('subject'),body_text:"",body_html:"",variables:{}}))} className="rounded-xl border px-4 py-2">Preview</button></div>{selected?.version&&<p className="text-xs text-slate-500">Version {selected.version.version} · Variables: {selected.version.variables.join(", ")||"none"}</p>}{preview&&<pre>{JSON.stringify(preview,null,2)}</pre>}</form></div> }
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
      if (accs.length > 0 && !senderEmail) {
        setSenderEmail(accs[0].email_address);
        setSenderName(accs[0].display_name || "VoiceDots Mailer");
      }
    }).catch(() => {});
  }, []);

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
      if (!senderEmail.trim()) {
        throw new Error("Please enter a verified sender email.");
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
        sender_email: senderEmail.trim(),
        sender_name: senderName.trim() || "VoiceDots Mailer",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        transport: "brevo",
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

      await emailApi.scheduleCampaign(campaign.id, targetTime);

      setNotice(
        scheduleMode === "timer"
          ? `Campaign scheduled successfully with timer for ${new Date(targetTime).toLocaleString()}.`
          : "Campaign scheduled and launched successfully."
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
      setError(err?.response?.data?.detail || err.message || "Failed to create campaign.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Email Campaigns
          </h2>
          <p className="text-xs text-slate-500">
            Schedule and dispatch template campaigns to Leads, registered college students, or uploaded contact lists.
          </p>
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-4 text-xs font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* NEW CAMPAIGN FORM */}
      <form onSubmit={handleCreateAndRunCampaign} className="space-y-5 rounded-2xl border border-violet-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
          New Email Campaign
        </h3>

        {/* STEP 1: CAMPAIGN DETAILS & SENDER */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Campaign Name *
            </label>
            <input
              required
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. Campus Placement Drive Reminder"
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Email Template *
            </label>
            <select
              required
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
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
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Sender Name *
            </label>
            <input
              required
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Verified Sender Name (e.g. Placement Cell)"
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Sender Email *
            </label>
            <input
              type="email"
              required
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="Verified Brevo/Gmail sender email"
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </div>

        {/* TEMPLATE PREVIEW BANNER */}
        {(() => {
          const tpl = templates.find((t) => t.current_version_id === selectedTemplateId || t.id === selectedTemplateId);
          if (!tpl || !tpl.version) return null;
          return (
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
              <div className="mb-2 flex items-center justify-between font-semibold text-indigo-700 dark:text-indigo-400">
                <span>Selected Template: {tpl.name} ({tpl.category})</span>
                {tpl.version.variables && tpl.version.variables.length > 0 && (
                  <span className="rounded bg-indigo-100 px-2 py-0.5 text-[11px] text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                    Variables: {tpl.version.variables.map((v) => `{{${v}}}`).join(", ")}
                  </span>
                )}
              </div>
              <div className="font-medium text-slate-900 dark:text-slate-100">
                <span className="text-slate-500">Subject:</span> {tpl.version.subject}
              </div>
              <p className="mt-1.5 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white/70 p-2 text-slate-600 dark:bg-slate-900/60 dark:text-slate-400">
                {tpl.version.body_text}
              </p>
            </div>
          );
        })()}

        {/* STEP 2: AUDIENCE SELECTOR (LEADS, COLLEGE STUDENTS BY DEGREE/BRANCH, UPLOAD EXCEL SHEET) */}
        <div className="pt-2">
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-violet-50/60 p-4 text-xs dark:bg-slate-950">
          <div>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Selected Audience Total:
            </span>{" "}
            <span className="font-bold text-indigo-700 dark:text-indigo-300">
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
        <details className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
          <summary className="cursor-pointer font-medium text-slate-600 dark:text-slate-400">
            Or type/paste raw emails manually
          </summary>
          <textarea
            rows={3}
            value={manualRecipients}
            onChange={(e) => setManualRecipients(e.target.value)}
            placeholder="john@example.com, jane@example.com, or one email per line"
            className="mt-2 w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
          />
        </details>

        {/* STEP 3: CAMPAIGN TIMER & SCHEDULE */}
        <div className="space-y-3 rounded-xl border border-violet-100 bg-violet-50/20 p-4 dark:border-slate-800 dark:bg-slate-950/40">
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
                className="text-indigo-600"
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">Send Immediately</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="email-schedule-mode"
                checked={scheduleMode === "timer"}
                onChange={() => setScheduleMode("timer")}
                className="text-indigo-600"
              />
              <span className="flex items-center gap-1 font-semibold text-indigo-700 dark:text-indigo-300">
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
                className="w-full max-w-sm rounded-xl border border-slate-300 bg-white p-2.5 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
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
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
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
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          Recent Email Campaigns
        </h3>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800">
            No email campaigns created yet.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((c) => (
              <div
                key={c.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-slate-900 dark:text-slate-100">
                      {c.name}
                    </h4>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        c.status === "scheduled"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : c.status === "running"
                          ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                          : c.status === "completed"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Sender: <span className="font-medium text-slate-700 dark:text-slate-300">{c.sender_email}</span>
                  </p>
                  {c.scheduled_for && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                      <Clock size={12} />
                      Scheduled for: {new Date(c.scheduled_for).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800">
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
export function AutomationsPage() { return <Empty icon={Sparkles} title="No Email automations" text="Build a trigger, condition, delay and template-based action." />; }

export function EmailSettingsPage() {
  const [accounts, setAccounts] = useState<EmailAccount[] | null>(null); const load = () => emailApi.accounts().then(setAccounts).catch(() => setAccounts([])); useEffect(() => { void load(); }, []);
  const connect = async (provider: "google" | "microsoft") => { const result = await emailApi.connect(provider); window.location.assign(result.authorization_url); };
  return <div className="space-y-5"><div className="flex flex-wrap gap-3">{!accounts?.length && <button onClick={() => connect("google")} className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white"><Link2 className="mr-2 inline" size={16} />Connect Gmail</button>}</div>{!accounts?.length ? <Empty icon={Link2} title="No Gmail account connected" text="Connect the pilot Gmail mailbox securely using OAuth. VoiceDots never receives your password." /> : accounts.map(a => <div key={a.id} className="flex items-center justify-between rounded-2xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div><b>{a.email_address}</b><p className="text-xs capitalize text-slate-500">Gmail · {a.status}{a.last_sync_at ? ` · synced ${new Date(a.last_sync_at).toLocaleString()}` : ""}</p></div><div className="flex gap-3">{a.status === "connected" ? <><button onClick={async () => { await emailApi.sync(a.id); }} className="text-sm font-semibold text-indigo-600"><RefreshCw className="mr-1 inline" size={14}/>Sync</button><button onClick={async () => { await emailApi.disconnect(a.id); load(); }} className="text-sm font-semibold text-red-600">Disconnect</button></> : <button onClick={async () => { const result = await emailApi.reconnect(a.id); window.location.assign(result.authorization_url); }} className="text-sm font-semibold text-indigo-600">Reconnect Gmail</button>}</div></div>)}</div>;
}
