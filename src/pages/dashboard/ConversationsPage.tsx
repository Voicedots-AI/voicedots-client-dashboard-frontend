import { useState, useEffect, useCallback } from "react";
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

export function ConversationsPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [conversations, setConversations] = useState<ConversationsListSummary[]>([]);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [stack, setStack] = useState<string[]>([]);

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    pages: 1
  });

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [source, setSource] = useState<Source>("all");
  const [category, setCategory] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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
          category
        );

        setConversations(convData.conversations);
        setNextPage(convData.nextPage);
        if (convData.pagination) setPagination(convData.pagination as any);
      } catch (error) {
        console.error("Failed to load conversations", error);
        setLoadError("Conversations could not be loaded. Check your connection and try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [user?.agent_id, pagination.limit, startDate, endDate, source, appliedSearch, category]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedSearch(searchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPagination(p => ({...p, page: 1}));
    setStack([]);
    fetchConversations(null, 1);
  }, [startDate, endDate, source, category, appliedSearch, fetchConversations]);

  const goPrev = () => { setPagination(p => ({...p, page: Math.max(1, p.page - 1)})); fetchConversations(pop() ?? null, pagination.page - 1); };
  const goNext = () => { if (nextPage) push(nextPage); setPagination(p => ({...p, page: Math.min(pagination.pages, p.page + 1)})); fetchConversations(nextPage, pagination.page + 1); };
  const filtered = Boolean(startDate || endDate || category || appliedSearch || source !== "all");
  const clearFilters = () => { setStartDate(""); setEndDate(""); setCategory(""); setSearchQuery(""); setSource("all"); };

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
          <div className="grid grid-cols-1 items-center gap-3 lg:grid-cols-[auto_auto_minmax(240px,1fr)]">
            <SegmentTabs label="Channel" value={source} onChange={setSource} tabs={SOURCE_TABS} />
            {/* The shared picker carries its own label and button styles; align them with this toolbar. */}
            <div className="min-w-0 [&_[data-slot=field-label]]:sr-only [&_label]:sr-only [&_button]:h-10 [&_button]:rounded-xl [&_button]:border-0 [&_button]:bg-[#F4F9FF] [&_button]:text-sm [&_button]:text-[#0B1B3F] [&_button]:ring-1 [&_button]:ring-sky-100 dark:[&_button]:bg-slate-950 dark:[&_button]:text-slate-100 dark:[&_button]:ring-slate-700">
              <DatePickerWithRange
                value={startDate ? { from: parseISO(startDate), to: endDate ? parseISO(endDate) : undefined } : undefined}
                onChange={(range) => {
                  setStartDate(range?.from ? format(range.from, "yyyy-MM-dd") : "");
                  setEndDate(range?.to ? format(range.to, "yyyy-MM-dd") : "");
                }}
                label="Date range"
                className="w-full lg:w-auto"
                showClear={Boolean(startDate || endDate)}
              />
            </div>
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
                      ? "bg-[#0B1B3F] text-white shadow-sm dark:bg-white dark:text-[#0B1B3F]"
                      : "bg-[#F4F9FF] text-[#55648A] ring-1 ring-sky-100 hover:text-[#0B1B3F] dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700"
                  }`}
                >
                  {value || "All"}
                </button>
              );
            })}
          </div>
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
                      current ? "bg-[#137EFD] text-white shadow-sm" : "text-[#6B7A99] hover:bg-[#F4F9FF] hover:text-[#0B1B3F]"
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
