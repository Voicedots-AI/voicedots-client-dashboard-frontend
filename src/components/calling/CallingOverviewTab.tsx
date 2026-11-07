import { useState, useEffect, useCallback, useRef } from "react";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  ChevronRight,
  ChevronLeft,
  Search,
  Play,
  User,
  Sparkles,
  Loader2,
  RefreshCw,
  PhoneOff,
} from "lucide-react";
import conversationsApi from "@/api/conversations";
import { kpiAPI } from "@/api/kpi";
import type {
  ConversationsListSummary,
  GetConversationDetailsResult,
} from "@/types/conversation.types";
import type { CallStatsResponse } from "@/types/insights.types";
import type { BatchSummary } from "@/api/outboundBatches";
import { ConversationAudioPlayer } from "@/components/ConversationAudioPlayer";
import { EmptyState, SegmentTabs, StatTile } from "@/components/comms/CommsKit";

interface CallingOverviewTabProps {
  agentId?: string;
  batches?: BatchSummary[];
  onOpenNewCampaign?: () => void;
  onOpenSingleCall?: () => void;
}

type Direction = "inbound" | "outbound";
type SubTab = "conversation" | "summary" | "sentiment" | "lead";

const PAGE_SIZE = 8;
const POLL_MS = 30_000;

// The categories the backend assigns; the filter is applied server-side.
const CATEGORIES = [
  "Interested",
  "Follow Up",
  "Callback Required",
  "General Inquiry",
  "Not Interested",
  "Not Assessable",
] as const;

const CATEGORY_CLS: Record<string, string> = {
  Interested: "bg-emerald-50 text-emerald-700 border border-emerald-200/50 dark:bg-emerald-950/40 dark:text-emerald-400",
  "Follow Up": "bg-emerald-50 text-emerald-700 border border-emerald-200/50 dark:bg-emerald-950/40 dark:text-emerald-400",
  "Callback Required": "bg-amber-50 text-amber-700 border border-amber-200/50 dark:bg-amber-950/40 dark:text-amber-400",
  "Not Interested": "bg-rose-50 text-rose-700 border border-rose-200/50 dark:bg-rose-950/40 dark:text-rose-400",
};
const CATEGORY_DEFAULT = "bg-blue-50 text-blue-700 border border-blue-200/50 dark:bg-blue-950/40 dark:text-blue-400";

const SENTIMENT_CLS: Record<string, string> = {
  positive: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  neutral: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  negative: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
};
const MUTED_BADGE = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";

const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

const formatSec = (total: number) => {
  const t = Math.max(0, Math.round(total || 0));
  const mins = Math.floor(t / 60);
  const secs = t % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const formatAvg = (secs: number) => {
  if (!secs) return "—";
  if (secs < 60) return `${secs}s`;
  return `${(secs / 60).toFixed(1)} min`;
};

const formatWhen = (unix: number) => {
  const d = new Date(unix * 1000);
  if (isNaN(d.getTime())) return "—";
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
};

const callStatus = (call: ConversationsListSummary, direction: Direction) => {
  if ((call.duration || 0) > 0) return { label: "Answered", cls: SENTIMENT_CLS.positive };
  return direction === "outbound"
    ? { label: "Not connected", cls: MUTED_BADGE }
    : { label: "Missed", cls: SENTIMENT_CLS.negative };
};

function SentimentBadge({ call }: { call: ConversationsListSummary }) {
  if (!call.analysed) return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${MUTED_BADGE}`}>Analysing</span>;
  if (!call.sentiment) return <span className="text-[11px] text-[#9AA8C2]">—</span>;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${SENTIMENT_CLS[call.sentiment] ?? MUTED_BADGE}`}>
      {cap(call.sentiment)}
    </span>
  );
}

function Field({ label, value, tone }: { label: string; value?: string | null; tone?: string }) {
  return (
    <div className="rounded-xl border border-[#E6EDF8] bg-[#F4F9FF] p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
      <span className="text-[#6B7A99]">{label}</span>
      <p className={`mt-1 font-semibold ${tone ?? "text-[#0B1B3F] dark:text-white"}`}>{value || "—"}</p>
    </div>
  );
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function CallingOverviewTab({ agentId }: CallingOverviewTabProps) {
  const [direction, setDirection] = useState<Direction>("inbound");
  const [category, setCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 350);
  const [page, setPage] = useState(1);
  const [subTab, setSubTab] = useState<SubTab>("conversation");

  const [calls, setCalls] = useState<ConversationsListSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CallStatsResponse | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<GetConversationDetailsResult | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  // The recording and the call it belongs to, so a recording requested from a
  // table row survives the selection change that request causes.
  const [audio, setAudio] = useState<{ id: string; url: string } | null>(null);
  const [audioState, setAudioState] = useState<{ id: string; state: "loading" | "missing" } | null>(null);
  const listRequest = useRef(0);

  const loadStats = useCallback(async () => {
    try {
      setStats(await kpiAPI.getCallStats());
    } catch (err) {
      console.warn("Could not load call figures:", err);
    }
  }, []);

  const loadCalls = useCallback(
    async (silent = false) => {
      const id = ++listRequest.current;
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await conversationsApi.getConversations(
          agentId,
          null,
          page,
          PAGE_SIZE,
          undefined,
          undefined,
          // Inbound calls are phone conversations; outbound ones are found by
          // the dial log, whatever source the call was recorded under.
          direction === "inbound" ? "phone_call" : undefined,
          debouncedSearch || undefined,
          category || undefined,
          true,
          direction
        );
        if (id !== listRequest.current) return;
        const rows = res.conversations ?? [];
        setCalls(rows);
        setTotal(res.pagination?.total ?? rows.length);
        setError(null);
        setSelectedId((prev) => (prev && rows.some((r) => r.conversation_id === prev) ? prev : rows[0]?.conversation_id ?? null));
      } catch (err) {
        console.warn("Could not fetch calls:", err);
        if (id === listRequest.current) setError("Calls could not be loaded. Try refreshing.");
      } finally {
        if (id === listRequest.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [agentId, page, direction, debouncedSearch, category]
  );

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  useEffect(() => {
    loadStats();
    const t = setInterval(() => {
      loadStats();
      loadCalls(true);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [loadStats, loadCalls]);

  // Details for the selected call.
  useEffect(() => {
    if (!selectedId) {
      setDetails(null);
      return;
    }
    let active = true;
    setLoadingDetails(true);
    conversationsApi
      .getConversationDetails(selectedId, agentId)
      .then((d) => active && setDetails(d))
      .catch((err) => {
        console.warn("Could not load call details:", err);
        if (active) setDetails(null);
      })
      .finally(() => active && setLoadingDetails(false));
    return () => {
      active = false;
    };
  }, [selectedId, agentId]);

  // Release the recording's object URL when it is replaced.
  useEffect(() => () => {
    if (audio) URL.revokeObjectURL(audio.url);
  }, [audio]);

  const loadRecording = async (id: string) => {
    if (id !== selectedId) setSelectedId(id);
    if (audio?.id === id) return;
    setAudioState({ id, state: "loading" });
    try {
      const blob = await conversationsApi.getConversationAudio(id, agentId);
      if (blob && blob.size > 0) {
        setAudio({ id, url: URL.createObjectURL(blob) });
        setAudioState(null);
        return;
      }
      setAudioState({ id, state: "missing" });
    } catch {
      setAudioState({ id, state: "missing" });
    }
  };

  const resetPage = () => setPage(1);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selected = calls.find((c) => c.conversation_id === selectedId) ?? null;
  const selectedIndex = selected ? calls.indexOf(selected) : -1;

  const audioUrl = audio && audio.id === selectedId ? audio.url : null;
  const audioStatus = audioState && audioState.id === selectedId ? audioState.state : null;
  const analysis = details?.sentiment_analysis ?? null;
  const transcript = (details?.transcription ?? []).filter((t) => t.message);
  const sentimentValue = analysis?.sentiment || selected?.sentiment || analysis?.overall_sentiment || null;
  const sentimentKey = (sentimentValue || "").toLowerCase();
  const sentimentTone = sentimentKey.includes("pos")
    ? "text-emerald-600 dark:text-emerald-400"
    : sentimentKey.includes("neg")
      ? "text-rose-600 dark:text-rose-400"
      : sentimentKey
        ? "text-amber-600 dark:text-amber-400"
        : undefined;
  const callerName = details?.lead?.name || selected?.contact_name || selected?.title || "Unknown caller";
  const callerPhone = details?.lead?.phone || selected?.caller_phone || "Number not recorded";

  const inbound = stats?.inbound;
  const outbound = stats?.outbound;
  const missed = inbound?.missed ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentTabs
          label="Call direction"
          value={direction}
          onChange={(v) => {
            setDirection(v);
            resetPage();
          }}
          tabs={[
            ["inbound", `Inbound${inbound ? ` (${inbound.total.toLocaleString()})` : ""}`, PhoneIncoming],
            ["outbound", `Outbound${outbound ? ` (${outbound.dialled.toLocaleString()})` : ""}`, PhoneOutgoing],
          ] as const}
        />
        {stats && (
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-[#118A4B] shadow-sm ring-1 ring-sky-100 dark:bg-slate-900 dark:ring-slate-800">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1FB867] motion-reduce:animate-none" />
            Live, updates every 30s
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Inbound calls"
          value={inbound ? inbound.total.toLocaleString() : "—"}
          foot={inbound ? (inbound.total ? `${inbound.answered_pct}% answered` : "No inbound calls yet") : undefined}
          footTone={inbound?.total ? "up" : "neutral"}
          icon={PhoneIncoming}
          from="#137EFD"
          to="#5AB8FF"
          onClick={() => {
            setDirection("inbound");
            resetPage();
          }}
        />
        <StatTile
          label="Outbound calls"
          value={outbound ? outbound.dialled.toLocaleString() : "—"}
          foot={outbound ? (outbound.dialled ? `${outbound.connected.toLocaleString()} connected (${outbound.connected_pct}%)` : "No calls placed yet") : undefined}
          footTone={outbound?.dialled ? "up" : "neutral"}
          icon={PhoneOutgoing}
          from="#7732FD"
          to="#A779FF"
          onClick={() => {
            setDirection("outbound");
            resetPage();
          }}
        />
        <StatTile
          label="Missed calls"
          value={inbound ? missed.toLocaleString() : "—"}
          foot={inbound ? (missed ? "Inbound calls with no conversation" : "None to return") : undefined}
          footTone={missed ? "down" : "neutral"}
          icon={PhoneMissed}
          from="#ED5173"
          to="#FF8FA3"
        />
        <StatTile
          label="Average call"
          value={stats ? formatAvg(stats.avg_call_secs) : "—"}
          foot={stats ? `Across ${stats.connected_calls.toLocaleString()} connected calls` : undefined}
          icon={Clock}
          from="#F0A500"
          to="#FFD35C"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Calls table */}
        <div className="space-y-4 lg:col-span-7 xl:col-span-8">
          <div className="rounded-2xl bg-white p-5 shadow-[0_8px_26px_rgba(18,50,120,0.09)] ring-1 ring-sky-100/80 dark:bg-slate-900 dark:ring-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6EDF8] pb-4 dark:border-slate-800">
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  resetPage();
                }}
                aria-label="Filter by outcome"
                className="rounded-xl border border-sky-100 bg-white px-3 py-1.5 text-xs font-medium text-[#33415F] outline-none hover:bg-[#F4F9FF] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <option value="">All outcomes</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-[#9AA8C2]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      resetPage();
                    }}
                    placeholder="Search by name, phone number…"
                    className="w-48 rounded-xl border border-sky-100 bg-white py-1.5 pl-8 pr-3 text-xs text-[#0B1B3F] outline-none focus:border-[#137EFD] focus:ring-1 focus:ring-[#137EFD] sm:w-56 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    loadCalls(true);
                    loadStats();
                  }}
                  disabled={refreshing || loading}
                  title="Refresh calls"
                  aria-label="Refresh calls"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-sky-100 bg-white text-[#33415F] hover:bg-[#F4F9FF] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <RefreshCw size={13} className={refreshing || loading ? "animate-spin motion-reduce:animate-none" : ""} />
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-xs text-[#9AA8C2]">
                  <Loader2 size={18} className="mr-2 animate-spin text-[#137EFD]" />
                  Loading calls…
                </div>
              ) : error ? (
                <p className="py-12 text-center text-xs text-rose-600">{error}</p>
              ) : calls.length === 0 ? (
                <EmptyState
                  icon={PhoneOff}
                  tone="voice"
                  title={debouncedSearch || category ? "No calls match" : direction === "inbound" ? "No inbound calls yet" : "No outbound calls yet"}
                  text={
                    debouncedSearch || category
                      ? "Try a different search or outcome."
                      : direction === "inbound"
                        ? "Calls to your agent's number will appear here as soon as they end."
                        : "Calls placed from a campaign or the single-call tab will appear here when they end."
                  }
                />
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E6EDF8] text-[11px] font-semibold text-[#9AA8C2] dark:border-slate-800 dark:text-[#6B7A99]">
                      <th className="py-2.5 pl-2 font-medium">Date & Time</th>
                      <th className="py-2.5 font-medium">Caller</th>
                      <th className="py-2.5 font-medium">Outcome</th>
                      <th className="py-2.5 font-medium">Sentiment</th>
                      <th className="py-2.5 font-medium">Duration</th>
                      <th className="py-2.5 font-medium">Status</th>
                      <th className="py-2.5 pr-2 text-right font-medium">Recording</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF3FB] dark:divide-slate-800">
                    {calls.map((call) => {
                      const isSelected = call.conversation_id === selectedId;
                      const status = callStatus(call, direction);
                      return (
                        <tr
                          key={call.conversation_id}
                          onClick={() => setSelectedId(call.conversation_id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? "bg-[#EAF3FF] dark:bg-indigo-950/40" : "hover:bg-[#F4F9FF] dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <td className="whitespace-nowrap py-3 pl-2 font-medium text-[#6B7A99] dark:text-slate-300">{formatWhen(call.start_time)}</td>
                          <td className="py-3">
                            <p className="max-w-[180px] truncate font-semibold text-[#0B1B3F] dark:text-white">{call.contact_name || call.title || "Unknown caller"}</p>
                            <p className="text-[11px] text-[#9AA8C2]">{call.caller_phone || "Number not recorded"}</p>
                          </td>
                          <td className="whitespace-nowrap py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${CATEGORY_CLS[call.category ?? ""] ?? CATEGORY_DEFAULT}`}>
                              {call.category || "Not Assessable"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap py-3">
                            <SentimentBadge call={call} />
                          </td>
                          <td className="whitespace-nowrap py-3 font-medium text-[#6B7A99] dark:text-[#9AA8C2]">{formatSec(call.duration)}</td>
                          <td className="whitespace-nowrap py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
                          </td>
                          <td className="whitespace-nowrap py-3 pr-2 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => loadRecording(call.conversation_id)}
                              disabled={!call.duration}
                              title={call.duration ? "Play call recording" : "No recording"}
                              aria-label="Play call recording"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#137EFD] hover:bg-[#EAF3FF] disabled:opacity-30 dark:hover:bg-indigo-950/50"
                            >
                              <Play size={13} className="ml-0.5 fill-current" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E6EDF8] pt-4 text-xs text-[#6B7A99] dark:border-slate-800 dark:text-[#9AA8C2]">
              <span>
                Showing {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()} calls
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-100 hover:bg-[#F4F9FF] disabled:opacity-40 dark:border-slate-700"
                >
                  <ChevronLeft size={13} />
                </button>
                <span className="px-2 font-semibold text-[#33415F] dark:text-slate-300">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-100 hover:bg-[#F4F9FF] disabled:opacity-40 dark:border-slate-700"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Call details */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="sticky top-6 flex flex-col rounded-2xl bg-white p-5 shadow-[0_8px_26px_rgba(18,50,120,0.09)] ring-1 ring-sky-100/80 dark:bg-slate-900 dark:ring-slate-800">
            {!selected ? (
              <p className="py-16 text-center text-xs text-[#9AA8C2]">Select a call to see its details.</p>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-[#E6EDF8] pb-3 dark:border-slate-800">
                  <span className="text-xs font-bold text-[#0B1B3F] dark:text-slate-200">Call Details</span>
                  <div className="flex items-center gap-1.5 text-xs text-[#9AA8C2]">
                    <button
                      type="button"
                      disabled={selectedIndex <= 0}
                      onClick={() => selectedIndex > 0 && setSelectedId(calls[selectedIndex - 1].conversation_id)}
                      aria-label="Previous call"
                      className="p-1 hover:text-[#33415F] disabled:opacity-30"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span>
                      {selectedIndex + 1} of {calls.length}
                    </span>
                    <button
                      type="button"
                      disabled={selectedIndex >= calls.length - 1}
                      onClick={() => selectedIndex < calls.length - 1 && setSelectedId(calls[selectedIndex + 1].conversation_id)}
                      aria-label="Next call"
                      className="p-1 hover:text-[#33415F] disabled:opacity-30"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                      <Phone size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-[#0B1B3F] dark:text-white">{callerName}</h3>
                      <p className="text-xs text-[#6B7A99]">{callerPhone}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#9AA8C2]">
                        <Clock size={11} />
                        <span>
                          {formatWhen(selected.start_time)} • {formatSec(selected.duration)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${callStatus(selected, direction).cls}`}>
                    {callStatus(selected, direction).label}
                  </span>
                </div>

                <div className="mt-5 flex border-b border-[#E6EDF8] text-xs font-semibold dark:border-slate-800">
                  {(
                    [
                      ["conversation", "Conversation"],
                      ["summary", "Summary"],
                      ["sentiment", "Intent & Sentiment"],
                      ["lead", "Lead Info"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSubTab(key)}
                      className={`px-2 pb-2.5 transition-all ${
                        subTab === key ? "border-b-2 border-[#137EFD] text-[#137EFD] dark:text-[#5AB8FF]" : "text-[#9AA8C2] hover:text-[#6B7A99]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 max-h-[380px] flex-1 space-y-3.5 overflow-y-auto pr-1">
                  {loadingDetails ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-xs text-[#9AA8C2]">
                      <Loader2 size={18} className="animate-spin text-[#137EFD]" />
                      <span>Fetching call details…</span>
                    </div>
                  ) : subTab === "conversation" ? (
                    transcript.length ? (
                      <div className="space-y-3">
                        {transcript.map((t, idx) => {
                          const ai = t.role === "agent" || t.role === "assistant";
                          return (
                            <div key={idx} className="flex items-start gap-2.5 text-xs">
                              <span className="mt-1 shrink-0 font-mono text-[10px] text-[#9AA8C2]">{formatSec(t.timestamp || 0)}</span>
                              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${ai ? "bg-[#137EFD]" : "bg-blue-500"}`}>
                                {ai ? "AI" : <User size={12} />}
                              </div>
                              <div
                                className={`rounded-2xl p-3 text-xs leading-relaxed ${
                                  ai
                                    ? "bg-[#EAF3FF] text-[#0B1B3F] dark:bg-indigo-950/40 dark:text-indigo-200"
                                    : "border border-[#E6EDF8] bg-white text-[#33415F] shadow-sm dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
                                }`}
                              >
                                {t.message}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="py-8 text-center text-xs text-[#9AA8C2]">No transcript was recorded for this call.</p>
                    )
                  ) : subTab === "summary" ? (
                    <div className="rounded-xl border border-sky-200 bg-[#EAF3FF] p-4 text-xs dark:border-indigo-900 dark:bg-indigo-950/30">
                      <div className="flex items-center gap-1.5 font-bold text-[#137EFD] dark:text-[#5AB8FF]">
                        <Sparkles size={14} /> AI Call Summary
                      </div>
                      <p className="mt-2 leading-relaxed text-[#33415F] dark:text-slate-300">
                        {analysis?.summary ||
                          details?.lead?.summary ||
                          (selected.analysed ? "The caller said too little to summarise." : "This call is still being analysed. The summary appears within a few minutes of the call ending.")}
                      </p>
                      {analysis?.recommended_action && (
                        <p className="mt-3 border-t border-sky-200 pt-3 leading-relaxed text-[#33415F] dark:border-indigo-900 dark:text-slate-300">
                          <span className="font-semibold">Next step: </span>
                          {analysis.recommended_action}
                        </p>
                      )}
                    </div>
                  ) : subTab === "sentiment" ? (
                    analysis || selected.analysed ? (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <Field label="Sentiment" value={cap(sentimentValue)} tone={sentimentTone} />
                        <Field label="Emotion" value={cap(analysis?.emotion)} />
                        <Field label="Topic" value={analysis?.topic || selected.topic} />
                        <Field
                          label="Urgency"
                          value={analysis?.urgency ? cap(analysis.urgency) : selected.urgent ? "High" : "Normal"}
                          tone={analysis?.urgency === "high" || selected.urgent ? "text-rose-600 dark:text-rose-400" : undefined}
                        />
                        <Field label="Intent" value={analysis?.intent || analysis?.primary_interest} />
                        <Field label="Interest level" value={analysis?.interest_level} />
                      </div>
                    ) : (
                      <p className="py-8 text-center text-xs text-[#9AA8C2]">This call is still being analysed.</p>
                    )
                  ) : (
                    <div className="space-y-3 text-xs">
                      <Field label="Lead stage" value={details?.lead?.status || selected.category} tone="text-[#137EFD] dark:text-[#5AB8FF]" />
                      <Field label="Name" value={details?.lead?.name || selected.contact_name} />
                      <Field label="Phone" value={details?.lead?.phone || selected.caller_phone} />
                      <Field label="Email" value={details?.lead?.email} />
                      <Field label="Direction" value={cap(details?.lead?.direction || selected.direction || direction)} />
                    </div>
                  )}
                </div>

                <div className="mt-5 border-t border-[#E6EDF8] pt-4 dark:border-slate-800">
                  {audioUrl ? (
                    <ConversationAudioPlayer key={audioUrl} audioUrl={audioUrl} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => loadRecording(selected.conversation_id)}
                      disabled={audioStatus === "loading" || audioStatus === "missing" || !selected.duration}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#137EFD] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#137EFD]/30 disabled:opacity-50"
                    >
                      {audioStatus === "loading" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} className="fill-current" />}
                      {audioStatus === "missing" || !selected.duration ? "No recording for this call" : "Play recording"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
