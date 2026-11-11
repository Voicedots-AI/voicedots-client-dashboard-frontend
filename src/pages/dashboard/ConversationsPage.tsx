import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  type ConversationQuery,
  drilldownChips,
  drilldownOf,
  readConversationQuery,
  toSearchParams,
} from "@/lib/conversationFilters";
import { format, parseISO } from "date-fns";
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Layers,
  MessagesSquare,
  Phone,
  RefreshCw,
  X,
  Bot,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react";
import { ConversationCard } from "@/components/ConversationCard";
import { DatePickerWithRange } from "@/components/DatePickerWithRange";
import conversationsApi from "@/api/conversations";
import type { ConversationsListSummary } from "@/types/conversation.types";
import { useAuth } from "@/context/AuthContext";
import {
  BTN_SECONDARY,
  CARD,
  ChannelHero,
  CommsItem,
  CommsShell,
  HeroStatus,
  IconChip,
  SegmentTabs,
} from "@/components/comms/CommsKit";

const SOURCE_TABS = [
  ["all", "All channels", Layers],
  ["web_voice", "Website", Globe2],
  ["phone_call", "Phone", Phone],
] as const;

type Source = (typeof SOURCE_TABS)[number][0];

const CATEGORIES = ["Follow Up", "Interested", "General Inquiry", "Not Interested", "Callback Required", "Not Assessable"];

/* ---------- Date presets ---------- */

const DATE_PRESETS = [
  ["all", "All time"],
  ["today", "Today"],
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
  ["custom", "Custom"],
] as const;
type DatePreset = (typeof DATE_PRESETS)[number][0];

const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
};
const PRESET_RANGE: Record<"today" | "7d" | "30d", () => { start: string; end: string }> = {
  today: () => ({ start: ymd(new Date()), end: ymd(new Date()) }),
  "7d": () => ({ start: daysAgo(6), end: ymd(new Date()) }),
  "30d": () => ({ start: daysAgo(29), end: ymd(new Date()) }),
};

/** Which preset the URL's dates are, so a Home link to "last 7 days" lights up that button. */
function presetOf(start: string, end: string): DatePreset {
  if (!start && !end) return "all";
  for (const key of ["today", "7d", "30d"] as const) {
    const range = PRESET_RANGE[key]();
    if (range.start === start && range.end === end) return key;
  }
  return "custom";
}

/* ---------- Signal filters ---------- */

const SENTIMENT_OPTIONS = [["positive", "Positive"], ["neutral", "Neutral"], ["negative", "Negative"]] as const;
const EMOTION_OPTIONS = [
  ["happy", "Happy"], ["calm", "Calm"], ["confused", "Confused"],
  ["frustrated", "Frustrated"], ["angry", "Angry"], ["sad", "Sad"],
] as const;
// The analysis vocabulary (backend sentiment_helper.TOPICS).
const TOPIC_OPTIONS = [
  "Admissions", "Fees & Payments", "Courses & Programmes", "Placements", "Hostel & Facilities",
  "Examinations & Results", "Scholarships", "General Information", "Other",
].map((t) => [t, t] as const);
// These have their own control, so they never also show as a "Showing only" chip.
const CONTROLLED_KEYS = new Set(["sentiment", "emotion", "topic", "urgent", "persona"]);

function FilterSelect({
  label,
  value,
  onChange,
  options,
  anyLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly (readonly [string, string])[];
  anyLabel: string;
}) {
  const active = Boolean(value);
  return (
    <label className="relative min-w-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-9 w-full cursor-pointer appearance-none rounded-xl border-0 pl-3 pr-8 text-[12px] font-semibold outline-none ring-1 transition focus-visible:ring-2 focus-visible:ring-[#137EFD] ${
          active
            ? "bg-[#E8F2FF] text-[#0B5BD3] ring-[#137EFD]/30 dark:bg-[#0F2547] dark:text-[#8CC2FF] dark:ring-[#137EFD]/40"
            : "bg-[#F4F9FF] text-[#55648A] ring-sky-100 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700"
        } [&>option]:bg-white [&>option]:font-medium [&>option]:text-[#0B1B3F] dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100`}
      >
        <option value="">{anyLabel}</option>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {label}: {text}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9AA8C2]" />
    </label>
  );
}

/** Pill row for the AI team, e.g. About Us · Courses · Admissions · Placements. */
function TeamTabs({
  team,
  value,
  onChange,
}: {
  team: { key: string; label: string; count: number }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const pill = (active: boolean) =>
    `inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3.5 text-[13px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#137EFD] ${
      active
        ? "bg-[#0B1B3F] text-white dark:bg-slate-100 dark:text-[#0B1B3F]"
        : "bg-[#F4F9FF] text-[#55648A] ring-1 ring-sky-100 hover:text-[#0B1B3F] dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700 dark:hover:text-white"
    }`;
  const count = (n: number, active: boolean) => (
    <span className={`rounded-md px-1.5 text-[11px] tabular-nums ${active ? "bg-white/20 dark:bg-[#0B1B3F]/10" :"bg-white text-[#6B7A99] dark:bg-slate-800"}`}>
      {n.toLocaleString()}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter by AI team member">
      <span className="mr-1 inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-[#6B7A99]">
        <Bot size={14} /> Answered by
      </span>
      <button type="button" role="tab" aria-selected={!value} onClick={() => onChange("")} className={pill(!value)}>
        Whole team
      </button>
      {team.map((m) => {
        const active = value === m.key;
        return (
          <button
            type="button"
            role="tab"
            key={m.key}
            aria-selected={active}
            onClick={() => onChange(active ? "" : m.key)}
            className={pill(active)}
            title={m.key === "none" ? "The caller never got a reply: silent, or hung up during the greeting" : `Conversations ${m.label} replied in`}
          >
            {m.label}
            {count(m.count, active)}
          </button>
        );
      })}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-full bg-[#E8F2FF] pl-3 pr-1 text-[12px] font-semibold text-[#0B5BD3] ring-1 ring-[#137EFD]/25 dark:bg-[#137EFD]/15 dark:text-[#8CC2FF]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-[#137EFD]/15 focus-visible:outline-2 focus-visible:outline-[#137EFD]"
      >
        <X size={13} />
      </button>
    </span>
  );
}

export function ConversationsPage() {
  const { user } = useAuth();
  // Every filter lives in the URL: Home links here with them set, and a
  // filtered list survives refresh, the back button and being shared.
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => readConversationQuery(searchParams), [searchParams]);
  const startDate = query.start_date ?? "";
  const endDate = query.end_date ?? "";
  const source = (SOURCE_TABS.some(([value]) => value === query.source) ? query.source : "all") as Source;
  const category = query.category ?? "";
  const appliedSearch = query.search ?? "";
  const drilldown = useMemo(() => drilldownOf(query), [query]);
  // A stable key, so the fetch only re-runs when a filter value really changes.
  const drilldownKey = JSON.stringify(drilldown);
  const chips = drilldownChips(query).filter((chip) => !CONTROLLED_KEYS.has(chip.key));
  // Several categories at once come only from a Home link (e.g. Interested + Follow Up).
  const multiCategory = category.includes(",");
  const matchedPreset = presetOf(startDate, endDate);
  // "Custom" stays chosen while the user is still picking dates.
  const [customPicked, setCustomPicked] = useState(false);
  const datePreset: DatePreset = customPicked ? "custom" : matchedPreset;
  const [team, setTeam] = useState<{ key: string; label: string; count: number }[]>([]);

  const updateQuery = useCallback(
    (patch: Partial<ConversationQuery>) => {
      setSearchParams((prev) => toSearchParams({ ...readConversationQuery(prev), ...patch }), { replace: true });
    },
    [setSearchParams]
  );
  const setSource = (value: Source) => updateQuery({ source: value === "all" ? undefined : value });
  const setCategory = (value: string) => updateQuery({ category: value || undefined });
  const setDatePreset = (preset: DatePreset) => {
    if (preset === "custom") {
      setCustomPicked(true);
      return;
    }
    setCustomPicked(false);
    const range = preset === "all" ? { start: undefined, end: undefined } : PRESET_RANGE[preset]();
    updateQuery({ start_date: range.start, end_date: range.end });
  };

  const [searchQuery, setSearchQuery] = useState(appliedSearch);
  const [conversations, setConversations] = useState<ConversationsListSummary[]>([]);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [stack, setStack] = useState<string[]>([]);

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    pages: 1
  });

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const latestRequest = useRef(0);

  const push = (item: string) => {
    setStack((prev) => [...prev, item]);
  };

  const pop = (): string | undefined => {
    let popped: string | undefined;
    setStack((prev) => {
      if (prev.length === 0) return prev;
      popped = prev[prev.length - 1];
      return prev.slice(0, -1);
    });
    return popped;
  };

  const fetchConversations = useCallback(
    async (cursor: string | null = null, p: number = 1) => {
      if (!user?.agent_id) return;
      // Filters change faster than responses arrive; only the latest request may write.
      const requestId = ++latestRequest.current;
      try {
        setIsLoading(true);
        setLoadError("");
        const convData = await conversationsApi.getConversations(
          user?.agent_id,
          cursor,
          p,
          pagination.limit,
          startDate,
          endDate,
          source,
          appliedSearch,
          category,
          undefined,
          undefined,
          JSON.parse(drilldownKey),
          true
        );
        if (requestId !== latestRequest.current) return;
        // A narrow filter can match nothing; keep the team row in place (at zero) so it doesn't jump away.
        const nextTeam = convData.team ?? [];
        setTeam((prev) => (nextTeam.length > 0 ? nextTeam : prev.map((m) => ({ ...m, count: 0 }))));

        setConversations(convData.conversations);
        setNextPage(convData.nextPage);
        if (convData.pagination) setPagination(convData.pagination as any);
      } catch (error) {
        if (requestId !== latestRequest.current) return;
        console.error("Failed to load conversations", error);
        setLoadError("Conversations could not be loaded. Check your connection and try again.");
      } finally {
        if (requestId === latestRequest.current) setIsLoading(false);
      }
    },
    [user?.agent_id, pagination.limit, startDate, endDate, source, appliedSearch, category, drilldownKey]
  );

  // Typing stays local; the URL takes the search once the user pauses.
  useEffect(() => {
    const term = searchQuery.trim();
    if (term === appliedSearch) return;
    const timer = window.setTimeout(() => updateQuery({ search: term || undefined }), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery, appliedSearch, updateQuery]);

  // Back/forward or a new Home link can change the search under the input.
  useEffect(() => {
    setSearchQuery((current) => (current.trim() === appliedSearch ? current : appliedSearch));
  }, [appliedSearch]);

  useEffect(() => {
    setPagination(p => ({...p, page: 1}));
    setStack([]);
    fetchConversations(null, 1);
  }, [fetchConversations]);

  const goPrev = () => { setPagination(p => ({...p, page: Math.max(1, p.page - 1)})); fetchConversations(pop() ?? null, pagination.page - 1); };
  const goNext = () => { if (nextPage) push(nextPage); setPagination(p => ({...p, page: Math.min(pagination.pages, p.page + 1)})); fetchConversations(nextPage, pagination.page + 1); };
  const filtered = Boolean(
    startDate || endDate || category || appliedSearch || source !== "all" || chips.length ||
    query.sentiment || query.emotion || query.topic || query.urgent !== undefined || query.persona
  );
  const clearFilters = () => {
    setSearchQuery("");
    setCustomPicked(false);
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  // The count is what the current filters match — the same number the pager reports.
  const status = isLoading ? (
    <HeroStatus ok={false}>Loading conversations…</HeroStatus>
  ) : loadError ? (
    <HeroStatus ok={false}>Conversations didn’t load</HeroStatus>
  ) : (
    <HeroStatus ok>
      {pagination.total.toLocaleString()} {pagination.total === 1 ? "conversation" : "conversations"}
      {filtered ? " match your filters" : " in total"}
    </HeroStatus>
  );

  return (
    <CommsShell>
      <CommsItem>
        <ChannelHero
          tone="inbox"
          icon={MessagesSquare}
          title="Conversations"
          description="Every call and website chat your agent has handled. Open one to read the transcript, hear the recording and see what the caller wants next."
          status={status}
        />
      </CommsItem>

      {/* FILTERS */}
      <CommsItem>
        <div className={`${CARD} space-y-4 p-4 sm:p-5`}>
          <div className="grid grid-cols-1 items-center gap-3 lg:grid-cols-[auto_minmax(240px,1fr)]">
            <SegmentTabs label="Channel" value={source} onChange={setSource} tabs={SOURCE_TABS} />
            <label className="relative min-w-0">
              <span className="sr-only">Search conversations</span>
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9AA8C2]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone or topic"
                className="h-10 w-full rounded-xl border-0 bg-[#F4F9FF] pl-10 pr-4 text-sm text-[#0B1B3F] ring-1 ring-sky-100 outline-none transition placeholder:text-[#9AA8C2] focus:bg-white focus:ring-2 focus:ring-[#137EFD] dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-700"
              />
            </label>
          </div>

          {/* Period: quick presets, or Custom for any range */}
          <div className="flex flex-wrap items-center gap-3">
            <SegmentTabs label="Period" value={datePreset} onChange={setDatePreset} tabs={DATE_PRESETS} />
            {datePreset === "custom" && (
              // The shared picker carries its own label and button styles; align them with this toolbar.
              <div className="min-w-0 [&_[data-slot=field-label]]:sr-only [&_label]:sr-only [&_button]:h-10 [&_button]:rounded-xl [&_button]:border-0 [&_button]:bg-[#F4F9FF] [&_button]:text-sm [&_button]:text-[#0B1B3F] [&_button]:ring-1 [&_button]:ring-sky-100 dark:[&_button]:bg-slate-950 dark:[&_button]:text-slate-100 dark:[&_button]:ring-slate-700">
                <DatePickerWithRange
                  value={startDate ? { from: parseISO(startDate), to: endDate ? parseISO(endDate) : undefined } : undefined}
                  onChange={(range) => {
                    updateQuery({
                      start_date: range?.from ? format(range.from, "yyyy-MM-dd") : undefined,
                      end_date: range?.to ? format(range.to, "yyyy-MM-dd") : undefined,
                    });
                  }}
                  label="Date range"
                  className="w-full sm:w-auto"
                  showClear={Boolean(startDate || endDate)}
                />
              </div>
            )}
          </div>

          {/* AI team (only for agents with several personas, e.g. About Us / Courses / Admissions / Placements) */}
          {team.length > 0 && (
            <TeamTabs team={team} value={query.persona ?? ""} onChange={(v) => updateQuery({ persona: v || undefined })} />
          )}

          {/* What the caller felt and wanted */}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by analysis">
            <span className="mr-1 inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-[#6B7A99]">
              <SlidersHorizontal size={14} /> Analysis
            </span>
            <FilterSelect label="Sentiment" anyLabel="Any sentiment" value={query.sentiment ?? ""} options={SENTIMENT_OPTIONS}
              onChange={(v) => updateQuery({ sentiment: (v || undefined) as ConversationQuery["sentiment"] })} />
            <FilterSelect label="Emotion" anyLabel="Any emotion" value={query.emotion ?? ""} options={EMOTION_OPTIONS}
              onChange={(v) => updateQuery({ emotion: (v || undefined) as ConversationQuery["emotion"] })} />
            <FilterSelect label="Intent" anyLabel="Any intent" value={query.topic ?? ""} options={TOPIC_OPTIONS}
              onChange={(v) => updateQuery({ topic: v || undefined })} />
            <FilterSelect label="Urgency" anyLabel="Any urgency" value={query.urgent === undefined ? "" : String(query.urgent)}
              options={[["true", "Urgent only"], ["false", "Not urgent"]]}
              onChange={(v) => updateQuery({ urgent: v === "" ? undefined : v === "true" })} />
            {filtered && !(chips.length > 0 || multiCategory) && (
              <button type="button" onClick={clearFilters} className="ml-auto text-[12px] font-semibold text-[#137EFD] hover:underline">
                Clear all filters
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-0.5" role="group" aria-label="Filter conversations by category">
            <span className="mr-1 shrink-0 text-[12px] font-medium text-[#6B7A99]">Category</span>
            {["", ...CATEGORIES].map((value) => {
              const active = category === value;
              return (
                <button
                  type="button"
                  key={value || "all"}
                  onClick={() => setCategory(value)}
                  aria-pressed={active}
                  className={`h-8 shrink-0 rounded-full px-3 text-[12px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#137EFD] ${
                    active
                      ? "bg-[#0B1B3F] text-white dark:bg-slate-100 dark:text-[#0B1B3F]"
                      : "bg-[#F4F9FF] text-[#55648A] ring-1 ring-sky-100 hover:text-[#0B1B3F] dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700 dark:hover:text-white"
                  }`}
                >
                  {value || "All"}
                </button>
              );
            })}
          </div>

          {(chips.length > 0 || multiCategory) && (
            <div className="flex flex-wrap items-center gap-2 border-t border-sky-100 pt-3 dark:border-slate-800" role="group" aria-label="Filters from the Home dashboard">
              <span className="mr-1 shrink-0 text-[12px] font-medium text-[#6B7A99]">Showing only</span>
              {multiCategory && (
                <FilterChip label={`Category: ${category.split(",").join(" or ")}`} onRemove={() => setCategory("")} />
              )}
              {chips.map((chip) => (
                <FilterChip key={chip.key} label={chip.label} onRemove={() => updateQuery({ [chip.key]: undefined })} />
              ))}
              <button type="button" onClick={clearFilters} className="ml-auto text-[12px] font-semibold text-[#137EFD] hover:underline">
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </CommsItem>

      {/* LIST */}
      <CommsItem className="flex flex-col gap-3">
        {loadError && !isLoading ? (
          <div role="alert" className={`${CARD} flex flex-col items-center gap-3 px-4 py-10 text-center`}>
            <p className="text-sm font-semibold text-[#C42D52]">{loadError}</p>
            <button type="button" onClick={() => fetchConversations(null, 1)} className={BTN_SECONDARY}>
              <RefreshCw size={15} />
              Try again
            </button>
          </div>
        ) : isLoading ? (
          <div className={`${CARD} flex items-center justify-center gap-2 py-20 text-sm text-[#6B7A99]`}>
            <Loader2 className="animate-spin text-[#137EFD]" size={18} />
            Loading conversations…
          </div>
        ) : (
          conversations.map((conversation, index) => (
            <ConversationCard
              key={conversation.conversation_id}
              conversation={conversation}
              index={index + 1 + (pagination.page - 1) * pagination.limit}
            />
          ))
        )}
        {!isLoading && !loadError && conversations.length === 0 && (
          <div className={`${CARD} flex flex-col items-center px-6 py-14 text-center`}>
            <IconChip icon={MessagesSquare} from="#137EFD" to="#33B0E6" size="h-12 w-12" />
            <p className="mt-4 text-[15px] font-semibold">
              {filtered ? "No conversations match these filters" : "No conversations yet"}
            </p>
            <p className="mt-1 max-w-sm text-[13px] text-[#6B7A99]">
              {filtered
                ? "Try a wider date range or another category."
                : "Calls and website chats appear here as soon as your agent handles them."}
            </p>
            {filtered && (
              <button type="button" onClick={clearFilters} className={`${BTN_SECONDARY} mt-5`}>
                Clear filters
              </button>
            )}
          </div>
        )}
      </CommsItem>

      {/* PAGINATION */}
      {!isLoading && pagination.pages > 1 && (
        <div className={`${CARD} flex flex-col items-center justify-between gap-4 px-4 py-4 md:flex-row`}>
          <p className="text-[13px] text-[#6B7A99]">
            Page <span className="font-semibold tabular-nums text-[#0B1B3F] dark:text-white">{pagination.page}</span> of{" "}
            <span className="font-semibold tabular-nums text-[#0B1B3F] dark:text-white">{pagination.pages}</span>,{" "}
            {pagination.total.toLocaleString()} conversations
          </p>
          <nav className="flex items-center gap-1.5" aria-label="Pages">
            <button disabled={pagination.page <= 1} onClick={goPrev} className={`${BTN_SECONDARY} h-9`} aria-label="Previous page">
              <ChevronLeft size={15} />
              Previous
            </button>
            {[...Array(pagination.pages)].map((_, i) => {
              const pNum = i + 1;
              if (pNum === 1 || pNum === pagination.pages || (pNum >= pagination.page - 1 && pNum <= pagination.page + 1)) {
                const current = pagination.page === pNum;
                return (
                  <button
                    key={pNum}
                    aria-current={current ? "page" : undefined}
                    onClick={() => { setPagination(p => ({...p, page: pNum})); fetchConversations(null, pNum); }}
                    className={`hidden h-9 w-9 items-center justify-center rounded-xl text-[13px] font-semibold tabular-nums transition sm:flex focus-visible:outline-2 focus-visible:outline-[#137EFD] ${
                      current ? "bg-[#137EFD] text-white" : "text-[#6B7A99] hover:bg-[#F4F9FF] hover:text-[#0B1B3F] dark:hover:bg-slate-800 dark:hover:text-white"
                    }`}
                  >
                    {pNum}
                  </button>
                );
              }
              if (pNum === 2 || pNum === pagination.pages - 1) return <span key={pNum} className="hidden px-1 text-[#9AA8C2] sm:inline">…</span>;
              return null;
            })}
            <button disabled={pagination.page >= pagination.pages && !nextPage} onClick={goNext} className={`${BTN_SECONDARY} h-9`} aria-label="Next page">
              Next
              <ChevronRight size={15} />
            </button>
          </nav>
        </div>
      )}
      {!isLoading && pagination.pages <= 1 && (nextPage || stack.length > 0) && (
        <div className="flex justify-between gap-2 md:justify-end">
          <button onClick={goPrev} disabled={stack.length === 0 || isLoading} className={BTN_SECONDARY}>
            <ChevronLeft size={15} /> Previous
          </button>
          <button onClick={goNext} disabled={!nextPage || isLoading} className={BTN_SECONDARY}>
            Next <ChevronRight size={15} />
          </button>
        </div>
      )}
    </CommsShell>
  );
}
