import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, MessageSquare, Smile, Target, Zap, Meh, Frown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { type DateRange } from "react-day-picker";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { kpiAPI } from "@/api/kpi";
import conversationsApi from "@/api/conversations";
import { DatePickerWithRange } from "@/components/DatePickerWithRange";
import type { ConversationsListSummary } from "@/types/conversation.types";
import { conversationsHref, type DrilldownFilters } from "@/lib/conversationFilters";
import type { InsightsResponse, InsightsSummaryResponse, SentimentKey } from "@/types/insights.types";
import {
  ActionsCard,
  ChannelsCard,
  CoverageBar,
  EmotionCard,
  EscalationsCard,
  HomeDrillContext,
  KpiCard,
  NAVY,
  RecentConversationsCard,
  SentimentDistributionCard,
  SentimentTrendCard,
  SummaryCard,
  TopIntentsCard,
  type Trend,
} from "./home/HomeWidgets";

/* ================= TYPES & HELPERS ================= */

type Preset = "7d" | "15d" | "30d" | "all" | "custom";
type ChannelFilter = "all" | "web_call" | "phone_call";

// Official integration began March 23rd, 2026.
// Do not start counts before this to avoid skewed percentages.
const INTEGRATION_DATE = "2026-03-23";

const CHANNEL_OPTIONS: { value: ChannelFilter; label: string }[] = [
  { value: "all", label: "All Channels" },
  { value: "web_call", label: "Website" },
  { value: "phone_call", label: "Telephone" },
];

const getSafeLocalDate = (dateInput: string | Date) => {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getRangeFromPreset = (preset: Preset) => {
  const end = new Date();
  const start = new Date();

  switch (preset) {
    case "7d": start.setDate(end.getDate() - 6); break;
    case "15d": start.setDate(end.getDate() - 14); break;
    case "30d": start.setDate(end.getDate() - 29); break;
    case "all": start.setTime(new Date(INTEGRATION_DATE).getTime()); break;
  }

  const startStr = getSafeLocalDate(start) || start.toISOString().slice(0, 10);
  const endStr = getSafeLocalDate(end) || end.toISOString().slice(0, 10);

  // Clamp to INTEGRATION_DATE if preset would go before it
  return {
    from: startStr < INTEGRATION_DATE ? INTEGRATION_DATE : startStr,
    to: endStr,
  };
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

/** Change in percentage points against the previous period; undefined when there is nothing to compare. */
const pointsTrend = (current: number, previous: number | undefined, hasBoth: boolean, upIsGood?: boolean): Trend | undefined => {
  if (!hasBoth || previous === undefined) return undefined;
  const diff = current - previous;
  return {
    text: `${Math.abs(diff).toFixed(1)} pts`,
    up: diff >= 0,
    good: upIsGood === undefined ? undefined : upIsGood ? diff >= 0 : diff <= 0,
    neutral: upIsGood === undefined,
  };
};

const share = (part: number, whole: number) => (whole > 0 ? (part * 100) / whole : 0);

const INSIGHTS_POLL_MS = 30_000;
const SUMMARY_POLL_MS = 5 * 60_000;

/* ================= MAIN PAGE ================= */

/** Relative change, for counts (unlike the percentage-point trends above). */
const countTrend = (current: number, previous: number | undefined): Trend | undefined => {
  if (previous === undefined) return undefined;
  if (previous === 0) return current > 0 ? { text: "new", up: true, neutral: true } : undefined;
  const diff = ((current - previous) / previous) * 100;
  const clamped = Math.max(-999, Math.min(999, diff));
  return { text: `${Math.abs(clamped).toFixed(1)}%`, up: diff >= 0, neutral: true };
};

export function HomePage() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const [preset, setPreset] = useState<Preset>("7d");
  const [{ from, to }, setRange] = useState(() => getRangeFromPreset("7d"));
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [recent, setRecent] = useState<ConversationsListSummary[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [summary, setSummary] = useState<InsightsSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Responses for a range the user has already moved away from are dropped.
  const insightsRequest = useRef(0);
  const summaryRequest = useRef(0);

  const fetchRecent = useCallback(async () => {
    if (!user?.agent_id) return;
    try {
      const res = await conversationsApi.getConversations(user.agent_id, null, 1, 5, undefined, undefined, undefined, undefined, undefined, true);
      setRecent(res.conversations ?? []);
    } catch (err) {
      console.error("Failed to fetch recent conversations:", err);
    } finally {
      setRecentLoading(false);
    }
  }, [user?.agent_id]);

  useEffect(() => {
    fetchRecent();
    pollTimer.current = setInterval(fetchRecent, 10000); // 10 sec polling for realtime
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [fetchRecent]);

  // Sentiment, emotion, intent, urgency and channel figures for the selected range.
  const fetchInsights = useCallback(async (isSilent = false) => {
    if (!user?.agent_id) return;
    const id = ++insightsRequest.current;
    if (!isSilent) setInsightsLoading(true);
    try {
      const res = await kpiAPI.getInsights(from || undefined, to || undefined, channel);
      // A malformed response (proxy error page, older backend) is ignored so
      // the cards fall back to their empty state instead of crashing.
      if (id === insightsRequest.current) setInsights(res?.sentiment && res?.totals ? res : null);
    } catch (err) {
      console.error("Failed to fetch dashboard insights:", err);
    } finally {
      if (id === insightsRequest.current) setInsightsLoading(false);
    }
  }, [user?.agent_id, from, to, channel]);

  const fetchSummary = useCallback(async () => {
    if (!user?.agent_id) return;
    const id = ++summaryRequest.current;
    setSummaryLoading(true);
    try {
      const res = await kpiAPI.getInsightsSummary(from || undefined, to || undefined, channel);
      if (id === summaryRequest.current) setSummary(typeof res?.summary === "string" ? res : null);
    } catch (err) {
      console.error("Failed to fetch dashboard summary:", err);
      if (id === summaryRequest.current) setSummary(null);
    } finally {
      if (id === summaryRequest.current) setSummaryLoading(false);
    }
  }, [user?.agent_id, from, to, channel]);

  useEffect(() => {
    fetchInsights();
    const timer = setInterval(() => fetchInsights(true), INSIGHTS_POLL_MS);
    return () => clearInterval(timer);
  }, [fetchInsights]);

  useEffect(() => {
    fetchSummary();
    const timer = setInterval(fetchSummary, SUMMARY_POLL_MS);
    return () => clearInterval(timer);
  }, [fetchSummary]);

  const handlePresetChange = useCallback((p: Preset) => {
    setPreset(p);
    if (p !== "custom") setRange(getRangeFromPreset(p));
  }, []);

  // Every figure links to Conversations with this range and channel applied.
  const drill = useCallback(
    (filters: DrilldownFilters = {}) =>
      conversationsHref({ start_date: from || undefined, end_date: to || undefined, source: channel, ...filters }),
    [from, to, channel]
  );
  const dayHref = useCallback(
    (date: string) => conversationsHref({ start_date: date, end_date: date, source: channel }),
    [channel]
  );

  // Every KPI, Total Conversations included, comes from the insights endpoint,
  // so all cards count the same set of conversations.
  const kpi = useMemo(() => {
    const series = insights?.timeseries ?? [];
    const scored = insights?.sentiment.scored ?? 0;
    const prev = insights?.previous ?? null;
    const comparable = scored > 0 && (prev?.sentiment_scored ?? 0) > 0;
    const totals = insights?.totals;
    const n = (v: number | undefined) => (v ?? 0).toLocaleString();
    // Why a percentage's base is smaller than Total Conversations.
    const skipped: [string, string][] = totals
      ? [
          ["Too short to judge", n(totals.not_assessable)],
          ["Waiting for analysis", n(totals.pending)],
          ...(totals.no_transcript ? [["No transcript", n(totals.no_transcript)] as [string, string]] : []),
        ]
      : [];
    const sentimentCard = (key: SentimentKey, label: string, upIsGood?: boolean) => ({
      value: scored > 0 ? `${insights?.sentiment[key].pct ?? 0}%` : "—",
      hint: scored > 0 ? `${n(insights?.sentiment[key].count)} of ${n(scored)} scored` : "Nothing scored yet",
      trend: pointsTrend(insights?.sentiment[key].pct ?? 0, prev?.sentiment_pct[key], comparable, upIsGood),
      spark: series.map((d) => share(d[key], d.positive + d.neutral + d.negative)),
      tip: {
        title: `${label} sentiment`,
        rows: [
          [label, n(insights?.sentiment[key].count)],
          ["Scored conversations", n(scored)],
          ...(prev ? [["Previous period", `${prev.sentiment_pct[key]}%`] as [string, string]] : []),
        ] as [string, string][],
        note: `Share of the ${n(scored)} conversations that could be scored, out of ${n(totals?.conversations)} in total.`,
      },
    });
    const assessable = totals?.assessable ?? 0;
    const urgent = insights?.urgent.count ?? 0;
    const urgentDiff = prev ? urgent - prev.urgent : 0;
    const recognized = insights?.intent_recognized.count ?? 0;
    return {
      total: {
        value: insights ? n(totals?.conversations) : "—",
        hint: totals ? `${n(totals.analysed)} analysed` : undefined,
        trend: countTrend(totals?.conversations ?? 0, prev?.conversations),
        spark: series.map((d) => d.total),
        tip: {
          title: "Total conversations",
          rows: [["All conversations", n(totals?.conversations)], ["Analysed with enough speech", n(assessable)], ...skipped] as [string, string][],
          note: prev ? `Previous period: ${n(prev.conversations)}.` : undefined,
        },
      },
      positive: sentimentCard("positive", "Positive", true),
      neutral: sentimentCard("neutral", "Neutral"),
      negative: sentimentCard("negative", "Negative", false),
      intent: {
        value: assessable > 0 ? `${insights?.intent_recognized.pct ?? 0}%` : "—",
        hint: assessable > 0 ? `${n(recognized)} of ${n(assessable)} conversations` : "Nothing analysed yet",
        trend: pointsTrend(insights?.intent_recognized.pct ?? 0, prev?.intent_recognized_pct, assessable > 0 && (prev?.assessable ?? 0) > 0, true),
        spark: series.map((d) => share(d.recognized, d.assessable)),
        tip: {
          title: "Intent recognised",
          rows: [["Clear admissions topic", n(recognized)], ["Topic “Other” or unclear", n(assessable - recognized)], ["Base (enough speech)", n(assessable)], ...skipped] as [string, string][],
          note: "Only conversations with enough speech are counted; the rest are listed above.",
        },
      },
      urgent: {
        value: insights ? urgent.toLocaleString() : "—",
        hint: totals?.pending ? `${n(totals.pending)} still being analysed` : undefined,
        trend: prev && (urgent > 0 || prev.urgent > 0)
          ? { text: `${Math.abs(urgentDiff)} vs prev`, up: urgentDiff >= 0, good: urgentDiff <= 0 }
          : undefined,
        spark: series.map((d) => d.urgent),
        tip: {
          title: "Urgent cases",
          rows: [
            ["Urgent", n(urgent)],
            ...(insights?.escalations.urgent_by_topic.slice(0, 3).map((t) => [t.label, n(t.count)] as [string, string]) ?? []),
            ...(prev ? [["Previous period", n(prev.urgent)] as [string, string]] : []),
          ] as [string, string][],
          note: "A deadline, a complaint or a problem blocking the caller.",
        },
      },
    };
  }, [insights]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good Morning!" : hour < 18 ? "Good Afternoon!" : "Good Evening!";
  }, []);

  const insightsBusy = insightsLoading && !insights;

  const motionProps = reduceMotion
    ? { initial: false as const }
    : { variants: container, initial: "hidden" as const, animate: "show" as const };

  return (
    <motion.div
      {...motionProps}
      className="home-dash space-y-5 rounded-3xl bg-[#F4F9FF] p-3 sm:p-5 dark:bg-[#081022]"
      style={{ fontFamily: "Poppins, Manrope, sans-serif" }}
    >
      {/* HEADER */}
      <motion.div variants={item} className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight sm:text-[32px]" style={{ color: NAVY }}>
            {greeting}
            <span className="sr-only"> Dashboard overview</span>
          </h1>
          <p className="mt-1 text-[14px]" style={{ color: "var(--home-muted, #6B7A99)" }}>
            Here’s what your conversations are telling you today.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Presets */}
          <div className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-sky-100 dark:bg-slate-900 dark:ring-slate-800">
            {(["7d", "15d", "30d", "all"] as Preset[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePresetChange(p)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#137EFD] ${
                  preset === p ? "bg-[#137EFD] text-white shadow-sm" : "text-[#6B7A99] hover:text-[#0B1B3F] dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {p === "30d" ? "1M" : p === "all" ? "ALL" : p.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex items-center rounded-xl bg-white px-2 py-1 shadow-sm ring-1 ring-sky-100 dark:bg-slate-900 dark:ring-slate-800">
            <DatePickerWithRange
              value={from ? { from: parseISO(from), to: to ? parseISO(to) : undefined } : undefined}
              onChange={(range: DateRange | undefined) => {
                setPreset("custom");
                setRange({
                  from: range?.from ? format(range.from, "yyyy-MM-dd") : "",
                  to: range?.to ? format(range.to, "yyyy-MM-dd") : "",
                });
              }}
              label="Date Range"
            />
          </div>

          {/* Channel filter — live (passed to /v3/kpis) */}
          <label className="relative flex items-center rounded-xl bg-white shadow-sm ring-1 ring-sky-100 dark:bg-slate-900 dark:ring-slate-800">
            <span className="sr-only">Channel</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as ChannelFilter)}
              className="h-9 cursor-pointer appearance-none rounded-xl bg-transparent pl-4 pr-9 [&>option]:text-[#0B1B3F] text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#137EFD]"
              style={{ color: NAVY }}
            >
              {CHANNEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4" style={{ color: "var(--home-muted, #6B7A99)" }} />
          </label>
        </div>
      </motion.div>

      <HomeDrillContext.Provider value={drill}>
      {/* KPI ROW — every card opens the conversations it counted */}
      <motion.div variants={item} className="grid grid-cols-2 gap-4 md:grid-cols-3 min-[1700px]:grid-cols-6">
        <KpiCard
          label="Total Conversations"
          value={kpi.total.value}
          trend={kpi.total.trend}
          hint={kpi.total.hint}
          tip={kpi.total.tip}
          filters={{}}
          icon={MessageSquare}
          iconFrom="#137EFD"
          iconTo="#5AB8FF"
          spark={kpi.total.spark.length > 1 ? kpi.total.spark : [0, 0]}
          sparkId="spark-total"
          loading={insightsBusy}
        />
        <KpiCard
          label="Positive Sentiment"
          value={kpi.positive.value}
          trend={kpi.positive.trend}
          hint={kpi.positive.hint}
          tip={kpi.positive.tip}
          filters={{ sentiment: "positive" }}
          icon={Smile}
          iconFrom="#1FB867"
          iconTo="#6FE0A0"
          spark={kpi.positive.spark.length > 1 ? kpi.positive.spark : [0, 0]}
          sparkId="spark-pos"
          loading={insightsBusy}
        />
        <KpiCard
          label="Neutral Sentiment"
          value={kpi.neutral.value}
          trend={kpi.neutral.trend}
          hint={kpi.neutral.hint}
          tip={kpi.neutral.tip}
          filters={{ sentiment: "neutral" }}
          icon={Meh}
          iconFrom="#F0A500"
          iconTo="#FFD35C"
          spark={kpi.neutral.spark.length > 1 ? kpi.neutral.spark : [0, 0]}
          sparkId="spark-neu"
          loading={insightsBusy}
        />
        <KpiCard
          label="Negative Sentiment"
          value={kpi.negative.value}
          trend={kpi.negative.trend}
          hint={kpi.negative.hint}
          tip={kpi.negative.tip}
          filters={{ sentiment: "negative" }}
          icon={Frown}
          iconFrom="#ED5173"
          iconTo="#FF8FA3"
          spark={kpi.negative.spark.length > 1 ? kpi.negative.spark : [0, 0]}
          sparkId="spark-neg"
          loading={insightsBusy}
        />
        <KpiCard
          label="Intent Recognized"
          value={kpi.intent.value}
          trend={kpi.intent.trend}
          hint={kpi.intent.hint}
          tip={kpi.intent.tip}
          filters={{ intent_recognized: true }}
          icon={Target}
          iconFrom="#7732FD"
          iconTo="#A779FF"
          spark={kpi.intent.spark.length > 1 ? kpi.intent.spark : [0, 0]}
          sparkId="spark-intent"
          loading={insightsBusy}
        />
        <KpiCard
          label="Urgent Cases"
          value={kpi.urgent.value}
          trend={kpi.urgent.trend}
          hint={kpi.urgent.hint}
          tip={kpi.urgent.tip}
          filters={{ urgent: true }}
          icon={Zap}
          iconFrom="#FF6B35"
          iconTo="#FFB27A"
          spark={kpi.urgent.spark.length > 1 ? kpi.urgent.spark : [0, 0]}
          sparkId="spark-urgent"
          loading={insightsBusy}
        />
      </motion.div>

      {/* What the percentages are out of, and why that is less than the total */}
      <motion.div variants={item}>
        <CoverageBar insights={insights} />
      </motion.div>

      {/* TREND + DISTRIBUTION + INTENTS */}
      <motion.div variants={item} className="grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr_1fr]">
        <SentimentTrendCard points={insights?.timeseries ?? []} loading={insightsLoading} dayHref={dayHref} />
        <SentimentDistributionCard insights={insights} loading={insightsLoading} />
        <TopIntentsCard insights={insights} loading={insightsLoading} />
      </motion.div>

      {/* EMOTION + CHANNELS + SUMMARY */}
      <motion.div variants={item} className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr_1.25fr]">
        <EmotionCard insights={insights} loading={insightsLoading} />
        <ChannelsCard insights={insights} loading={insightsLoading} />
        <SummaryCard summary={summary} loading={summaryLoading} />
      </motion.div>

      {/* RECENT + ESCALATIONS + ACTIONS */}
      {/* The table needs ~640px, so it takes the full row; escalations and actions share the next. */}
      <motion.div variants={item} className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RecentConversationsCard items={recent} loading={recentLoading} className="lg:col-span-2" />
        <EscalationsCard insights={insights} loading={insightsLoading} />
        <ActionsCard summary={summary} loading={summaryLoading} />
      </motion.div>
      </HomeDrillContext.Provider>
    </motion.div>
  );
}
