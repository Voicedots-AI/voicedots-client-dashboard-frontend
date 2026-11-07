import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
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

export const NAVY = "#0B1B3F";
const MUTED = "#6B7A99";
const GRID = "#E6EDF8";

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
  "rounded-2xl bg-white shadow-[0_8px_26px_rgba(18,50,120,0.09)] ring-1 ring-sky-100/80 dark:bg-slate-900 dark:ring-slate-800";

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

/** Solid gradient chip with a white icon. */
function IconChip({ icon: Icon, from, to, size = "h-9 w-9", iconSize = "h-4 w-4" }: { icon: LucideIcon; from: string; to: string; size?: string; iconSize?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl text-white ${size}`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: `0 6px 14px ${from}40` }}
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
      <ResponsiveContainer width="100%" height="100%">
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
}) {
  const good = trend?.good ?? trend?.up ?? true;
  const chipCls = trend?.neutral
    ? "bg-[#EEF2F7] text-[#5B6B88]"
    : good
      ? "bg-[#DDF7E8] text-[#118A4B]"
      : "bg-[#FDE4EA] text-[#C42D52]";
  return (
    <div className={`${CARD} flex min-w-0 flex-col p-4 sm:p-5`}>
      <div className="flex items-start gap-3">
        <IconChip icon={icon} from={iconFrom} to={iconTo} size="h-11 w-11" iconSize="h-5 w-5" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium" style={{ color: MUTED }}>
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
            <p className="mt-1.5 truncate text-[11px]" style={{ color: MUTED }}>
              {hint}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3">
        <Sparkline values={spark.length > 1 ? spark : [0, 0]} color={iconFrom} id={sparkId} />
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

export function SentimentTrendCard({ points, loading }: { points: InsightsTimeseriesPoint[]; loading: boolean }) {
  const data = points.map((p) => ({
    label: dayLabel(p.date),
    total: p.total,
    positive: p.positive,
    neutral: p.neutral,
    negative: p.negative,
  }));

  return (
    <section className={`${CARD} flex min-w-0 flex-col p-5 sm:p-6`}>
      <CardHeader title="Sentiment Trend" />
      <div className="-mt-2 mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]" style={{ color: MUTED }}>
        <LegendDot color={PALETTE.green} label="Positive" />
        <LegendDot color={PALETTE.yellow} label="Neutral" />
        <LegendDot color={PALETTE.red} label="Negative" />
        <LegendDot color={PALETTE.blue} label="Total" />
      </div>
      <div className="h-[260px] w-full min-w-0">
        {loading && data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm" style={{ color: MUTED }}>
            Loading…
          </div>
        ) : data.length === 0 || data.every((d) => d.total === 0) ? (
          <div className="flex h-full items-center justify-center text-sm" style={{ color: MUTED }}>
            No conversations in this range yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
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
                contentStyle={{ borderRadius: 10, border: "none", background: NAVY, color: "#fff", fontSize: 12 }}
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
  slices: { name: string; value: number; color: string }[];
  innerRadius: string;
  centerTop: string;
  centerBottom: string;
  size?: number;
}) {
  // An all-zero pie renders nothing; show an empty grey ring instead.
  const hasData = slices.some((s) => s.value > 0);
  const data = hasData ? slices : [{ name: "None", value: 1, color: "#E6EDF8" }];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={innerRadius} outerRadius="100%" stroke="#fff" strokeWidth={2} isAnimationActive={false}>
            {data.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] font-semibold tabular-nums" style={{ color: NAVY }}>
          {centerTop}
        </span>
        <span className="text-[12px]" style={{ color: MUTED }}>
          {centerBottom}
        </span>
      </div>
    </div>
  );
}

/* ================= SENTIMENT DISTRIBUTION ================= */

export function SentimentDistributionCard({ insights, loading }: { insights: InsightsResponse | null; loading: boolean }) {
  const s = insights?.sentiment;
  const rows = [
    { name: "Positive", count: s?.positive.count ?? 0, pct: s?.positive.pct ?? 0, color: PALETTE.green },
    { name: "Neutral", count: s?.neutral.count ?? 0, pct: s?.neutral.pct ?? 0, color: PALETTE.yellow },
    { name: "Negative", count: s?.negative.count ?? 0, pct: s?.negative.pct ?? 0, color: PALETTE.red },
  ];
  const scored = s?.scored ?? 0;
  const busy = loading && !insights;
  return (
    <section className={`${CARD} flex min-w-0 flex-col p-5 sm:p-6`}>
      <CardHeader title="Sentiment Distribution" />
      <div className="flex flex-1 flex-col items-center gap-6 sm:flex-row sm:justify-around">
        <Donut
          slices={rows.map((r) => ({ name: r.name, value: r.count, color: r.color }))}
          innerRadius="66%"
          centerTop={busy ? "—" : fmt(scored)}
          centerBottom="Scored"
        />
        <ul className="w-full max-w-[170px] space-y-4">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center gap-3">
              <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: r.color }} />
              <div className="min-w-0">
                <p className="text-[12px] font-medium" style={{ color: MUTED }}>
                  {r.name}
                </p>
                <p className="text-[14px] font-semibold tabular-nums" style={{ color: NAVY }}>
                  {busy ? "—" : fmt(r.count)} <span style={{ color: r.color }}>{busy ? "" : `${r.pct}%`}</span>
                </p>
              </div>
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
  return (
    <section className={`${CARD} flex min-w-0 flex-col p-5 sm:p-6`}>
      <CardHeader title="Top Intent Categories" action={<ViewAll to="/dashboard/conversations" />} />
      {topics.length === 0 ? (
        <EmptyState loading={loading && !insights}>No intents identified in this range yet.</EmptyState>
      ) : (
        <>
          <ul className="space-y-3.5">
            {topics.map((topic) => {
              const color = TOPIC_COLOR[topic.label] ?? PALETTE.slate;
              return (
                <li key={topic.label} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto] items-center gap-3 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2" style={{ color: NAVY }}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                    <span className="truncate">{topic.label}</span>
                  </span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#EEF3FB]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(topic.pct / maxPct) * 100}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)` }}
                    />
                  </div>
                  <span className="text-right font-medium tabular-nums" style={{ color: NAVY }}>
                    {fmt(topic.count)}
                  </span>
                  <span className="w-11 text-right font-semibold tabular-nums" style={{ color }}>
                    {topic.pct}%
                  </span>
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
          <div className="grid grid-cols-3 gap-3">
            {emotions.map((e) => {
              const meta = EMOTION_META[e.key];
              if (!meta) return null;
              return (
                <div
                  key={e.key}
                  className="flex flex-col items-start gap-2 rounded-xl p-3 ring-1"
                  style={{ background: `${meta.color}12`, boxShadow: `inset 0 0 0 1px ${meta.color}33` }}
                  title={`${fmt(e.count)} conversation${e.count === 1 ? "" : "s"}`}
                >
                  <IconChip icon={meta.icon} from={meta.color} to={meta.color} size="h-9 w-9" />
                  <span className="text-[12px] font-medium" style={{ color: MUTED }}>
                    {meta.label}
                  </span>
                  <span className="text-[18px] font-semibold tabular-nums" style={{ color: meta.color }}>
                    {e.pct}%
                  </span>
                </div>
              );
            })}
          </div>
          <AnalysisNote insights={insights} base={base} />
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
  return (
    <section className={`${CARD} flex min-w-0 flex-col p-5 sm:p-6`}>
      <CardHeader title="Conversation Channels" />
      {channels.length === 0 ? (
        <EmptyState loading={loading && !insights}>No conversations in this range yet.</EmptyState>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-5 sm:flex-row sm:justify-around">
          <Donut
            slices={channels.map((c) => ({ name: c.label, value: c.count, color: c.color }))}
            innerRadius="48%"
            centerTop={fmt(total)}
            centerBottom="Conversations"
            size={180}
          />
          <ul className="w-full max-w-[190px] space-y-2.5">
            {channels.map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-3 text-[13px]" title={`${fmt(c.count)} conversations`}>
                <span className="flex min-w-0 items-center gap-2" style={{ color: NAVY }}>
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="truncate">{c.label}</span>
                </span>
                <span className="font-semibold tabular-nums" style={{ color: c.color }}>
                  {c.pct}%
                </span>
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
      <div className="flex gap-4 rounded-xl bg-gradient-to-br from-[#EAF4FF] via-[#F3EEFF] to-[#FFF1F6] p-4 ring-1 ring-sky-100/70 dark:from-slate-800 dark:to-slate-800">
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
  positive: { label: "Positive", cls: "bg-[#DDF7E8] text-[#118A4B]" },
  neutral: { label: "Neutral", cls: "bg-[#FFF1CC] text-[#9A6B00]" },
  negative: { label: "Negative", cls: "bg-[#FDE4EA] text-[#C42D52]" },
  none: { label: "N/A", cls: "bg-[#EEF2F7] text-[#5B6B88]" },
  pending: { label: "Analysing", cls: "bg-[#EEF2F7] text-[#5B6B88]" },
};

const STATUS_CLS = {
  red: "bg-[#FDE4EA] text-[#C42D52]",
  orange: "bg-[#FFEBDC] text-[#B5500B]",
  blue: "bg-[#E1EFFF] text-[#0C64D6]",
  green: "bg-[#DDF7E8] text-[#118A4B]",
  grey: "bg-[#EEF2F7] text-[#5B6B88]",
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

const formatClock = (ts: number) => format(new Date(ts > 1e12 ? ts : ts * 1000), "p");

export function RecentConversationsCard({ items, loading }: { items: ConversationsListSummary[]; loading: boolean }) {
  return (
    <section className={`${CARD} flex min-w-0 flex-col p-5 sm:p-6`}>
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

type EscalationRow = { key: string; label: string; count: number; icon: LucideIcon; from: string; to: string; high?: boolean };

export function EscalationsCard({ insights, loading }: { insights: InsightsResponse | null; loading: boolean }) {
  const esc = insights?.escalations;
  const urgent = insights?.urgent.count ?? 0;
  const rows: EscalationRow[] = [];
  if (esc) {
    rows.push({ key: "urgent", label: "High Priority (Immediate Action)", count: urgent, icon: AlertTriangle, from: PALETTE.red, to: "#FF8FA3", high: urgent > 0 });
    for (const t of esc.urgent_by_topic.slice(0, 4)) {
      rows.push({ key: `topic-${t.label}`, label: `Urgent · ${t.label}`, count: t.count, icon: TOPIC_ICON[t.label] ?? MoreHorizontal, from: PALETTE.orange, to: "#FFB27A" });
    }
    rows.push({ key: "callback", label: "Callback Requested", count: esc.callback_requested, icon: PhoneCall, from: PALETTE.yellow, to: "#FFD35C" });
    rows.push({ key: "leads", label: "Interested Leads to Follow Up", count: esc.leads, icon: CalendarClock, from: PALETTE.blue, to: PALETTE.sky });
    rows.push({ key: "negative", label: "Negative Conversations", count: esc.negative, icon: ThumbsDown, from: PALETTE.purple, to: "#A779FF" });
  }
  return (
    <section className={`${CARD} flex min-w-0 flex-col p-5 sm:p-6`}>
      <CardHeader title="Escalations & Urgent Alerts" action={<ViewAll to="/dashboard/conversations" />} />
      {rows.length === 0 ? (
        <EmptyState loading={loading && !insights}>Nothing to escalate yet.</EmptyState>
      ) : (
        <>
          <ul className="space-y-1.5">
            {rows.map((item) => (
              <li
                key={item.key}
                className={`flex items-center gap-3 rounded-xl px-2.5 py-2 ${item.high ? "bg-gradient-to-r from-[#FFE9EF] to-[#FFF5F8]" : ""}`}
              >
                <IconChip icon={item.icon} from={item.from} to={item.to} size="h-8 w-8" iconSize="h-4 w-4" />
                <span className={`min-w-0 flex-1 truncate text-[13px] ${item.high ? "font-semibold" : "font-medium"}`} style={{ color: item.high ? PALETTE.red : NAVY }}>
                  {item.label}
                </span>
                <span className="text-[13px] font-semibold tabular-nums" style={{ color: item.from }}>
                  {fmt(item.count)}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0" style={{ color: MUTED }} />
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
              <li key={`${i}-${a.label}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-[#F4F9FF]">
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
