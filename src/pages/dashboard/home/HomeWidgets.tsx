import { createContext, useContext, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CONVERSATIONS_PATH, type DrilldownFilters } from "@/lib/conversationFilters";
import { format, parseISO, isToday } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Angry,
  Annoyed,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarClock,
  ChevronRight,
  FileText,
  Frown,
  Globe,
  GraduationCap,
  Hash,
  Laugh,
  Meh,
  MessageCircle,
  MoreHorizontal,
  Phone,
  PhoneCall,
  Receipt,
  Smile,
  Sparkles,
  ThumbsDown,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { ConversationsListSummary } from "@/types/conversation.types";
import type {
  ActionKind,
  EmotionKey,
  InsightsResponse,
  InsightsSummaryResponse,
  InsightsTimeseriesPoint,
} from "@/types/insights.types";

/* ================= SHARED ================= */

/**
 * `good` overrides the colour when "up" is bad news (e.g. negative sentiment rising);
 * `neutral` renders a grey chip for changes that are neither good nor bad.
 */
export type Trend = { text: string; up: boolean; good?: boolean; neutral?: boolean };

// Text and line colours follow the theme: .home-dash sets these variables,
// and the fallbacks are the light-mode values.
export const NAVY = "var(--home-ink, #0B1B3F)";
const MUTED = "var(--home-muted, #6B7A99)";
const GRID = "var(--home-grid, #E6EDF8)";

// Vivid brand + sentiment palette used across the Home cards.
export const PALETTE = {
  blue: "#137EFD",
  sky: "#33B0E6",
  green: "#1FB867",
  yellow: "#F0A500",
  red: "#ED5173",
  purple: "#7732FD",
  orange: "#FF8A3D",
  pink: "#F27198",
  teal: "#14B8A6",
  slate: "#8A9BB5",
};

const CARD =
  "rounded-2xl bg-white shadow-[0_1px_2px_rgba(18,50,120,0.04),0_4px_16px_rgba(18,50,120,0.05)] ring-1 ring-sky-100/80 dark:bg-slate-900 dark:ring-slate-800";

const fmt = (n: number) => Math.round(n).toLocaleString();

function CardHeader({ title, action, children }: { title: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-semibold" style={{ color: NAVY }}>
          {title}
        </h2>
        {children}
      </div>
      {action}
    </header>
  );
}

function ViewAll({ to, children = "View All" }: { to?: string; children?: ReactNode }) {
  const cls = "shrink-0 whitespace-nowrap text-[12px] font-semibold text-[#137EFD] hover:underline";
  return to ? (
    <Link to={to} className={cls}>
      {children} →
    </Link>
  ) : (
    <span className={cls}>{children} →</span>
  );
}

/* ================= DRILL-DOWN ================= */

/**
 * Turns a figure's filters into a Conversations link for the dashboard's
 * current dates and channel. HomePage provides it; every card reads it.
 */
export const HomeDrillContext = createContext<(filters?: DrilldownFilters) => string>(() => CONVERSATIONS_PATH);
const useDrill = () => useContext(HomeDrillContext);

export type TipContent = { title: string; rows?: [string, ReactNode][]; note?: ReactNode };

/** Hover / keyboard-focus card explaining a figure. Purely visual; the link carries the action. */
function HoverTip({ tip, place = "top" }: { tip: TipContent; place?: "top" | "bottom" }) {
  return (
    <span
      role="tooltip"
      className={`pointer-events-none absolute left-1/2 z-40 w-max min-w-[180px] max-w-[260px] -translate-x-1/2 rounded-xl bg-[#0B1B3F] px-3.5 py-3 text-left text-[12px] text-white opacity-0 shadow-[0_12px_30px_rgba(11,27,63,0.35)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${
        place === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"
      }`}
    >
      <span className="block font-semibold">{tip.title}</span>
      {tip.rows && tip.rows.length > 0 && (
        <span className="mt-1.5 block space-y-1">
          {tip.rows.map(([label, value]) => (
            <span key={label} className="flex items-baseline justify-between gap-4">
              <span className="text-[#9FD3FF]">{label}</span>
              <span className="font-semibold tabular-nums">{value}</span>
            </span>
          ))}
        </span>
      )}
      {tip.note && <span className="mt-1.5 block text-[11px] leading-snug text-white/70">{tip.note}</span>}
      <span className="mt-2 block border-t border-white/10 pt-1.5 text-[11px] font-semibold text-[#9FD3FF]">
        Click to see these conversations →
      </span>
    </span>
  );
}

/** A figure that opens the conversations it counted, with a hover explanation. */
function DrillLink({
  filters,
  tip,
  label,
  className = "",
  place,
  children,
}: {
  filters: DrilldownFilters;
  tip: TipContent;
  /** Accessible name; the tooltip text is not read as part of the link. */
  label: string;
  className?: string;
  place?: "top" | "bottom";
  children: ReactNode;
}) {
  const href = useDrill()(filters);
  return (
    <Link
      to={href}
      aria-label={label}
      className={`group relative cursor-pointer transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#137EFD] ${className}`}
    >
      {children}
      <HoverTip tip={tip} place={place} />
    </Link>
  );
}

const plural = (n: number, word: string) => `${fmt(n)} ${word}${n === 1 ? "" : "s"}`;

/** Solid gradient chip with a white icon. */
function IconChip({ icon: Icon, from, to, size = "h-9 w-9", iconSize = "h-4 w-4" }: { icon: LucideIcon; from: string; to: string; size?: string; iconSize?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl text-white ${size}`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22)" }}
    >
      <Icon className={iconSize} strokeWidth={2.25} />
    </span>
  );
}

/** Centred placeholder used while loading or when a card has nothing to show yet. */
function EmptyState({ loading, children }: { loading?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center py-8 text-center text-sm" style={{ color: MUTED }}>
      {loading ? "Loading…" : children}
    </div>
  );
}

/** "Based on N analysed · M still being analysed" — keeps every share honest about its base. */
export function AnalysisNote({ insights, base }: { insights: InsightsResponse | null; base: number }) {
  if (!insights) return null;
  const pending = insights.totals.pending;
  return (
    <p className="mt-3 text-[11px]" style={{ color: MUTED }}>
      Based on {fmt(base)} analysed conversation{base === 1 ? "" : "s"}
      {pending > 0 && <> · {fmt(pending)} still being analysed</>}
    </p>
  );
}

/* ================= KPI CARD ================= */

function Sparkline({ values, color, id }: { values: number[]; color: string; id: string }) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div className="h-11 w-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 160, height: 44 }}>
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  trend,
  icon,
  iconFrom,
  iconTo,
  spark,
  sparkId,
  loading,
  hint,
  filters,
  tip,
}: {
  label: string;
  value: string;
  trend?: Trend;
  icon: LucideIcon;
  iconFrom: string;
  iconTo: string;
  spark: number[];
  sparkId: string;
  loading?: boolean;
  /** Small muted line under the value, e.g. what a percentage is out of. */
  hint?: string;
  /** When set, the card opens the conversations it counted. */
  filters?: DrilldownFilters;
  tip?: TipContent;
}) {
  const good = trend?.good ?? trend?.up ?? true;
  const chipCls = trend?.neutral
    ? "bg-[#EEF2F7] text-[#5B6B88] dark:bg-slate-800 dark:text-slate-300"
    : good
      ? "bg-[#DDF7E8] text-[#118A4B] dark:bg-emerald-500/15 dark:text-emerald-300"
      : "bg-[#FDE4EA] text-[#C42D52] dark:bg-rose-500/15 dark:text-rose-300";
  const body = (
    <div className={`${CARD} flex h-full min-w-0 flex-col p-4 sm:p-5 ${filters ? "transition group-hover:ring-[#137EFD]/45" : ""}`}>
      <div className="flex items-start gap-3">
        <IconChip icon={icon} from={iconFrom} to={iconTo} size="h-11 w-11" iconSize="h-5 w-5" />
        <div className="min-w-0 flex-1">
          {/* Wraps rather than truncating: six cards share the row on laptop screens. */}
          <p className="text-[12px] font-medium leading-tight" style={{ color: MUTED }}>
            {label}
          </p>
          <p className="mt-0.5 text-[26px] font-semibold leading-none tabular-nums" style={{ color: NAVY }}>
            {loading ? "—" : value}
          </p>
          {!loading && trend && (
            <span
              className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${chipCls}`}
            >
              {trend.up ? "↑" : "↓"} {trend.text}
            </span>
          )}
          {!loading && hint && (
            <p className="mt-1.5 text-[11px] leading-snug" style={{ color: MUTED }}>
              {hint}
            </p>
          )}
        </div>
      </div>
      {/* Pinned to the bottom, so sparklines line up whatever the labels wrap to. */}
      <div className="mt-auto pt-3">
        <Sparkline values={spark.length > 1 ? spark : [0, 0]} color={iconFrom} id={sparkId} />
      </div>
    </div>
  );
  if (!filters || loading) return body;
  return (
    <DrillLink filters={filters} tip={tip ?? { title: label }} label={`${label}: ${value}. View these conversations`} className="block min-w-0 rounded-2xl" place="bottom">
      {body}
    </DrillLink>
  );
}

/* ================= ANALYSIS COVERAGE ================= */

/**
 * Why a percentage card's base is smaller than Total Conversations: only
 * analysed conversations with enough speech can carry sentiment or intent.
 * Each part opens the conversations it counts.
 */
export function CoverageBar({ insights }: { insights: InsightsResponse | null }) {
  if (!insights || insights.totals.conversations === 0) return null;
  const t = insights.totals;
  const parts: { key: string; count: number; label: string; color: string; filters: DrilldownFilters; note: string }[] = [
    { key: "assessable", count: t.assessable, label: "analysed with enough speech", color: PALETTE.green,
      filters: { analysis_state: "assessable" },
      note: "These are the conversations behind the sentiment, intent and urgency figures." },
    { key: "not_assessable", count: t.not_assessable, label: "too short to judge", color: PALETTE.slate,
      filters: { analysis_state: "not_assessable" },
      note: "Missed, silent or very short calls. They are analysed, but say too little to score." },
    { key: "pending", count: t.pending, label: "waiting for analysis", color: PALETTE.yellow,
      filters: { analysis_state: "pending" },
      note: "The background worker has not analysed these yet. They join the figures once it does." },
    { key: "no_transcript", count: t.no_transcript, label: "no transcript", color: "#C3CEDF",
      filters: { analysis_state: "no_transcript" },
      note: "Nothing was recorded, so there is nothing to analyse." },
  ];
  const shown = parts.filter((p) => p.count > 0);
  return (
    <div className={`${CARD} px-4 py-3 sm:px-5`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]" style={{ color: MUTED }}>
        <span className="font-semibold" style={{ color: NAVY }}>
          {plural(t.conversations, "conversation")}:
        </span>
        {shown.map((p) => (
          <DrillLink
            key={p.key}
            filters={p.filters}
            label={`${fmt(p.count)} ${p.label}. View these conversations`}
            tip={{ title: `${fmt(p.count)} ${p.label}`, rows: [["Share of all", `${Math.round((p.count * 100) / t.conversations)}%`]], note: p.note }}
            className="inline-flex items-center gap-1.5 rounded-md hover:text-[#137EFD]"
            place="bottom"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="font-semibold tabular-nums" style={{ color: NAVY }}>{fmt(p.count)}</span>
            {p.label}
          </DrillLink>
        ))}
      </div>
      {/* The same split as a bar, so the gap between Total and the scored figures is visible at a glance. */}
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-[#EEF3FB] dark:bg-slate-800" aria-hidden>
        {shown.map((p) => (
          <span key={p.key} style={{ width: `${(p.count * 100) / t.conversations}%`, background: p.color }} />
        ))}
      </div>
    </div>
  );
}

/* ================= SENTIMENT TREND ================= */

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

const dayLabel = (iso: string) => {
  try {
    return format(parseISO(iso), "d MMM");
  } catch {
    return iso;
  }
};

export function SentimentTrendCard({
  points,
  loading,
  dayHref,
}: {
  points: InsightsTimeseriesPoint[];
  loading: boolean;
  /** Link to one IST day's conversations. */
  dayHref?: (date: string) => string;
}) {
  const navigate = useNavigate();
  const openDay = (state: unknown) => {
    const index = Number((state as { activeTooltipIndex?: number | string } | null)?.activeTooltipIndex);
    const point = Number.isInteger(index) ? points[index] : undefined;
    if (point && point.total > 0 && dayHref) navigate(dayHref(point.date));
  };
  const data = points.map((p) => ({
    label: dayLabel(p.date),
    total: p.total,
    positive: p.positive,
    neutral: p.neutral,
    negative: p.negative,
  }));

  return (
    <section className={`${CARD} flex min-w-0 flex-col p-5 sm:p-6`}>
      <CardHeader title="Sentiment Trend" action={dayHref ? <span className="text-[11px]" style={{ color: MUTED }}>Click a day to open it</span> : undefined} />
      <div className="-mt-2 mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]" style={{ color: MUTED }}>
        <LegendDot color={PALETTE.green} label="Positive" />
        <LegendDot color={PALETTE.yellow} label="Neutral" />
        <LegendDot color={PALETTE.red} label="Negative" />
        <LegendDot color={PALETTE.blue} label="Total" />
      </div>
      <div className="min-h-[260px] w-full min-w-0 flex-1">
        {loading && data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm" style={{ color: MUTED }}>
            Loading…
          </div>
        ) : data.length === 0 || data.every((d) => d.total === 0) ? (
          <div className="flex h-full items-center justify-center text-sm" style={{ color: MUTED }}>
            No conversations in this range yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 520, height: 240 }}>
            <ComposedChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }} onClick={openDay} style={{ cursor: dayHref ? "pointer" : undefined }}>
              <defs>
                <linearGradient id="home-bar-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3FA0FF" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#9FD3FF" stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: MUTED }} minTickGap={12} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: MUTED }} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "rgba(19,126,253,0.07)" }}
                contentStyle={{ borderRadius: 10, border: "none", background: "#0B1B3F", color: "#fff", fontSize: 12 }}
                itemStyle={{ color: "#fff" }}
                labelStyle={{ color: "#9FD3FF" }}
              />
              <Bar dataKey="total" name="Total" fill="url(#home-bar-fill)" radius={[6, 6, 0, 0]} barSize={26} />
              <Line type="monotone" dataKey="positive" name="Positive" stroke={PALETTE.green} strokeWidth={2.5} dot={{ r: 3.5, strokeWidth: 2, stroke: "#fff", fill: PALETTE.green }} isAnimationActive={false} />
              <Line type="monotone" dataKey="neutral" name="Neutral" stroke={PALETTE.yellow} strokeWidth={2.5} dot={{ r: 3.5, strokeWidth: 2, stroke: "#fff", fill: PALETTE.yellow }} isAnimationActive={false} />
              <Line type="monotone" dataKey="negative" name="Negative" stroke={PALETTE.red} strokeWidth={2.5} dot={{ r: 3.5, strokeWidth: 2, stroke: "#fff", fill: PALETTE.red }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

/* ================= DONUT HELPERS ================= */

function Donut({
  slices,
  innerRadius,
  centerTop,
  centerBottom,
  size = 190,
}: {
  /** `href` makes a slice open its conversations; `pct` is shown on hover. */
  slices: { name: string; value: number; color: string; href?: string; pct?: number }[];
  innerRadius: string;
  centerTop: string;
  centerBottom: string;
  size?: number;
}) {
  const navigate = useNavigate();
  // An all-zero pie renders nothing; show an empty grey ring instead.
  const hasData = slices.some((s) => s.value > 0);
  const data = hasData ? slices : [{ name: "None", value: 1, color: GRID, href: undefined, pct: undefined }];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: size, height: size }}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={innerRadius} outerRadius="100%" stroke="var(--home-card, #fff)" strokeWidth={2} isAnimationActive={false}>
            {data.map((s) => (
              <Cell
                key={s.name}
                fill={s.color}
                style={{ cursor: hasData && s.href ? "pointer" : undefined, outline: "none" }}
                onClick={hasData && s.href ? () => navigate(s.href!) : undefined}
              />
            ))}
          </Pie>
          {hasData && (
            <Tooltip
              wrapperStyle={{ zIndex: 40 }}
              content={({ active, payload }) => {
                const slice = active ? (payload?.[0]?.payload as (typeof slices)[number] | undefined) : undefined;
                if (!slice) return null;
                return (
                  <div className="rounded-xl bg-[#0B1B3F] px-3 py-2 text-[12px] text-white shadow-lg">
                    <p className="font-semibold">{slice.name}</p>
                    <p className="tabular-nums">
                      {plural(slice.value, "conversation")}
                      {slice.pct !== undefined && <span className="text-[#9FD3FF]"> · {slice.pct}%</span>}
                    </p>
                    {slice.href && <p className="mt-1 text-[11px] font-semibold text-[#9FD3FF]">Click to see them →</p>}
                  </div>
                );
              }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] font-semibold tabular-nums" style={{ color: NAVY }}>
          {centerTop}
        </span>
        <span className="text-[11px] leading-tight" style={{ color: MUTED }}>
          {centerBottom}
        </span>
      </div>
    </div>
  );
}

// A donut and its legend sit side by side only when the card is wide enough for
// both (very wide screens); otherwise the legend goes under the donut, where
// it never squeezes against the card edge or overlaps the ring.
const DONUT_LAYOUT =
  "flex flex-1 flex-col items-center justify-center gap-4 min-[1800px]:flex-row min-[1800px]:justify-around min-[1800px]:gap-6";
const DONUT_LEGEND =
  "flex w-full flex-wrap justify-center gap-1 min-[1800px]:w-auto min-[1800px]:max-w-[190px] min-[1800px]:flex-col min-[1800px]:flex-nowrap";

/* ================= SENTIMENT DISTRIBUTION ================= */

export function SentimentDistributionCard({ insights, loading }: { insights: InsightsResponse | null; loading: boolean }) {
  const drill = useDrill();
  const s = insights?.sentiment;
  const rows = [
    { key: "positive", name: "Positive", count: s?.positive.count ?? 0, pct: s?.positive.pct ?? 0, color: PALETTE.green },
    { key: "neutral", name: "Neutral", count: s?.neutral.count ?? 0, pct: s?.neutral.pct ?? 0, color: PALETTE.yellow },
    { key: "negative", name: "Negative", count: s?.negative.count ?? 0, pct: s?.negative.pct ?? 0, color: PALETTE.red },
  ] as const;
  const scored = s?.scored ?? 0;
  const busy = loading && !insights;
  return (
    <section className={`${CARD} flex min-w-0 flex-col p-5 sm:p-6`}>
      <CardHeader title="Sentiment Distribution" />
      <div className={DONUT_LAYOUT}>
        <Donut
          slices={rows.map((r) => ({ name: r.name, value: r.count, color: r.color, pct: r.pct, href: drill({ sentiment: r.key }) }))}
          innerRadius="66%"
          centerTop={busy ? "—" : fmt(scored)}
          centerBottom="Scored"
        />
        <ul className={DONUT_LEGEND}>
          {rows.map((r) => (
            <li key={r.name}>
              <DrillLink
                filters={{ sentiment: r.key }}
                label={`${r.name}: ${fmt(r.count)} conversations. View them`}
                tip={{
                  title: `${r.name} sentiment`,
                  rows: [["Conversations", fmt(r.count)], ["Share of scored", `${r.pct}%`], ["Scored in range", fmt(scored)]],
                }}
                className="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-[#F4F9FF] dark:hover:bg-white/5"
              >
                <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: r.color }} />
                <span className="min-w-0">
                  <span className="block text-[12px] font-medium" style={{ color: MUTED }}>
                    {r.name}
                  </span>
                  <span className="block text-[14px] font-semibold tabular-nums" style={{ color: NAVY }}>
                    {busy ? "—" : fmt(r.count)} <span style={{ color: r.color }}>{busy ? "" : `${r.pct}%`}</span>
                  </span>
                </span>
              </DrillLink>
            </li>
          ))}
        </ul>
      </div>
      {insights && insights.totals.not_assessable > 0 && (
        <p className="mt-3 text-[11px]" style={{ color: MUTED }}>
          {fmt(insights.totals.not_assessable)} conversation{insights.totals.not_assessable === 1 ? "" : "s"} had too little
          speech to score
          {insights.totals.pending > 0 && <> · {fmt(insights.totals.pending)} still being analysed</>}
        </p>
      )}
      {insights && insights.totals.not_assessable === 0 && insights.totals.pending > 0 && (
        <p className="mt-3 text-[11px]" style={{ color: MUTED }}>
          {fmt(insights.totals.pending)} still being analysed
        </p>
      )}
    </section>
  );
}

/* ================= TOP INTENTS ================= */

const TOPIC_COLOR: Record<string, string> = {
  Admissions: "#137EFD",
  "Fees & Payments": "#35C763",
  "Courses & Programmes": "#AB67FA",
  Placements: "#FEA458",
  "Hostel & Facilities": "#F27198",
  "Examinations & Results": "#33B0E6",
  Scholarships: "#1F9EFB",
  "General Information": "#14B8A6",
  Other: "#97B0CA",
};

export function TopIntentsCard({ insights, loading }: { insights: InsightsResponse | null; loading: boolean }) {
  const topics = insights?.topics ?? [];
  const maxPct = Math.max(1, ...topics.map((t) => t.pct));
  const base = topics.reduce((sum, t) => sum + t.count, 0);
  const drill = useDrill();
  return (
    <section className={`${CARD} flex min-w-0 flex-col p-5 sm:p-6`}>
      <CardHeader title="Top Intent Categories" action={<ViewAll to={drill({ analysis_state: "assessable" })} />} />
      {topics.length === 0 ? (
        <EmptyState loading={loading && !insights}>No intents identified in this range yet.</EmptyState>
      ) : (
        <>
          <ul className="space-y-1">
            {topics.map((topic) => {
              const color = TOPIC_COLOR[topic.label] ?? PALETTE.slate;
              return (
                <li key={topic.label}>
                  <DrillLink
                    filters={{ topic: topic.label }}
                    label={`${topic.label}: ${fmt(topic.count)} conversations. View them`}
                    tip={{
                      title: topic.label,
                      rows: [["Conversations", fmt(topic.count)], ["Share of intents", `${topic.pct}%`]],
                      note: topic.label === "Other" ? "Analysed, but not one of the listed admissions topics." : undefined,
                    }}
                    className="block rounded-lg px-1.5 py-1.5 text-[13px] hover:bg-[#F4F9FF] dark:hover:bg-white/5"
                  >
                    {/* Name on its own line, bar beneath: long topic names never get cut to "Cours…". */}
                    <span className="flex items-baseline gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 translate-y-[1px] rounded-full" style={{ background: color }} />
                      <span className="min-w-0 flex-1 leading-snug" style={{ color: NAVY }}>{topic.label}</span>
                      <span className="shrink-0 font-medium tabular-nums" style={{ color: NAVY }}>
                        {fmt(topic.count)}
                      </span>
                      <span className="w-11 shrink-0 text-right font-semibold tabular-nums" style={{ color }}>
                        {topic.pct}%
                      </span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#EEF3FB] dark:bg-slate-800">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${(topic.pct / maxPct) * 100}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)` }}
                      />
                    </span>
                  </DrillLink>
                </li>
              );
            })}
          </ul>
          <AnalysisNote insights={insights} base={base} />
        </>
      )}
    </section>
  );
}

/* ================= EMOTION ================= */

const EMOTION_META: Record<EmotionKey, { label: string; color: string; icon: LucideIcon }> = {
  happy: { label: "Happy", color: "#35C763", icon: Smile },
  calm: { label: "Calm", color: "#137EFD", icon: Laugh },
  confused: { label: "Confused", color: "#AB67FA", icon: Meh },
  frustrated: { label: "Frustrated", color: "#FEA458", icon: Annoyed },
  angry: { label: "Angry", color: "#ED5173", icon: Angry },
  sad: { label: "Sad", color: "#F27198", icon: Frown },
};

export function EmotionCard({ insights, loading }: { insights: InsightsResponse | null; loading: boolean }) {
  const emotions = insights?.emotions ?? [];
  const base = emotions.reduce((sum, e) => sum + e.count, 0);
  return (
    <section className={`${CARD} flex min-w-0 flex-col p-5 sm:p-6`}>
      <CardHeader title="Emotion Analysis" />
      {base === 0 ? (
        <EmptyState loading={loading && !insights}>
          No emotions detected in this range yet.
          {insights && insights.totals.pending > 0 && (
            <>
              <br />
              {fmt(insights.totals.pending)} conversations are still being analysed.
            </>
          )}
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 min-[1500px]:grid-cols-3">
            {emotions.map((e) => {
              const meta = EMOTION_META[e.key];
              if (!meta) return null;
              return (
                <DrillLink
                  key={e.key}
                  filters={{ emotion: e.key }}
                  label={`${meta.label}: ${fmt(e.count)} conversations. View them`}
                  tip={{
                    title: `${meta.label} callers`,
                    rows: [["Conversations", fmt(e.count)], ["Share of emotions", `${e.pct}%`], ["Emotions detected", fmt(base)]],
                  }}
                  className="flex flex-col items-start min-w-0 gap-2 rounded-xl p-2.5 transition hover:brightness-[0.97] dark:hover:brightness-125"
                >
                  <span aria-hidden className="absolute inset-0 rounded-xl" style={{ background: `${meta.color}12`, boxShadow: `inset 0 0 0 1px ${meta.color}33` }} />
                  <span className="relative">
                    <IconChip icon={meta.icon} from={meta.color} to={meta.color} size="h-9 w-9" />
                  </span>
                  <span className="relative whitespace-nowrap text-[11px] font-medium leading-tight" style={{ color: MUTED }}>
                    {meta.label}
                  </span>
                  <span className="relative -mt-1 flex flex-col leading-tight">
                    <span className="text-[18px] font-semibold tabular-nums" style={{ color: meta.color }}>{e.pct}%</span>
                    <span className="text-[11px] font-medium tabular-nums" style={{ color: MUTED }}>{plural(e.count, "chat")}</span>
                  </span>
                </DrillLink>
              );
            })}
          </div>
          <AnalysisNote insights={insights} base={base} />
          {insights && base < insights.sentiment.scored && (
            <p className="mt-1 text-[11px]" style={{ color: MUTED }}>
              Emotion is known for {fmt(base)} of {fmt(insights.sentiment.scored)} scored conversations; older analyses don’t record it.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/* ================= CHANNELS ================= */

const CHANNEL_COLOR: Record<string, string> = {
  website_chat: "#137EFD",
  website_voice: "#33B0E6",
  telephone: "#7732FD",
  whatsapp: "#1FB867",
  other: "#8A9BB5",
};

export function ChannelsCard({ insights, loading }: { insights: InsightsResponse | null; loading: boolean }) {
  const channels = (insights?.channels ?? []).map((c) => ({ ...c, color: CHANNEL_COLOR[c.key] ?? PALETTE.slate }));
  const total = insights?.totals.conversations ?? 0;
  const drill = useDrill();
  return (
    <section className={`${CARD} flex min-w-0 flex-col p-5 sm:p-6`}>
      <CardHeader title="Conversation Channels" />
      {channels.length === 0 ? (
        <EmptyState loading={loading && !insights}>No conversations in this range yet.</EmptyState>
      ) : (
        <div className={DONUT_LAYOUT}>
          <Donut
            slices={channels.map((c) => ({ name: c.label, value: c.count, color: c.color, pct: c.pct, href: drill({ channel: c.key }) }))}
            innerRadius="66%"
            centerTop={fmt(total)}
            centerBottom="Conversations"
            size={180}
          />
          <ul className={DONUT_LEGEND}>
            {channels.map((c) => (
              <li key={c.key}>
                <DrillLink
                  filters={{ channel: c.key }}
                  label={`${c.label}: ${fmt(c.count)} conversations. View them`}
                  tip={{ title: c.label, rows: [["Conversations", fmt(c.count)], ["Share", `${c.pct}%`]] }}
                  className="flex items-center justify-between gap-3 rounded-lg px-1.5 py-1 text-[13px] hover:bg-[#F4F9FF] dark:hover:bg-white/5"
                >
                  <span className="flex min-w-0 items-center gap-2" style={{ color: NAVY }}>
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} />
                    <span className="truncate">{c.label}</span>
                  </span>
                  <span className="font-semibold tabular-nums" style={{ color: c.color }}>
                    {c.pct}%
                  </span>
                </DrillLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ================= SUMMARY ================= */

export function SummaryCard({ summary, loading }: { summary: InsightsSummaryResponse | null; loading: boolean }) {
  return (
    <section className={`${CARD} flex min-w-0 flex-col p-5 sm:p-6`}>
      <CardHeader
        title={
          <>
            Conversation Summary{" "}
            <span className="font-normal" style={{ color: MUTED }}>
              {summary?.source === "rules" ? "(Auto Generated)" : "(AI Generated)"}
            </span>
          </>
        }
      />
      <div className="flex gap-4 rounded-xl bg-gradient-to-br from-[#EAF4FF] via-[#F3EEFF] to-[#FFF1F6] p-4 ring-1 ring-sky-100/70 dark:from-slate-800 dark:via-slate-800 dark:to-slate-800 dark:ring-slate-700">
        <IconChip icon={Sparkles} from={PALETTE.blue} to={PALETTE.purple} size="h-12 w-12" iconSize="h-6 w-6" />
        <p className="text-[13px] leading-relaxed" style={{ color: NAVY }}>
          {summary ? summary.summary : loading ? "Writing a summary of this period…" : "Summary unavailable right now."}
        </p>
      </div>
      {summary?.generated_at && (
        <p className="mt-2 text-right text-[11px]" style={{ color: MUTED }}>
          Updated {format(new Date(summary.generated_at), "d MMM, p")}
        </p>
      )}
    </section>
  );
}

/* ================= RECENT CONVERSATIONS ================= */

const channelMeta = (source?: string | null): { label: string; icon: LucideIcon; from: string; to: string } => {
  switch ((source ?? "").toLowerCase()) {
    case "web":
      return { label: "Website", icon: Globe, from: PALETTE.blue, to: PALETTE.sky };
    case "web_call":
    case "web_voice":
    case "web_voice_cascade":
      return { label: "Web Voice", icon: Globe, from: PALETTE.sky, to: "#7FD3F5" };
    case "phone":
    case "phone_call":
      return { label: "Telephone", icon: Phone, from: PALETTE.purple, to: "#A779FF" };
    case "whatsapp":
      return { label: "WhatsApp", icon: MessageCircle, from: PALETTE.green, to: "#5FD98E" };
    default:
      return { label: source || "Other", icon: Hash, from: PALETTE.slate, to: "#B6C2D6" };
  }
};

const SENTIMENT_BADGE: Record<string, { label: string; cls: string }> = {
  positive: { label: "Positive", cls: "bg-[#DDF7E8] text-[#118A4B] dark:bg-emerald-500/15 dark:text-emerald-300" },
  neutral: { label: "Neutral", cls: "bg-[#FFF1CC] text-[#9A6B00] dark:bg-amber-500/15 dark:text-amber-300" },
  negative: { label: "Negative", cls: "bg-[#FDE4EA] text-[#C42D52] dark:bg-rose-500/15 dark:text-rose-300" },
  none: { label: "N/A", cls: "bg-[#EEF2F7] text-[#5B6B88] dark:bg-slate-800 dark:text-slate-300" },
  pending: { label: "Analysing", cls: "bg-[#EEF2F7] text-[#5B6B88] dark:bg-slate-800 dark:text-slate-300" },
};

const STATUS_CLS = {
  red: "bg-[#FDE4EA] text-[#C42D52] dark:bg-rose-500/15 dark:text-rose-300",
  orange: "bg-[#FFEBDC] text-[#B5500B] dark:bg-orange-500/15 dark:text-orange-300",
  blue: "bg-[#E1EFFF] text-[#0C64D6] dark:bg-blue-500/15 dark:text-blue-300",
  green: "bg-[#DDF7E8] text-[#118A4B] dark:bg-emerald-500/15 dark:text-emerald-300",
  grey: "bg-[#EEF2F7] text-[#5B6B88] dark:bg-slate-800 dark:text-slate-300",
};

/** What the team should do with this conversation, from its analysis. */
function conversationStatus(conv: ConversationsListSummary): { label: string; cls: string } {
  if (conv.analysed === false) return { label: "Analysing", cls: STATUS_CLS.grey };
  if (conv.urgent) return { label: "Escalated", cls: STATUS_CLS.red };
  switch (conv.category) {
    case "Callback Required":
      return { label: "Callback", cls: STATUS_CLS.orange };
    case "Follow Up":
    case "Interested":
      return { label: "Lead", cls: STATUS_CLS.blue };
    case "General Inquiry":
      return { label: "Answered", cls: STATUS_CLS.green };
    case "Not Interested":
      return { label: "Closed", cls: STATUS_CLS.grey };
    default:
      return { label: "No response", cls: STATUS_CLS.grey };
  }
}

// Time alone for today; older rows also say which day, so they are not read as today's.
const formatClock = (ts: number) => {
  const d = new Date(ts > 1e12 ? ts : ts * 1000);
  return isToday(d) ? format(d, "p") : format(d, "d MMM, p");
};

export function RecentConversationsCard({ items, loading, className = "" }: { items: ConversationsListSummary[]; loading: boolean; className?: string }) {
  return (
    <section className={`${CARD} flex min-w-0 flex-col p-5 sm:p-6 ${className}`}>
      <CardHeader title="Recent Conversations" action={<ViewAll to="/dashboard/conversations" />} />
      {loading && items.length === 0 ? (
        <p className="py-10 text-center text-sm" style={{ color: MUTED }}>
          Loading conversations…
        </p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm" style={{ color: MUTED }}>
          No conversations yet. They appear here once your agent takes a call or chat.
        </p>
      ) : (
        <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="text-[12px] font-medium" style={{ color: MUTED }}>
                <th className="pb-3 font-medium">Time</th>
                <th className="pb-3 font-medium">Channel</th>
                <th className="pb-3 font-medium">User</th>
                <th className="pb-3 font-medium">Intent / Query</th>
                <th className="pb-3 font-medium">Sentiment</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((conv) => {
                const channel = channelMeta(conv.source);
                const sentiment =
                  conv.analysed === false
                    ? SENTIMENT_BADGE.pending
                    : SENTIMENT_BADGE[conv.sentiment ?? "none"] ?? SENTIMENT_BADGE.none;
                const status = conversationStatus(conv);
                const isPhone = channel.label === "Telephone";
                return (
                  <tr key={conv.conversation_id} className="border-t border-[#EEF3FB] dark:border-slate-800">
                    <td className="whitespace-nowrap py-3 tabular-nums" style={{ color: MUTED }}>
                      {formatClock(conv.start_time)}
                    </td>
                    <td className="whitespace-nowrap py-3">
                      <span className="flex items-center gap-2 font-medium" style={{ color: NAVY }}>
                        <IconChip icon={channel.icon} from={channel.from} to={channel.to} size="h-7 w-7" iconSize="h-3.5 w-3.5" />
                        {channel.label}
                      </span>
                    </td>
                    <td className="max-w-[140px] truncate whitespace-nowrap py-3 pr-3" style={{ color: conv.contact_name ? NAVY : MUTED }}>
                      {conv.contact_name || (isPhone ? "Caller" : "Visitor")}
                    </td>
                    <td className="max-w-[220px] py-3 pr-3">
                      <Link
                        to={`/dashboard/conversations/${conv.conversation_id}`}
                        className="block truncate rounded font-semibold hover:text-[#137EFD] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#137EFD]"
                        style={{ color: NAVY }}
                      >
                        {conv.title || "Untitled conversation"}
                      </Link>
                      {conv.topic && (
                        <span className="block truncate text-[11px]" style={{ color: MUTED }}>
                          {conv.topic}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-3">
                      <span className={`inline-flex rounded-lg px-2.5 py-1 text-[12px] font-semibold ${sentiment.cls}`}>{sentiment.label}</span>
                    </td>
                    <td className="whitespace-nowrap py-3">
                      <span className={`inline-flex rounded-lg px-2.5 py-1 text-[12px] font-semibold ${status.cls}`}>{status.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ================= ESCALATIONS ================= */

const TOPIC_ICON: Record<string, LucideIcon> = {
  Admissions: GraduationCap,
  "Fees & Payments": Receipt,
  "Courses & Programmes": BookOpen,
  Placements: Trophy,
  "Hostel & Facilities": Building2,
  "Examinations & Results": FileText,
  Scholarships: Receipt,
  "General Information": Globe,
};

type EscalationRow = {
  key: string; label: string; count: number; icon: LucideIcon; from: string; to: string; high?: boolean;
  filters: DrilldownFilters; note: string;
};

export function EscalationsCard({ insights, loading }: { insights: InsightsResponse | null; loading: boolean }) {
  const drill = useDrill();
  const esc = insights?.escalations;
  const urgent = insights?.urgent.count ?? 0;
  const rows: EscalationRow[] = [];
  if (esc) {
    rows.push({ key: "urgent", label: "High Priority (Immediate Action)", count: urgent, icon: AlertTriangle, from: PALETTE.red, to: "#FF8FA3", high: urgent > 0,
      filters: { urgent: true }, note: "The caller needs a reply soon: a deadline, a complaint or a problem blocking them." });
    for (const t of esc.urgent_by_topic.slice(0, 4)) {
      rows.push({ key: `topic-${t.label}`, label: `Urgent · ${t.label}`, count: t.count, icon: TOPIC_ICON[t.label] ?? MoreHorizontal, from: PALETTE.orange, to: "#FFB27A",
        filters: { urgent: true, topic: t.label }, note: `Urgent conversations about ${t.label}.` });
    }
    rows.push({ key: "callback", label: "Callback Requested", count: esc.callback_requested, icon: PhoneCall, from: PALETTE.yellow, to: "#FFD35C",
      filters: { category: "Callback Required" }, note: "The person asked to be called back." });
    rows.push({ key: "leads", label: "Interested Leads to Follow Up", count: esc.leads, icon: CalendarClock, from: PALETTE.blue, to: PALETTE.sky,
      filters: { category: "Interested,Follow Up" }, note: "Interested or ready for follow-up, without asking for a callback." });
    rows.push({ key: "negative", label: "Negative Conversations", count: esc.negative, icon: ThumbsDown, from: PALETTE.purple, to: "#A779FF",
      filters: { sentiment: "negative" }, note: "Conversations where the caller’s sentiment was negative." });
  }
  return (
    <section className={`${CARD} flex min-w-0 flex-col p-5 sm:p-6`}>
      <CardHeader title="Escalations & Urgent Alerts" action={<ViewAll to={drill({ urgent: true })} />} />
      {rows.length === 0 ? (
        <EmptyState loading={loading && !insights}>Nothing to escalate yet.</EmptyState>
      ) : (
        <>
          <ul className="space-y-1.5">
            {rows.map((item) => (
              <li key={item.key}>
                <DrillLink
                  filters={item.filters}
                  label={`${item.label}: ${fmt(item.count)}. View these conversations`}
                  tip={{ title: item.label, rows: [["Conversations", fmt(item.count)]], note: item.note }}
                  className={`flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-[#F4F9FF] dark:hover:bg-white/5 ${item.high ? "bg-gradient-to-r from-[#FFE9EF] to-[#FFF5F8]" : ""}`}
                >
                  <IconChip icon={item.icon} from={item.from} to={item.to} size="h-8 w-8" iconSize="h-4 w-4" />
                  <span className={`min-w-0 flex-1 text-[13px] leading-snug ${item.high ? "font-semibold" : "font-medium"}`} style={{ color: item.high ? PALETTE.red : NAVY }}>
                    {item.label}
                  </span>
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: item.from }}>
                    {fmt(item.count)}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" style={{ color: MUTED }} />
                </DrillLink>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-right text-[12px]" style={{ color: MUTED }}>
            <span className="font-semibold" style={{ color: PALETTE.red }}>
              {fmt(urgent)}
            </span>{" "}
            urgent case{urgent === 1 ? "" : "s"} in this period
          </p>
        </>
      )}
    </section>
  );
}

/* ================= RECOMMENDED ACTIONS ================= */

const ACTION_META: Record<ActionKind, { icon: LucideIcon; color: string }> = {
  callback: { icon: PhoneCall, color: "#FEA458" },
  follow_up: { icon: ArrowRight, color: "#35C763" },
  review: { icon: FileText, color: "#ED5173" },
  update_info: { icon: Building2, color: "#7732FD" },
  other: { icon: Sparkles, color: "#137EFD" },
};

export function ActionsCard({ summary, loading }: { summary: InsightsSummaryResponse | null; loading: boolean }) {
  const actions = summary?.actions ?? [];
  return (
    <section className={`${CARD} flex min-w-0 flex-col p-5 sm:p-6`}>
      <CardHeader title="AI Recommended Actions" />
      {actions.length === 0 ? (
        <EmptyState loading={loading && !summary}>No actions needed for this period.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {actions.map((a, i) => {
            const meta = ACTION_META[a.kind] ?? ACTION_META.other;
            return (
              <li key={`${i}-${a.label}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-[#F4F9FF] dark:hover:bg-white/5">
                <IconChip icon={meta.icon} from={meta.color} to={meta.color} size="h-9 w-9" />
                <span className="min-w-0 text-[13px] font-medium leading-snug" style={{ color: NAVY }}>
                  {a.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
