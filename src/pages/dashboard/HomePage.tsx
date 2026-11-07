import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, MessageSquare, Smile, Target, Zap, Meh, Frown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { type DateRange } from "react-day-picker";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { kpiAPI } from "@/api/kpi";
import conversationsApi from "@/api/conversations";
import { DatePickerWithRange } from "@/components/DatePickerWithRange";
import type { ConversationsListSummary, KpiTimeseriesPoint } from "@/types/conversation.types";
import type { InsightsResponse, InsightsSummaryResponse, SentimentKey } from "@/types/insights.types";
import {
  ActionsCard,
  ChannelsCard,
  EmotionCard,
  EscalationsCard,
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

export function HomePage() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const [timeseries, setTimeseries] = useState<KpiTimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchKPIs = useCallback(async (isSilent = false) => {
    if (!user?.agent_id) return;
    if (!isSilent) setLoading(true);
    try {
      const res: unknown = await kpiAPI.getKpis(user.agent_id, undefined, undefined, channel);
      const response = res && typeof res === "object" ? res as { timeseries?: unknown } : null;
      const points = Array.isArray(response?.timeseries) ? response.timeseries.flatMap((point): KpiTimeseriesPoint[] => {
        if (!point || typeof point !== "object" || typeof (point as KpiTimeseriesPoint).date !== "string") return [];
        return [point as KpiTimeseriesPoint];
      }) : [];
      setTimeseries(points);
    } catch (err) {
      console.error("Failed to fetch KPIs:", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [user?.agent_id, channel]);

  useEffect(() => {
    fetchKPIs();
    fetchRecent();
    pollTimer.current = setInterval(() => {
      fetchKPIs(true);
      fetchRecent();
    }, 10000); // 10 sec polling for realtime
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [fetchKPIs, fetchRecent, user?.agent_id]);

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
    if (p === "custom") return;

    if (p === "all" && timeseries.length > 0) {
      const dates = timeseries.map(pt => new Date(pt.date).getTime());
      setRange({
        from: getSafeLocalDate(new Date(Math.min(...dates))) || "2020-01-01",
        to: getSafeLocalDate(new Date()) || new Date().toISOString().slice(0, 10)
      });
    } else {
      setRange(getRangeFromPreset(p));
    }
  }, [timeseries]);

  const filteredData = useMemo(() => {
    if (!timeseries.length) return [];

    // Filter out data before integration to ensure accuracy
    const activeData = timeseries.filter(pt => {
      const d = getSafeLocalDate(pt.date);
      return d && d >= INTEGRATION_DATE;
    });

    if (preset === "all") {
      return activeData
        .filter(p => {
          const d = getSafeLocalDate(p.date);
          return d && d >= from && d <= to;
        })
        .map(p => ({
          ...p,
          date: getSafeLocalDate(p.date) || p.date,
          avg_call_duration_secs: p.avg_call_duration_secs ?? 0
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    const pointsMap = new Map<string, KpiTimeseriesPoint>();
    activeData.forEach(p => {
      const d = getSafeLocalDate(p.date);
      if (d) pointsMap.set(d, p);
    });

    const result: KpiTimeseriesPoint[] = [];
    const curr = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");

    while (curr <= end) {
      const dStr = getSafeLocalDate(curr);
      if (!dStr) break;

      const existing = pointsMap.get(dStr);
      result.push(existing ? {
        ...existing,
        date: dStr,
        avg_call_duration_secs: existing.avg_call_duration_secs ?? 0
      } : {
        date: dStr,
        conversations: 0,
        cost_usd: 0,
        messages: 0,
        total_call_duration_secs: 0,
        avg_call_duration_secs: 0
      });
      curr.setDate(curr.getDate() + 1);
    }
    return result;
  }, [timeseries, from, to, preset]);

  const computeMetrics = useCallback((data: KpiTimeseriesPoint[]) => {
    const metrics = data.reduce((acc, p) => ({
      conversations: acc.conversations + p.conversations,
      cost: acc.cost + p.cost_usd,
      messages: acc.messages + p.messages,
      totalDuration: acc.totalDuration + p.total_call_duration_secs,
      leads: acc.leads + (p.leads_captured ?? 0),
    }), { conversations: 0, cost: 0, messages: 0, totalDuration: 0, leads: 0 });

    return {
      ...metrics,
      avgCost: metrics.conversations > 0 ? metrics.cost / metrics.conversations : 0
    };
  }, []);

  const previousMetrics = useMemo(() => {
    const curM = computeMetrics(filteredData);
    if (!timeseries.length || filteredData.length < 2) return { current: curM, previous: curM };

    // Filter timeseries for valid records post-integration
    const activeHistory = timeseries.filter(p => {
      const d = getSafeLocalDate(p.date);
      return d && d >= INTEGRATION_DATE;
    });

    // Determine account age based on INTEGRATION date
    const allDates = activeHistory.map(p => new Date(p.date).getTime());
    if (!allDates.length) return { current: curM, previous: curM };

    const firstDate = Math.min(...allDates);
    const today = new Date().getTime();
    const accountAgeDays = (today - firstDate) / 86400000;
    const periodDays = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;

    // Use Split-Half internal growth if account history is less than 1.5x the period
    const mid = Math.floor(filteredData.length / 2);
    const splitCurrent = computeMetrics(filteredData.slice(mid));
    const splitPrevious = computeMetrics(filteredData.slice(0, mid));

    if (preset === "all" || accountAgeDays < (periodDays * 1.5)) {
      return { current: splitCurrent, previous: splitPrevious };
    }

    const fromTime = new Date(from + "T00:00:00").getTime();
    const durationMs = new Date(to + "T00:00:00").getTime() - fromTime;
    const prevTo = getSafeLocalDate(new Date(fromTime - 86400000));
    const prevFrom = getSafeLocalDate(new Date(fromTime - durationMs - 86400000));

    const prevData = activeHistory.filter(p => {
      const d = getSafeLocalDate(p.date);
      return d && prevFrom && prevTo && d >= prevFrom && d <= prevTo;
    });

    const prevM = computeMetrics(prevData);
    if (prevM.conversations < (curM.conversations * 0.05) && prevM.conversations < 10) {
      return { current: splitCurrent, previous: splitPrevious };
    }

    return { current: curM, previous: prevM };
  }, [timeseries, from, to, preset, filteredData, computeMetrics]);

  const getTrend = (key: keyof ReturnType<typeof computeMetrics>): Trend => {
    if (!previousMetrics) return { text: "0.0%", up: true };
    const cur = previousMetrics.current[key];
    const prev = previousMetrics.previous[key];
    if (prev === 0) return { text: cur > 0 ? "+100%" : "0.0%", up: true };
    const diff = ((cur - prev) / prev) * 100;
    const val = diff > 999 ? 999 : diff < -999 ? -999 : diff;
    return { text: `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`, up: diff >= 0 };
  };

  const currentStats = useMemo(() => computeMetrics(filteredData), [filteredData, computeMetrics]);

  // KPI figures from the insights endpoint.
  const kpi = useMemo(() => {
    const series = insights?.timeseries ?? [];
    const scored = insights?.sentiment.scored ?? 0;
    const prev = insights?.previous ?? null;
    const comparable = scored > 0 && (prev?.sentiment_scored ?? 0) > 0;
    const sentimentCard = (key: SentimentKey, upIsGood?: boolean) => ({
      value: scored > 0 ? `${insights?.sentiment[key].pct ?? 0}%` : "—",
      hint: scored > 0 ? `${(insights?.sentiment[key].count ?? 0).toLocaleString()} of ${scored.toLocaleString()} scored` : "Nothing scored yet",
      trend: pointsTrend(insights?.sentiment[key].pct ?? 0, prev?.sentiment_pct[key], comparable, upIsGood),
      spark: series.map((d) => share(d[key], d.positive + d.neutral + d.negative)),
    });
    const assessable = insights?.totals.assessable ?? 0;
    const urgent = insights?.urgent.count ?? 0;
    const urgentDiff = prev ? urgent - prev.urgent : 0;
    return {
      positive: sentimentCard("positive", true),
      neutral: sentimentCard("neutral"),
      negative: sentimentCard("negative", false),
      intent: {
        value: assessable > 0 ? `${insights?.intent_recognized.pct ?? 0}%` : "—",
        hint: assessable > 0 ? `${(insights?.intent_recognized.count ?? 0).toLocaleString()} of ${assessable.toLocaleString()} conversations` : "Nothing analysed yet",
        trend: pointsTrend(insights?.intent_recognized.pct ?? 0, prev?.intent_recognized_pct, assessable > 0 && (prev?.assessable ?? 0) > 0, true),
        spark: series.map((d) => share(d.recognized, d.assessable)),
      },
      urgent: {
        value: insights ? urgent.toLocaleString() : "—",
        hint: insights?.totals.pending ? `${insights.totals.pending.toLocaleString()} still being analysed` : undefined,
        trend: prev && (urgent > 0 || prev.urgent > 0)
          ? { text: `${Math.abs(urgentDiff)} vs prev`, up: urgentDiff >= 0, good: urgentDiff <= 0 }
          : undefined,
        spark: series.map((d) => d.urgent),
      },
    };
  }, [insights]);

  const conversationSeries = useMemo(() => filteredData.map((p) => p.conversations), [filteredData]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good Morning!" : hour < 18 ? "Good Afternoon!" : "Good Evening!";
  }, []);

  const totalText = loading ? "—" : currentStats.conversations.toLocaleString();
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

      {/* KPI ROW */}
      <motion.div variants={item} className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Total Conversations"
          value={totalText}
          trend={getTrend("conversations")}
          icon={MessageSquare}
          iconFrom="#137EFD"
          iconTo="#5AB8FF"
          spark={conversationSeries.length ? conversationSeries : [0, 0]}
          sparkId="spark-total"
          loading={loading}
        />
        <KpiCard
          label="Positive Sentiment"
          value={kpi.positive.value}
          trend={kpi.positive.trend}
          hint={kpi.positive.hint}
          icon={Smile}
          iconFrom="#1FB867"
          iconTo="#6FE0A0"
          spark={kpi.positive.spark}
          sparkId="spark-pos"
          loading={insightsBusy}
        />
        <KpiCard
          label="Neutral Sentiment"
          value={kpi.neutral.value}
          trend={kpi.neutral.trend}
          hint={kpi.neutral.hint}
          icon={Meh}
          iconFrom="#F0A500"
          iconTo="#FFD35C"
          spark={kpi.neutral.spark}
          sparkId="spark-neu"
          loading={insightsBusy}
        />
        <KpiCard
          label="Negative Sentiment"
          value={kpi.negative.value}
          trend={kpi.negative.trend}
          hint={kpi.negative.hint}
          icon={Frown}
          iconFrom="#ED5173"
          iconTo="#FF8FA3"
          spark={kpi.negative.spark}
          sparkId="spark-neg"
          loading={insightsBusy}
        />
        <KpiCard
          label="Intent Recognized"
          value={kpi.intent.value}
          trend={kpi.intent.trend}
          hint={kpi.intent.hint}
          icon={Target}
          iconFrom="#7732FD"
          iconTo="#A779FF"
          spark={kpi.intent.spark}
          sparkId="spark-intent"
          loading={insightsBusy}
        />
        <KpiCard
          label="Urgent Cases"
          value={kpi.urgent.value}
          trend={kpi.urgent.trend}
          hint={kpi.urgent.hint}
          icon={Zap}
          iconFrom="#FF6B35"
          iconTo="#FFB27A"
          spark={kpi.urgent.spark}
          sparkId="spark-urgent"
          loading={insightsBusy}
        />
      </motion.div>

      {/* TREND + DISTRIBUTION + INTENTS */}
      <motion.div variants={item} className="grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr_1fr]">
        <SentimentTrendCard points={insights?.timeseries ?? []} loading={insightsLoading} />
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
      <motion.div variants={item} className="grid grid-cols-1 gap-5 lg:grid-cols-[1.45fr_1fr_1fr]">
        <RecentConversationsCard items={recent} loading={recentLoading} />
        <EscalationsCard insights={insights} loading={insightsLoading} />
        <ActionsCard summary={summary} loading={summaryLoading} />
      </motion.div>
    </motion.div>
  );
}
