import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  Check,
  CheckCheck,
  Download,
  Eye,
  FileSpreadsheet,
  Loader2,
  Megaphone,
  Plus,
  Rocket,
  Send,
  Smartphone,
  Trash2,
  Upload,
  Clock,
  Calendar,
  UserCheck,
  GraduationCap,
  Users,
  Search,
  CheckSquare,
  Square,
  Filter,
  X,
} from "lucide-react";
import type {
  Account,
  Analytics,
  Binding,
  Campaign,
  Contact,
  Preview,
  Template,
  UploadResult,
} from "@/api/whatsapp";
import { whatsappApi as api } from "@/api/whatsapp";
import leadsApi from "@/api/leads";
import { collegeApi } from "@/api/collegeApi";
import { MediaHeaderPicker } from "./SlotInputs";
import TemplatePreview from "./TemplatePreview";
import { structureOf } from "./templateRules";
import {
  card,
  input,
  button,
  secondary,
  consent,
  emptyPage,
  errorText,
} from "./shared";
import { Field, Badge, Pager, TemplateSelect } from "./WhatsAppUi";
import Messages from "./MessagesTab";
import CampaignAudienceSelector, { type SelectedContact } from "@/components/campaigns/CampaignAudienceSelector";

const label = "text-[10px] font-medium uppercase tracking-wider text-[#6B7A99]";
/** A datetime-local value in the viewer's own time zone. toISOString() is UTC,
 *  which let IST users pick a time up to 5½ hours in the past (sent at once). */
const localInputValue = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const earliestSchedule = () => localInputValue(new Date(Date.now() + 60000));
const rate = (value?: number | null) => (value == null ? "—" : `${value}%`);
function csvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
function SampleDownload({
  template,
  mapping,
}: {
  template?: Template;
  mapping: Record<string, Binding>;
}) {
  const download = () => {
    const structure = template ? structureOf(template) : undefined;
    const used = new Set(["name", "phone"]);
    const extra = (template?.slot_fields || [])
      .filter((field) => field.kind === "text")
      .map((field, position) => {
        const mapped = mapping[field.slot];
        const fallback = field.label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "") || `value_${position + 1}`;
        let name = mapped?.source === "field" && mapped.value.trim()
          ? mapped.value.trim()
          : fallback;
        if (used.has(name)) name = `${name}_${position + 1}`;
        used.add(name);
        const example = field.section === "header"
          ? structure?.header.example
          : field.section === "body"
            ? structure?.examples[(field.index || 1) - 1]
            : "Example value";
        return { name, example: example || "Example value" };
      });
    const columns = ["name", "phone", ...extra.map((field) => field.name)];
    const values = [
      "Student Name",
      "+919999999999",
      ...extra.map((field) => field.example),
    ];
    const url = URL.createObjectURL(
      new Blob(
        [`\ufeff${columns.map(csvCell).join(",")}\n${values.map(csvCell).join(",")}\n`],
        { type: "text/csv" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template?.name || "whatsapp-contacts"}-sample.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex items-center gap-1 text-xs font-medium text-[#137EFD] dark:text-[#5AB8FF]"
    >
      <Download size={13} />
      Download {template ? "template CSV" : "sample CSV"}
    </button>
  );
}
export default function Campaigns({
  account,
  templates,
  notify,
}: {
  account: Account;
  templates: Template[];
  notify: (s: string) => void;
}) {
  const [campaigns, setCampaigns] = useState(emptyPage<Campaign>()),
    [analytics, setAnalytics] = useState<Analytics>(),
    [offset, setOffset] = useState(0),
    [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(""),
    [creating, setCreating] = useState(true),
    [name, setName] = useState(""),
    [templateId, setTemplateId] = useState(""),
    [timerInput, setTimerInput] = useState(""),
    [busy, setBusy] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"now" | "timer">("now");
  const [scheduledTime, setScheduledTime] = useState("");
  const [stagedContacts, setStagedContacts] = useState<SelectedContact[]>([]);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [manualNumbers, setManualNumbers] = useState("");

  const selectedTemplate = templates.find((t) => t.id === templateId);
  // Templates with variables need each one mapped to a sheet column or a fixed
  // value before /start can render the messages. The quick form has no mapping
  // step, so those campaigns continue in the editor at "Template & mapping".
  const needsMapping = (selectedTemplate?.slot_fields || []).length > 0;

  const handleCreateAndLaunchCampaign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      notify("Please enter a campaign name.");
      return;
    }
    if (!templateId) {
      notify("Please select an approved WhatsApp template.");
      return;
    }
    if (scheduleMode === "timer" && !scheduledTime) {
      notify("Please pick a date and time for the scheduled timer.");
      return;
    }

    const manualList = manualNumbers
      .split(/[\n,]/)
      .map((x) => x.trim())
      .filter((x) => x.length >= 7);
    const totalRecipients = stagedContacts.length + manualList.length;

    if (totalRecipients === 0 && !stagedFile) {
      notify("Please select recipients from Leads, Students, or upload an Excel sheet.");
      return;
    }

    const targetTime =
      scheduleMode === "timer" && scheduledTime
        ? new Date(scheduledTime).toISOString()
        : undefined;
    if (targetTime && new Date(targetTime).getTime() <= Date.now()) {
      notify("The scheduled time has already passed. Pick a time in the future.");
      return;
    }

    const resetForm = () => {
      setName("");
      setTemplateId("");
      setStagedContacts([]);
      setStagedFile(null);
      setManualNumbers("");
      setScheduledTime("");
      setScheduleMode("now");
    };
    // Hand the draft to the editor below, which opens at the first unfinished
    // step (mapping, preview or launch) and keeps the chosen time.
    const continueInEditor = async (campaignId: string, message: string) => {
      resetForm();
      setCreating(false);
      setSelected(campaignId);
      notify(message);
      await load().catch(() => undefined);
      window.setTimeout(() => editor.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    };

    setBusy(true);
    let created: Campaign | undefined;
    try {
      // 1. Create campaign draft
      const c = await api.saveCampaign({
        account_id: account.id,
        name: name.trim(),
        template_id: templateId,
        mapping: {},
        scheduled_at: targetTime,
      });
      created = c;

      // 2. Add staged contacts (Leads + College students + Manual numbers)
      const contactsToAdd = [
        ...stagedContacts.map((sc) => ({
          contact_name: sc.name || "Recipient",
          destination: sc.destination.trim(),
          extra: sc.extra || {},
        })),
        ...manualList.map((num) => ({
          contact_name: "Recipient",
          destination: num,
          extra: {},
        })),
      ];

      if (contactsToAdd.length > 0) {
        await api.addContacts(c.id, contactsToAdd);
      }

      // 3. Upload Excel / CSV file if staged
      if (stagedFile) {
        await api.upload(c.id, stagedFile);
      }

      if (needsMapping) {
        await continueInEditor(
          c.id,
          `Recipients added to "${c.name}". Map the template's variables below, then preview and ${targetTime ? "schedule" : "send"}.`,
        );
        return;
      }

      // 4. Start / Schedule campaign
      await api.start(c.id, consent, targetTime);

      notify(
        targetTime
          ? `Campaign "${c.name}" scheduled for ${new Date(targetTime).toLocaleString()}.`
          : `Campaign "${c.name}" launched successfully.`
      );
      resetForm();
      setSelected(c.id);
      await load();
    } catch (error) {
      if (created) {
        // The draft exists; open it so the problem can be fixed there rather
        // than leaving it to be found later under Drafts.
        await continueInEditor(created.id, `${errorText(error)} The campaign was saved as a draft and is open below.`);
      } else {
        notify(errorText(error));
      }
    } finally {
      setBusy(false);
    }
  };
  const editor = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    const [list, totals] = await Promise.all([
      api.campaigns(account.id, offset, filter),
      api.analytics(account.id),
    ]);
    setCampaigns(list);
    setAnalytics(totals);
  }, [account.id, offset, filter]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [list, totals] = await Promise.all([
          api.campaigns(account.id, offset, filter),
          api.analytics(account.id),
        ]);
        if (active) {
          setCampaigns(list);
          setAnalytics(totals);
        }
      } catch (e) {
        if (active) notify(errorText(e));
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [account.id, offset, filter, notify]);
  return (
    <div className="space-y-7">
      <section
        className={`${card} flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6`}
      >
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-[#EAF3FF] p-3 text-[#137EFD] dark:bg-indigo-950 dark:text-[#5AB8FF]">
            <Megaphone size={23} />
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              WhatsApp Campaigns
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#6B7A99]">
              Send personalized template messages to your applicants and
              students.
            </p>
          </div>
        </div>
        <button
          className={button}
          onClick={() => {
            setCreating(true);
            setSelected("");
          }}
        >
          <Plus size={16} />
          New campaign
        </button>
      </section>
      <div ref={editor}>
        {creating && (
          <section className={`${card} space-y-6 p-6`}>
            <div className="flex items-center justify-between border-b pb-4 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-[#0B1B3F] dark:text-slate-100">
                  New WhatsApp Campaign
                </h3>
                <p className="text-xs text-[#6B7A99]">
                  Target Leads, registered college students by branch/class, or upload an Excel sheet.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close campaign setup"
                onClick={() => setCreating(false)}
                className="rounded-lg p-1.5 hover:bg-[#EEF3FB] dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAndLaunchCampaign} className="space-y-6">
              {/* CAMPAIGN DETAILS */}
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Campaign Name *">
                  <input
                    required
                    maxLength={255}
                    className={input}
                    placeholder="e.g. Mechanical Engg 2026 Batch Alert"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>

                <div>
                  <Field label="WhatsApp Template *">
                    <TemplateSelect
                      templates={templates}
                      value={templateId}
                      change={setTemplateId}
                    />
                  </Field>
                </div>
              </div>

              {/* TEMPLATE PREVIEW BANNER */}
              {selectedTemplate && (
                <div className="rounded-xl border border-sky-200 bg-[#EAF3FF] p-3.5 text-xs text-[#33415F] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                  <div className="mb-1 flex items-center justify-between font-semibold text-[#137EFD] dark:text-[#5AB8FF]">
                    <span>Template: {selectedTemplate.name} ({selectedTemplate.category})</span>
                    <Badge value={selectedTemplate.status} />
                  </div>
                  <p className="whitespace-pre-wrap">{selectedTemplate.body}</p>
                </div>
              )}

              {/* WHOM TO SEND (AUDIENCE TARGET) */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6B7A99]">
                  WHOM TO SEND (AUDIENCE TARGET)
                </label>

                <CampaignAudienceSelector
                  channel="whatsapp"
                  busy={busy}
                  onAddContacts={async (newContacts) => {
                    setStagedContacts((prev) => {
                      const map = new Map(prev.map((c) => [c.destination.toLowerCase(), c]));
                      newContacts.forEach((c) => {
                        if (c.destination) map.set(c.destination.toLowerCase(), c);
                      });
                      return Array.from(map.values());
                    });
                  }}
                  onUploadFile={async (file) => {
                    setStagedFile(file);
                  }}
                />

                {/* STAGED RECIPIENTS SUMMARY BADGE */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-[#EAF3FF] p-3 text-xs dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#137EFD] dark:text-[#5AB8FF]">
                      Selected Audience Total:
                    </span>
                    <span className="rounded-full bg-[#EAF3FF] px-2.5 py-0.5 font-bold text-[#0B1B3F] dark:bg-indigo-950 dark:text-[#5AB8FF]">
                      {stagedContacts.length + (manualNumbers ? manualNumbers.split(/[\n,]/).filter((x) => x.trim().length >= 7).length : 0)} contact(s) staged
                    </span>
                    {stagedFile && (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        📄 Sheet: {stagedFile.name}
                      </span>
                    )}
                  </div>
                  {(stagedContacts.length > 0 || stagedFile) && (
                    <button
                      type="button"
                      onClick={() => {
                        setStagedContacts([]);
                        setStagedFile(null);
                      }}
                      className="text-xs text-rose-600 hover:underline"
                    >
                      Clear Selected Audience
                    </button>
                  )}
                </div>

                {/* MANUAL NUMBERS ACCORDION */}
                <details className="rounded-xl border border-sky-100 p-3 text-xs dark:border-slate-800">
                  <summary className="cursor-pointer font-medium text-[#6B7A99] hover:text-[#137EFD] dark:text-[#9AA8C2]">
                    ▸ Or type/paste raw phone numbers manually
                  </summary>
                  <div className="mt-3 space-y-2">
                    <textarea
                      rows={3}
                      value={manualNumbers}
                      onChange={(e) => setManualNumbers(e.target.value)}
                      placeholder="+919876543210, +919812345678 (comma or line separated)"
                      className="w-full rounded-xl border border-sky-100 bg-white p-3 font-mono text-xs outline-none focus:border-[#137EFD] dark:border-slate-800 dark:bg-slate-900"
                    />
                    <p className="text-[10px] text-[#9AA8C2]">
                      Include country code (+91 for India) for all phone numbers.
                    </p>
                  </div>
                </details>
              </div>

              {/* CAMPAIGN TIMER & DELIVERY SCHEDULE */}
              <div className="space-y-3 rounded-2xl border border-sky-100 bg-[#F4F9FF] p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <p className="text-xs font-semibold text-[#0B1B3F] dark:text-slate-200">
                  Campaign Timer & Delivery Schedule
                </p>
                <div className="flex flex-wrap items-center gap-6 text-xs">
                  <label className="flex cursor-pointer items-center gap-2 font-medium">
                    <input
                      type="radio"
                      name="campaign-timer-mode"
                      checked={scheduleMode === "now"}
                      onChange={() => setScheduleMode("now")}
                      className="text-[#137EFD]"
                    />
                    <span>Send Immediately</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 font-medium text-[#137EFD] dark:text-[#5AB8FF]">
                    <input
                      type="radio"
                      name="campaign-timer-mode"
                      checked={scheduleMode === "timer"}
                      onChange={() => setScheduleMode("timer")}
                      className="text-[#137EFD]"
                    />
                    <Clock size={14} />
                    <span>Run on Timer (Schedule Date & Time)</span>
                  </label>
                </div>

                {scheduleMode === "timer" && (
                  <div className="max-w-md space-y-1.5 pt-2">
                    <label className="block text-[11px] font-medium text-[#6B7A99]">
                      Select campaign run date & time:
                    </label>
                    <input
                      type="datetime-local"
                      required={scheduleMode === "timer"}
                      value={scheduledTime}
                      min={earliestSchedule()}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full rounded-xl border border-sky-100 bg-white p-2.5 text-xs outline-none focus:border-[#137EFD] dark:border-slate-700 dark:bg-slate-900"
                    />
                    <p className="text-[10px] text-[#9AA8C2]">
                      The campaign will be queued and sent out automatically at this scheduled time.
                    </p>
                  </div>
                )}
              </div>

              {/* LAUNCH BUTTON */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <button
                  type="submit"
                  disabled={busy || !templateId || !name.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#137EFD] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0F6AD8] disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : needsMapping ? (
                    <ArrowRightLeft size={16} />
                  ) : scheduleMode === "timer" ? (
                    <Clock size={16} />
                  ) : (
                    <Send size={16} />
                  )}
                  {needsMapping
                    ? "Add recipients & map variables"
                    : scheduleMode === "timer"
                      ? "Schedule WhatsApp Campaign with Timer"
                      : "Launch WhatsApp Campaign Now"}
                  {stagedContacts.length > 0 && ` (${stagedContacts.length} recipients)`}
                </button>

                <p className="text-[11px] text-[#9AA8C2]">
                  {needsMapping && "This template has variables, so you'll map them next, then preview and launch. "}
                  Messages use your connected WhatsApp Business sender. Meta delivery limits apply.
                </p>
              </div>
            </form>
          </section>
        )}
        {selected && (
          <CampaignEditor
            key={selected}
            id={selected}
            account={account}
            templates={templates}
            notify={notify}
            onChange={load}
          />
        )}
      </div>
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Recent campaigns & delivery analytics
            </h2>
            <p className="mt-1 text-xs text-[#6B7A99]">
              Provider-reported delivery and read receipts across your
              campaigns.
            </p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-full bg-[#EAF3FF] p-1 dark:bg-slate-900">
            {[
              ["all", "All"],
              ["completed", "Completed"],
              ["running", "In progress"],
              ["scheduled", "Scheduled"],
              ["draft", "Drafts"],
            ].map(([key, title]) => (
              <button
                key={key}
                onClick={() => {
                  setFilter(key);
                  setOffset(0);
                }}
                aria-pressed={filter === key}
                className={`rounded-full px-3 py-1.5 text-xs ${filter === key ? "bg-white font-semibold text-[#137EFD] shadow-sm dark:bg-[#137EFD] dark:text-white" : "text-[#6B7A99]"}`}
              >
                {title}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Messages sent",
              value: analytics?.sent.toLocaleString() ?? "—",
              icon: Send,
              color: "text-[#137EFD]",
            },
            {
              title: "Delivery rate",
              value: rate(analytics?.delivery_rate),
              icon: CheckCheck,
              color: "text-emerald-700",
            },
            {
              title: "Read rate",
              value: rate(analytics?.read_rate),
              icon: Eye,
              color: "text-[#137EFD]",
            },
          ].map(({ title, value, icon: Icon, color }) => (
            <div
              key={title}
              className={`${card} flex items-center justify-between p-5`}
            >
              <div>
                <p className={label}>{title}</p>
                <p
                  className={`mt-2 text-2xl font-semibold ${color} dark:text-[#5AB8FF]`}
                >
                  {value}
                </p>
              </div>
              <span className="rounded-full bg-[#EAF3FF] p-3 text-[#137EFD] dark:bg-indigo-950">
                <Icon size={18} />
              </span>
            </div>
          ))}
        </div>
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead className="bg-[#EAF3FF] dark:bg-slate-950">
                <tr>
                  {[
                    "Campaign name",
                    "Template",
                    "Audience",
                    "Sent",
                    "Delivered",
                    "Read",
                    "Failed",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-4 text-[10px] font-medium uppercase tracking-wider text-[#6B7A99]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.items.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-t border-violet-50 dark:border-slate-800 ${selected === c.id ? "bg-[#EAF3FF] dark:bg-indigo-950/20" : ""}`}
                  >
                    <td className="max-w-[260px] px-4 py-5">
                      <button
                        className="flex items-center gap-2 text-left font-medium hover:text-[#137EFD]"
                        onClick={() => {
                          setSelected(c.id);
                          setCreating(false);
                          editor.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }}
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#137EFD]" />
                        {c.name}
                      </button>
                    </td>
                    <td className="max-w-[160px] px-4 py-5">
                      <span className="break-words rounded bg-[#EAF3FF] px-1.5 py-1 text-[11px] dark:bg-indigo-950">
                        {c.template_name ||
                          templates.find((t) => t.id === c.template_id)?.name ||
                          "Template"}
                      </span>
                    </td>
                    <td className="px-4">{c.total_contacts}</td>
                    <td className="px-4">{c.sent ?? 0}</td>
                    <td className="min-w-[105px] px-4">
                      <Metric count={c.delivered ?? 0} percentage={c.delivery_rate} />
                    </td>
                    <td className="min-w-[105px] px-4">
                      <Metric count={c.read ?? 0} percentage={c.read_rate} />
                    </td>
                    <td className="px-4 text-rose-600">{c.failed ?? 0}</td>
                    <td className="px-4">
                      <div className="space-y-1">
                        <Badge value={c.status} />
                        {c.scheduled_for && (
                          <div className="flex items-center gap-1 text-[10px] text-[#137EFD] dark:text-[#5AB8FF]">
                            <Clock size={11} />
                            <span>{new Date(c.scheduled_for).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        aria-label={`Delete ${c.name}`}
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Delete “${c.name}” and all of its messages and contacts? This cannot be undone.`,
                            )
                          )
                            return;
                          try {
                            await api.deleteCampaign(c.id);
                            if (selected === c.id) setSelected("");
                            notify("Campaign deleted.");
                            await load();
                          } catch (error) {
                            notify(errorText(error));
                          }
                        }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!campaigns.total && (
              <div className="p-12 text-center">
                <Megaphone className="mx-auto mb-3 text-[#5AB8FF]" size={30} />
                <p className="font-medium">
                  {filter === "all"
                    ? "Your first campaign starts here"
                    : "No campaigns in this view"}
                </p>
                <p className="mt-2 text-sm text-[#6B7A99]">
                  Create a draft to add recipients, map your template, and
                  preview messages.
                </p>
              </div>
            )}
          </div>
          <Pager
            total={campaigns.total}
            offset={offset}
            size={30}
            change={setOffset}
          />
        </div>
        <p className="text-[11px] text-[#9AA8C2]">
          Delivery rate = delivered ÷ sent. Read rate = read ÷ delivered.
          Accepted messages are awaiting a sent receipt; read receipts may be
          unavailable.
        </p>
      </section>
    </div>
  );
}
function Metric({
  count,
  percentage,
}: {
  count: number;
  percentage?: number | null;
}) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between gap-2 text-xs">
        <span>{count}</span>
        <span className="text-[10px] text-[#9AA8C2]">{rate(percentage)}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-[#EAF3FF] dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-[#137EFD]"
          style={{ width: `${percentage ?? 0}%` }}
        />
      </div>
    </div>
  );
}
function CampaignEditor({
  id,
  account,
  templates,
  notify,
  onChange,
}: {
  id: string;
  account: Account;
  templates: Template[];
  notify: (s: string) => void;
  onChange: () => Promise<void>;
}) {
  const [campaign, setCampaign] = useState<Campaign>(),
    [contacts, setContacts] = useState(emptyPage<Contact>()),
    [offset, setOffset] = useState(0);
  const [name, setName] = useState(""),
    [templateId, setTemplateId] = useState(""),
    [timerInput, setTimerInput] = useState(""),
    [mapping, setMapping] = useState<Record<string, Binding>>({});
  const [preview, setPreview] = useState<Preview>(),
    [result, setResult] = useState<UploadResult>(),
    [consented, setConsented] = useState(false),
    [busy, setBusy] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"now" | "timer">("now");
  const [scheduledTime, setScheduledTime] = useState("");
  const [file, setFile] = useState<File | null>(null),
    [filename, setFilename] = useState(""),
    [manualName, setManualName] = useState(""),
    [number, setNumber] = useState(""),
    [extra, setExtra] = useState<Record<string, string>>({});
  const audienceRef = useRef<HTMLElement>(null),
    mappingRef = useRef<HTMLElement>(null),
    previewRef = useRef<HTMLElement>(null),
    launchRef = useRef<HTMLElement>(null);
  const load = useCallback(async () => {
    const [c, rows] = await Promise.all([
      api.campaign(id),
      api.contacts(id, offset),
    ]);
    setCampaign(c);
    setContacts(rows);
  }, [id, offset]);
  useEffect(() => {
    let active = true;
    api
      .campaign(id)
      .then((c) => {
        if (active) {
          setName(c.name);
          setTemplateId(c.template_id);
          setMapping(c.mapping);
          // A draft created with a timer keeps that time, so finishing it
          // here schedules it rather than silently sending it now.
          const when = c.status === "draft" && c.scheduled_for ? new Date(c.scheduled_for) : null;
          if (when && when.getTime() > Date.now()) {
            setScheduleMode("timer");
            setScheduledTime(localInputValue(when));
          }
        }
      })
      .catch((e) => notify(errorText(e)));
    return () => {
      active = false;
    };
  }, [id, notify]);
  useEffect(() => {
    void load().catch((e) => notify(errorText(e)));
  }, [load, notify]);
  useEffect(() => {
    if (campaign?.status !== "running") return;
    const timer = window.setInterval(() => {
      void load().catch((e) => notify(errorText(e)));
    }, 3000);
    return () => window.clearInterval(timer);
  }, [campaign?.status, load, notify]);
  const action = async (work: () => Promise<unknown>, message?: string) => {
    setBusy(true);
    try {
      await work();
      await load();
      await onChange();
      if (message) notify(message);
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const invalidate = () => {
    setPreview(undefined);
    setConsented(false);
  };
  const save = () =>
    api.saveCampaign(
      { account_id: account.id, name, template_id: templateId, mapping },
      id,
    );
  const template = templates.find((t) => t.id === templateId);
  const fields = [
    ...new Set([
      "name",
      "phone",
      ...(contacts.fields || []),
      ...contacts.items.flatMap((c) => Object.keys(c.extra)),
    ]),
  ];
  const manualFields = [
    ...new Set(
      Object.values(mapping)
        .filter(
          (b) =>
            b.source === "field" &&
            !["name", "contact_name", "phone"].includes(b.value),
        )
        .map((b) => b.value),
    ),
  ];
  if (!campaign)
    return (
      <section className={`${card} p-8 text-sm text-[#6B7A99]`}>
        Loading campaign…
      </section>
    );
  const draft = campaign.status === "draft";
  const mapped =
    !!template &&
    (template.slot_fields || []).every((f) => mapping[f.slot]?.value.trim());
  const step = !draft
    ? 4
    : preview && !preview.rejected_count
      ? 3
      : !campaign.total_contacts
        ? 0
        : !mapped
          ? 1
          : 2;
  const steps = [
    { name: "Audience", ref: audienceRef },
    { name: "Template & mapping", ref: mappingRef },
    { name: "Preview", ref: previewRef },
    { name: "Confirm", ref: launchRef },
    { name: "Launch", ref: launchRef },
  ];
  return (
    <div className="space-y-5">
      <nav
        aria-label="Campaign setup progress"
        className={`${card} flex items-center gap-2 overflow-x-auto px-5 py-5 sm:justify-between`}
      >
        {steps.map((s, i) => (
          <button
            key={s.name}
            onClick={() =>
              s.ref.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
            className="flex shrink-0 items-center gap-2 text-left"
            aria-current={step === i ? "step" : undefined}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs ${i < step ? "bg-[#EAF3FF] text-[#137EFD] dark:bg-indigo-950 dark:text-[#5AB8FF]" : i === step ? "bg-[#137EFD] text-white shadow-md" : "bg-[#EAF3FF] text-[#9AA8C2] dark:bg-slate-800"}`}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </span>
            <span>
              <span className="block text-xs font-medium">{s.name}</span>
              <span
                className={`text-[9px] uppercase tracking-wider ${i === step ? "text-[#137EFD] dark:text-[#5AB8FF]" : "text-[#9AA8C2]"}`}
              >
                {i < step
                  ? "Complete"
                  : i === step
                    ? draft
                      ? "Current step"
                      : campaign.status
                    : "Pending"}
              </span>
            </span>
          </button>
        ))}
      </nav>
      {!draft ? (
        <section className={`${card} space-y-4 p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{campaign.name}</h3>
              <p className="mt-1 text-sm text-[#6B7A99]">
                {campaign.total_contacts} recipients ·{" "}
                {campaign.progress_percent}% processed
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge value={campaign.status} />
              <button
                className={secondary}
                onClick={() => action(() => api.report(id))}
              >
                <Download size={14} />
                Download report
              </button>
              {campaign.status === "running" && (
                <button
                  disabled={busy}
                  className={secondary}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Cancel remaining unsent messages? Messages already submitted cannot be recalled.",
                      )
                    )
                      void action(
                        () => api.cancel(id),
                        "Remaining messages cancelled.",
                      );
                  }}
                >
                  Cancel campaign
                </button>
              )}
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#EAF3FF] dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-[#137EFD]"
              style={{ width: `${campaign.progress_percent}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(campaign.counts).map(([s, n]) => (
              <span key={s} className="text-xs">
                <Badge value={s} /> {n}
              </span>
            ))}
            {/* FIXED: Removed stray /> here */}
          </div>
          <p className="text-xs text-[#9AA8C2]">
            Submission progress is separate from delivery. Receipts continue
            updating after the campaign finishes.
          </p>
        </section>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.9fr)]">
          <div className="min-w-0 space-y-5">
            <section
              ref={audienceRef}
              className={`${card} scroll-mt-24 space-y-5 p-5 sm:p-6`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-[#EAF3FF] p-2 text-[#137EFD] dark:bg-indigo-950">
                    <FileSpreadsheet size={20} />
                  </span>
                  <div>
                    <p className={label}>
                      {result ? "Latest import" : "Campaign audience"}
                    </p>
                    <p className="mt-1 max-w-[260px] truncate text-sm font-medium">
                      {filename || "Add your recipient list"}
                    </p>
                  </div>
                </div>
                <SampleDownload template={template} mapping={mapping} />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  {
                    title: result ? "Rows reviewed" : "Saved audience",
                    value: result?.total_rows ?? campaign.total_contacts,
                    tone: "bg-[#EAF3FF] dark:bg-slate-800",
                  },
                  {
                    title: result ? "Accepted" : "Recipients",
                    value: result?.accepted ?? campaign.total_contacts,
                    tone: "bg-[#EAF3FF] text-[#0B1B3F] dark:bg-indigo-950 dark:text-[#5AB8FF]",
                  },
                  {
                    title: "Rejected",
                    value: result?.invalid_count ?? "—",
                    tone: result?.invalid_count
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                      : "bg-[#EAF3FF] dark:bg-slate-800",
                  },
                  {
                    title: "Duplicates",
                    value: result?.duplicate_count ?? "—",
                    tone: "bg-[#EAF3FF] dark:bg-slate-800",
                  },
                ].map((stat) => (
                  <div
                    key={stat.title}
                    className={`rounded-lg p-3 ${stat.tone}`}
                  >
                    <p className="text-[9px] uppercase tracking-wider">
                      {stat.title}
                    </p>
                    <p className="mt-2 text-xl font-semibold">{stat.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <CampaignAudienceSelector
                  channel="whatsapp"
                  busy={busy}
                  onAddContacts={async (selectedContacts) => {
                    await action(async () => {
                      const contactsToAdd = selectedContacts.map((s) => ({
                        contact_name: s.name,
                        destination: s.destination,
                        extra: s.extra || {},
                      }));
                      const r = await api.addContacts(id, contactsToAdd);
                      setResult(r);
                      setFilename(`Imported ${selectedContacts.length} contacts`);
                      invalidate();
                    }, `Added ${selectedContacts.length} recipients`);
                  }}
                  onUploadFile={async (uploadedFile) => {
                    await action(async () => {
                      const r = await api.upload(id, uploadedFile);
                      setResult(r);
                      setFilename(uploadedFile.name);
                      invalidate();
                    });
                  }}
                />
              </div>
              <details className="rounded-xl border border-sky-200 p-4 dark:border-slate-800">
                <summary className="cursor-pointer text-sm font-medium">
                  Add a recipient manually
                </summary>
                <form
                  className="mt-4 space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(async () => {
                      setResult(
                        await api.addContacts(id, [
                          {
                            contact_name: manualName,
                            destination: number,
                            extra,
                          },
                        ]),
                      );
                      setFilename("Manual recipient entry");
                      setNumber("");
                      setManualName("");
                      setExtra({});
                      invalidate();
                    });
                  }}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Student name">
                      <input
                        className={input}
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                      />
                    </Field>
                    <Field label="WhatsApp number">
                      <input
                        required
                        type="tel"
                        className={input}
                        placeholder="+91…"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                      />
                    </Field>
                    {manualFields.map((f) => (
                      <Field key={f} label={f}>
                        <input
                          className={input}
                          value={extra[f] || ""}
                          onChange={(e) =>
                            setExtra({ ...extra, [f]: e.target.value })
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  <button className={secondary} disabled={busy || !number}>
                    <Plus size={14} />
                    Add recipient
                  </button>
                </form>
              </details>
              {result && (
                <div role="status" className="text-xs text-[#6B7A99]">
                  {result.accepted} added · {result.rejected_count} rejected
                  {result.rejected.length > 0 && (
                    <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-rose-600">
                      {result.rejected.map((r, i) => (
                        <li key={i}>
                          Row {r.row}: {r.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <details>
                <summary className="cursor-pointer text-xs font-medium text-[#137EFD] dark:text-[#5AB8FF]">
                  Review {campaign.total_contacts} saved recipients
                </summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr>
                        <th className="p-2 font-medium text-[#6B7A99]">Name</th>
                        <th className="p-2 font-medium text-[#6B7A99]">
                          Number
                        </th>
                        <th>
                          <span className="sr-only">Remove</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.items.map((c) => (
                        <tr
                          key={c.id}
                          className="border-t border-violet-50 dark:border-slate-800"
                        >
                          <td className="p-2">{c.contact_name || "—"}</td>
                          <td className="p-2">{c.destination}</td>
                          <td className="p-2">
                            <button
                              aria-label={`Remove ${c.contact_name || c.destination}`}
                              disabled={busy}
                              onClick={() =>
                                action(async () => {
                                  await api.removeContact(id, c.id);
                                  invalidate();
                                })
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager
                  offset={offset}
                  total={contacts.total}
                  change={setOffset}
                />
              </details>
              <p className="text-[10px] text-[#9AA8C2]">
                Use country codes for international numbers. Bare 10-digit
                numbers use +91.
              </p>
            </section>
            <section
              ref={mappingRef}
              className={`${card} scroll-mt-24 space-y-5 p-5 sm:p-6`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-[#EAF3FF] px-2 py-1 text-[10px] text-[#137EFD] dark:bg-indigo-950 dark:text-[#5AB8FF]">
                  {template?.category || "TEMPLATE"}
                </span>
                {template && <Badge value={template.status} />}
              </div>

              <TemplateSelect
                templates={templates}
                value={templateId}
                change={(v) => {
                  setTemplateId(v);
                  setMapping({});
                  invalidate();
                }}
              />

              <div className="rounded-xl bg-[#EAF3FF] p-4 dark:bg-slate-950">
                <p className={label}>Template message</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#6B7A99] dark:text-slate-300">
                  {template?.body || "Select a template to begin."}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Data association</h3>
                <p className="mt-1 text-xs text-[#6B7A99]">
                  Only what this template requires is shown. Match each to a CSV
                  column or a fixed value.
                </p>
              </div>
              {(["header", "body", "button"] as const).map((section) => {
                const group = (template?.slot_fields || []).filter(
                  (f) => f.section === section,
                );
                if (!group.length) return null;
                return (
                  <div key={section} className="space-y-2">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7A99]">
                      {section}
                    </h4>
                    {group.map((field) =>
                      field.kind === "media" ? (
                        <div
                          key={field.slot}
                          className="rounded-xl bg-[#EAF3FF] p-3 dark:bg-slate-950"
                        >
                          <p className="mb-2 text-xs font-medium">
                            {field.label} — one file for the whole campaign
                          </p>
                          <MediaHeaderPicker
                            account={account}
                            format={field.media_format}
                            value={mapping[field.slot]?.value || ""}
                            change={(v) => {
                              setMapping({
                                ...mapping,
                                [field.slot]: { source: "media", value: v },
                              });
                              invalidate();
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          key={field.slot}
                          className="grid items-center gap-2 rounded-xl bg-[#EAF3FF] p-3 sm:grid-cols-[120px_20px_1fr] dark:bg-slate-950"
                        >
                          <code className="break-all text-xs text-[#137EFD] dark:text-[#5AB8FF]">
                            {field.label}
                          </code>
                          <ArrowRightLeft
                            size={13}
                            className="hidden text-[#9AA8C2] sm:block"
                          />
                          <div className="grid min-w-0 grid-cols-[105px_1fr] gap-2">
                            <select
                              aria-label={`Source for ${field.label}`}
                              className={`${input} !mt-0 !px-2 !py-2 text-xs`}
                              value={mapping[field.slot]?.source || "field"}
                              onChange={(e) => {
                                setMapping({
                                  ...mapping,
                                  [field.slot]: {
                                    source: e.target.value as "field" | "fixed",
                                    value: "",
                                  },
                                });
                                invalidate();
                              }}
                            >
                              <option value="field">CSV column</option>
                              <option value="fixed">Fixed value</option>
                            </select>
                            <input
                              aria-label={`Value for ${field.label}`}
                              list={`columns-${id}`}
                              className={`${input} !mt-0 min-w-0 !px-2 !py-2 text-xs`}
                              placeholder={
                                mapping[field.slot]?.source === "fixed"
                                  ? "Enter value"
                                  : "Select a column"
                              }
                              value={mapping[field.slot]?.value || ""}
                              onChange={(e) => {
                                setMapping({
                                  ...mapping,
                                  [field.slot]: {
                                    source:
                                      mapping[field.slot]?.source || "field",
                                    value: e.target.value,
                                  },
                                });
                                invalidate();
                              }}
                            /> {/* FIXED: Added missing / here */}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                );
              })}
              {template && !(template.slot_fields || []).length && (
                <p className="rounded-xl bg-[#EAF3FF] p-3 text-xs text-[#6B7A99] dark:bg-slate-950 dark:text-slate-300">
                  This template does not require any variable mapping.
                </p>
              )}
              <datalist id={`columns-${id}`}>
                {fields.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={busy || !templateId || !mapped}
                  className={secondary}
                  onClick={() => action(save, "Draft settings saved.")}
                >
                  Save mapping
                </button>
                <button
                  disabled={busy || !campaign.total_contacts || !mapped}
                  className={button}
                  onClick={() =>
                    action(async () => {
                      await save();
                      setPreview(await api.preview(id));
                    })
                  }
                >
                  {busy ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Eye size={15} />
                  )}
                  Validate & preview
                </button>
              </div>
            </section>
          </div>
          <div className="min-w-0 space-y-5">
            <section
              ref={previewRef}
              className={`${card} scroll-mt-24 p-5 sm:p-6`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Smartphone size={17} className="text-emerald-600" />
                  Recipient previews
                </h3>
                <span className="rounded-full bg-[#EAF3FF] px-2 py-1 text-[9px] text-[#6B7A99] dark:bg-slate-800">
                  {preview
                    ? `${preview.previews.length} of ${preview.total}`
                    : "Awaiting validation"}
                </span>
              </div>
              {template && (
                <div className="mt-4 grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_260px]">
                  <dl className="space-y-1.5 text-xs">
                    <div className="flex gap-2">
                      <dt className="text-[#9AA8C2]">Template</dt>
                      <dd className="font-medium">{template.name}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-[#9AA8C2]">Recipients</dt>
                      <dd className="font-medium">
                        {preview ? preview.valid : (result?.accepted ?? 0)}
                      </dd>
                    </div>
                    {(template.slot_fields || []).length ? (
                      (template.slot_fields || []).map((f) => (
                        <div key={f.slot} className="flex gap-2">
                          <dt className="text-[#9AA8C2]">{f.label}</dt>
                          <dd className="font-medium">
                            →{" "}
                            {mapping[f.slot]?.source === "media"
                              ? "uploaded file"
                              : mapping[f.slot]?.value || "not mapped"}
                          </dd>
                        </div>
                      ))
                    ) : (
                      <div className="text-[#6B7A99]">
                        This template does not require variable mapping.
                      </div>
                    )}
                  </dl>
                  <TemplatePreview
                    draft={structureOf(template)}
                    templateId={template.id}
                  />
                </div>
              )}
              {preview ? (
                <>
                  <div className="mt-4 max-h-[600px] space-y-3 overflow-y-auto">
                    {preview.previews.map((p) => (
                      <article
                        key={p.destination}
                        className="rounded-xl bg-[#F4F9FF] p-3 dark:bg-slate-950"
                      >
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium">
                            {p.contact_name || "Recipient"}
                          </span>
                          <span className="text-[10px] text-[#9AA8C2]">
                            {p.destination}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-xs leading-relaxed text-[#6B7A99] dark:bg-slate-800 dark:text-slate-200">
                          {p.body}
                        </p>
                        <p className="mt-2 text-right text-[9px] text-[#9AA8C2]">
                          Preview · not sent
                        </p>
                      </article>
                    ))}
                  </div>
                  <p className="mt-4 text-[11px] text-[#6B7A99]">
                    All {preview.total} recipients validated. Showing up to 10
                    previews.
                  </p>
                  {preview.rejected_count > 0 && (
                    <div
                      role="alert"
                      className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                    >
                      <strong>
                        {preview.rejected_count} recipients need attention
                      </strong>
                      <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
                        {preview.rejected.map((r) => (
                          <li key={r.destination}>
                            {r.destination}: {r.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-12 text-center">
                  <Smartphone
                    size={30}
                    className="mx-auto mb-3 text-indigo-200"
                  /> {/* FIXED: Added missing / here */}
                  <p className="text-sm font-medium">
                    See exactly what you’ll send
                  </p>
                  <p className="mx-auto mt-2 max-w-[220px] text-xs leading-relaxed text-[#9AA8C2]">
                    Add recipients and map your variables, then validate to
                    generate personalized previews.
                  </p>
                </div>
              )}
            </section>
            <section
              ref={launchRef}
              className={`${card} scroll-mt-24 space-y-5 p-5 sm:p-6`}
            >
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Rocket size={18} className="text-[#137EFD]" />
                Campaign confirmation
              </h3>
              <Field label="Campaign name">
                <input
                  className={input}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    invalidate();
                  }}
                  />
  
              </Field>
              <dl className="space-y-3 rounded-xl bg-[#EAF3FF] p-4 text-xs dark:bg-slate-950">
                <div className="flex justify-between gap-3">
                  <dt className="text-[#6B7A99]">Saved recipients</dt>
                  <dd className="font-semibold">{campaign.total_contacts}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#6B7A99]">Ready to send</dt>
                  <dd className="font-semibold text-[#137EFD] dark:text-[#5AB8FF]">
                    {preview ? preview.valid : "Validate first"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#6B7A99]">Sending method</dt>
                  <dd>Queued delivery</dd>
                </div>
              </dl>

              {/* CAMPAIGN TIMER / RUN SCHEDULE */}
              <div className="space-y-3 rounded-xl border border-sky-200 bg-[#EAF3FF] p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-xs font-semibold text-[#0B1B3F] dark:text-slate-200">
                  Campaign Timer & Schedule
                </p>
                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name={`campaign-schedule-${id}`}
                      checked={scheduleMode === "now"}
                      onChange={() => setScheduleMode("now")}
                      className="text-[#137EFD]"
                    />
                    <span>Run Immediately</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name={`campaign-schedule-${id}`}
                      checked={scheduleMode === "timer"}
                      onChange={() => setScheduleMode("timer")}
                      className="text-[#137EFD]"
                    />
                    <span className="flex items-center gap-1 font-medium text-[#137EFD] dark:text-[#5AB8FF]">
                      <Clock size={13} /> Schedule with Timer
                    </span>
                  </label>
                </div>
                {scheduleMode === "timer" && (
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-[11px] font-medium text-[#6B7A99]">
                      Run campaign at date & time:
                    </label>
                    <input
                      type="datetime-local"
                      required={scheduleMode === "timer"}
                      value={scheduledTime}
                      min={earliestSchedule()}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full rounded-xl border border-sky-100 bg-white p-2.5 text-xs outline-none focus:border-[#137EFD] dark:border-slate-700 dark:bg-slate-900"
                    />
                    <p className="text-[10px] text-[#9AA8C2]">
                      The campaign will be queued and sent out automatically at this scheduled time.
                    </p>
                  </div>
                )}
              </div>

              <label className="flex items-start gap-2.5 text-xs leading-relaxed text-[#6B7A99] dark:text-slate-300">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={consented}
                  onChange={(e) => setConsented(e.target.checked)}
                /> {/* FIXED: Closed input tag */}
                {consent} {/* FIXED: Moved text outside input */}
              </label>
              <button
                className={`${button} w-full`}
                disabled={
                  busy ||
                  !account.ready ||
                  !consented ||
                  !preview?.valid ||
                  !!preview.rejected_count
                }
                onClick={() =>
                  action(
                    () =>
                      api.start(
                        id,
                        consent,
                        scheduleMode === "timer" && scheduledTime
                          ? new Date(scheduledTime).toISOString()
                          : undefined,
                      ),
                    scheduleMode === "timer" && scheduledTime
                      ? `Campaign scheduled for ${new Date(scheduledTime).toLocaleString()}.`
                      : "Campaign queued for sending.",
                  )
                }
              >
                <Send size={15} />
                Send campaign
                {preview?.valid ? ` (${preview.valid} recipients)` : ""}
              </button>
              <p className="text-[10px] leading-relaxed text-[#9AA8C2]">
                Messages use your connected sender. Provider limits apply;
                delivery is tracked after submission.
              </p>
            </section>
          </div>
        </div>
      )}
      {!draft && (
        <Messages
          accountId={account.id}
          campaignId={id}
          account={account}
          templates={templates}
        />
      )}
    </div>
  );
}