import { useCallback, useEffect, useState } from "react";
import { BookOpen, Eye, FileText, History, Loader2, Pencil, RotateCcw, Save } from "lucide-react";
import knowledgeAPI, { type KnowledgeDocument, type DocumentVersion } from "@/api/knowledge";
import {
  BTN,
  BTN_SECONDARY,
  CARD,
  ChannelHero,
  CommsItem,
  CommsShell,
  EmptyState,
  HeroStatus,
  Notice,
  SegmentTabs,
} from "@/components/comms/CommsKit";

type Tab = "view" | "edit" | "history";

const TABS = [
  ["view", "Current", Eye],
  ["edit", "Edit", Pencil],
  ["history", "History", History],
] as const;

function bytes(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k characters` : `${n} characters`;
}

function pretty(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/^[a-z0-9]+_/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type ApiError = { response?: { status?: number; data?: { detail?: string } } };
const detail = (e: unknown) => (e as ApiError)?.response?.data?.detail;

export default function KnowledgePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("view");

  const [content, setContent] = useState("");
  const [draft, setDraft] = useState("");
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);

  const dirty = draft !== content;

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await knowledgeAPI.listDocuments();
      setDocuments(res.documents);
      setError("");
      if (res.documents.length) setSelected((current) => current || res.documents[0].filename);
    } catch (e) {
      setError((e as ApiError)?.response?.status === 404 ? "No knowledge base is set up for this account yet." : detail(e) || "The knowledge base couldn't be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  const openDocument = useCallback(async (filename: string) => {
    setLoadingDoc(true);
    setNotice("");
    try {
      const doc = await knowledgeAPI.getDocument(filename);
      setContent(doc.content);
      setDraft(doc.content);
      setError("");
    } catch (e) {
      setError(detail(e) || "That document couldn't be opened.");
    } finally {
      setLoadingDoc(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);
  useEffect(() => {
    if (selected) void openDocument(selected);
  }, [selected, openDocument]);
  useEffect(() => {
    if (tab === "history" && selected) {
      knowledgeAPI.listVersions(selected).then(setVersions).catch(() => setVersions([]));
    }
  }, [tab, selected]);

  const save = async () => {
    if (!selected || !dirty) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await knowledgeAPI.saveDocument(selected, draft);
      setContent(draft);
      setNotice(res.note || "Saved. The assistant will use it within a couple of minutes.");
      loadList();
    } catch (e) {
      setError(detail(e) || "Couldn't save. Your changes are still in the editor.");
    } finally {
      setSaving(false);
    }
  };

  const restore = async (versionId: string) => {
    if (!selected) return;
    setSaving(true);
    try {
      await knowledgeAPI.restoreVersion(selected, versionId);
      await openDocument(selected);
      setNotice("Previous version restored.");
      setTab("view");
      loadList();
    } catch (e) {
      setError(detail(e) || "That version couldn't be restored.");
    } finally {
      setSaving(false);
    }
  };

  const totalChars = documents.reduce((n, d) => n + d.characters, 0);
  const current = documents.find((d) => d.filename === selected);

  return (
    <CommsShell>
      <CommsItem>
        <ChannelHero
          tone="library"
          icon={BookOpen}
          title="Knowledge base"
          description="Everything your assistant knows when it answers callers. Edit a document and save — it starts using the new version within a couple of minutes."
          status={
            <HeroStatus ok={documents.length > 0}>
              {loading ? "Loading documents…" : documents.length ? `${documents.length} document${documents.length === 1 ? "" : "s"} · ${bytes(totalChars)}` : "No documents yet"}
            </HeroStatus>
          }
        />
      </CommsItem>

      {error && (
        <CommsItem>
          <Notice tone="error" onDismiss={() => setError("")}>
            {error}
          </Notice>
        </CommsItem>
      )}
      {notice && (
        <CommsItem>
          <Notice tone="success" onDismiss={() => setNotice("")}>
            {notice}
          </Notice>
        </CommsItem>
      )}

      {loading ? (
        <div className={`${CARD} flex items-center justify-center gap-2 py-24 text-[13px] text-[#6B7A99] dark:text-slate-400`}>
          <Loader2 className="animate-spin text-[#14B8A6]" size={20} /> Loading knowledge base…
        </div>
      ) : documents.length === 0 && !error ? (
        <CommsItem>
          <EmptyState icon={BookOpen} tone="library" title="No documents yet" text="Your knowledge base is empty. Send your content to the VoiceDots team and it will appear here." />
        </CommsItem>
      ) : documents.length > 0 ? (
        <CommsItem className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* DOCUMENTS */}
          <aside className={`${CARD} h-fit p-2`} aria-label="Documents">
            <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-[#6B7A99] dark:text-slate-500">Documents</p>
            <ul className="space-y-0.5">
              {documents.map((d) => {
                const active = d.filename === selected;
                return (
                  <li key={d.filename}>
                    <button
                      type="button"
                      aria-current={active ? "true" : undefined}
                      onClick={() => {
                        if (dirty && !window.confirm("Discard unsaved changes to this document?")) return;
                        setSelected(d.filename);
                        setTab("view");
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#137EFD] ${
                        active ? "bg-[#E6F7F5] dark:bg-teal-500/10" : "hover:bg-[#F4F9FF] dark:hover:bg-white/[0.04]"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          active ? "bg-gradient-to-br from-[#14B8A6] to-[#137EFD] text-white" : "bg-[#EEF3FB] text-[#6B7A99] dark:bg-white/[0.06] dark:text-slate-400"
                        }`}
                      >
                        <FileText size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className={`block truncate text-[13px] font-semibold ${active ? "text-[#0B7A6E] dark:text-teal-200" : "text-[#0B1B3F] dark:text-slate-200"}`}>{pretty(d.filename)}</span>
                        <span className="block text-[11px] text-[#6B7A99] dark:text-slate-500">{bytes(d.characters)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* DOCUMENT */}
          <section className={`${CARD} min-w-0 overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 px-4 py-3 dark:border-white/[0.06] sm:px-5">
              <div className="min-w-0">
                <h2 className="truncate text-[16px] font-semibold text-[#0B1B3F] dark:text-white">{current ? pretty(current.filename) : "Document"}</h2>
                <p className="truncate text-[12px] text-[#6B7A99] dark:text-slate-500">{current?.filename}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SegmentTabs label="Document view" value={tab} onChange={setTab} tabs={TABS} />
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {loadingDoc ? (
                <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[#6B7A99] dark:text-slate-400">
                  <Loader2 className="animate-spin" size={18} /> Opening document…
                </div>
              ) : tab === "view" ? (
                <pre className="max-h-[62vh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-[#F8FBFF] p-4 font-mono text-[13px] leading-[1.75] text-[#28395E] ring-1 ring-sky-100/80 dark:bg-[#0A1328] dark:text-slate-300 dark:ring-white/[0.06]">
                  {content}
                </pre>
              ) : tab === "edit" ? (
                <>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    spellCheck={false}
                    aria-label="Document content"
                    className="h-[56vh] w-full resize-none rounded-xl border-0 bg-[#F8FBFF] p-4 font-mono text-[13px] leading-[1.75] text-[#0B1B3F] outline-none ring-1 ring-sky-100 transition focus:bg-white focus:ring-2 focus:ring-[#14B8A6] dark:bg-[#0A1328] dark:text-slate-200 dark:ring-white/10 dark:focus:bg-[#0A1328]"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[12px] text-[#6B7A99] dark:text-slate-400">
                      {bytes(draft.length)}
                      {dirty && <span className="font-semibold text-[#A86A00] dark:text-amber-300"> · Unsaved changes</span>}
                    </p>
                    <div className="flex items-center gap-2">
                      {dirty && (
                        <button type="button" onClick={() => setDraft(content)} className={BTN_SECONDARY}>
                          <RotateCcw size={14} /> Discard changes
                        </button>
                      )}
                      <button type="button" onClick={save} disabled={!dirty || saving} className={BTN}>
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Save document
                      </button>
                    </div>
                  </div>
                </>
              ) : versions.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-[#6B7A99] dark:text-slate-400">No earlier versions yet. A copy is kept each time you save.</p>
              ) : (
                <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-sky-100 dark:before:bg-white/[0.08]">
                  {versions.map((v, i) => (
                    <li key={v.id} className="relative flex items-center justify-between gap-4 rounded-xl py-2.5 pl-10 pr-2 hover:bg-[#F8FBFF] dark:hover:bg-white/[0.03]">
                      <span
                        className={`absolute left-[10px] top-1/2 h-[11px] w-[11px] -translate-y-1/2 rounded-full ring-4 ring-white dark:ring-[#0F1A33] ${
                          i === 0 ? "bg-[#14B8A6]" : "bg-[#C9D6EA] dark:bg-slate-600"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[#0B1B3F] dark:text-slate-200">{new Date(v.saved_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
                        <p className="text-[12px] text-[#6B7A99] dark:text-slate-500">{bytes(v.characters)}</p>
                      </div>
                      <button type="button" onClick={() => restore(v.id)} disabled={saving} className={BTN_SECONDARY}>
                        <RotateCcw size={14} /> Restore
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </CommsItem>
      ) : null}
    </CommsShell>
  );
}
