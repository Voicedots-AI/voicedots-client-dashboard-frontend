import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

/* Design tokens shared by the Communications pages (AI Calling, WhatsApp).
 * They mirror the Home dashboard so the channels read as one product. */

export const NAVY = "#0B1B3F";
export const MUTED = "#6B7A99";
export const BRAND = "#137EFD";

export const FONT = { fontFamily: "Poppins, Manrope, sans-serif" } as const;

export const CARD =
  "rounded-2xl bg-white shadow-[0_8px_26px_rgba(18,50,120,0.09)] ring-1 ring-sky-100/80 dark:bg-[#0F1A33] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.04)] dark:ring-white/[0.07]";

export const INPUT =
  "mt-1 w-full rounded-xl border-0 bg-[#F4F9FF] px-3.5 py-2.5 text-sm text-[#0B1B3F] ring-1 ring-sky-100 outline-none transition placeholder:text-[#9AA8C2] focus:bg-white focus:ring-2 focus:ring-[#137EFD] dark:bg-[#0A1328] dark:text-slate-100 dark:ring-white/10 dark:placeholder:text-slate-500 dark:focus:bg-[#0A1328]";

/** Small field label above an INPUT. */
export const LABEL = "block text-[12px] font-medium text-[#55648A] dark:text-slate-400";

export const BTN =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#137EFD] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(19,126,253,0.28)] transition hover:bg-[#0F6AD8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#137EFD] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";

export const BTN_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-[#0B1B3F] ring-1 ring-sky-100 transition hover:bg-[#F4F9FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#137EFD] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/[0.04] dark:text-slate-100 dark:ring-white/10 dark:hover:bg-white/[0.08]";

/** Quiet destructive text button. */
export const BTN_DANGER =
  "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#C42D52] transition hover:bg-[#FDE4EA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C42D52] disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-500/10";

export type Tone = "voice" | "chat" | "inbox" | "leads" | "support" | "library" | "mail" | "control";

const TONES: Record<Tone, { from: string; to: string; glow: string }> = {
  voice: { from: "#137EFD", to: "#7732FD", glow: "rgba(119,50,253,0.35)" },
  chat: { from: "#1FB867", to: "#14B8A6", glow: "rgba(31,184,103,0.32)" },
  inbox: { from: "#137EFD", to: "#33B0E6", glow: "rgba(51,176,230,0.32)" },
  leads: { from: "#7732FD", to: "#F27198", glow: "rgba(242,113,152,0.30)" },
  support: { from: "#FF8A3D", to: "#F0A500", glow: "rgba(255,138,61,0.30)" },
  library: { from: "#14B8A6", to: "#137EFD", glow: "rgba(20,184,166,0.30)" },
  mail: { from: "#ED5173", to: "#FF8A3D", glow: "rgba(237,81,115,0.30)" },
  control: { from: "#5B6B8C", to: "#137EFD", glow: "rgba(91,107,140,0.38)" },
};

export const toneGradient = (tone: Tone) => `linear-gradient(135deg, ${TONES[tone].from}, ${TONES[tone].to})`;

/* ================= LAYOUT ================= */

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

/** Page surface with the same staggered entrance as Home. */
export function CommsShell({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const motionProps = reduce ? { initial: false as const } : { variants: container, initial: "hidden" as const, animate: "show" as const };
  return (
    <motion.div
      {...motionProps}
      className="min-h-[calc(100dvh-140px)] space-y-5 rounded-3xl bg-[#F4F9FF] p-3 text-[#0B1B3F] dark:bg-[#081022] dark:text-slate-100 sm:p-5"
      style={FONT}
    >
      {children}
    </motion.div>
  );
}

export function CommsItem({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

/* ================= CHANNEL HERO ================= */

/** Voice waveform — the AI Calling motif. Drifts gently unless reduced motion is on. */
function VoiceWave() {
  const reduce = useReducedMotion();
  const bars = [28, 46, 64, 38, 82, 56, 96, 70, 44, 88, 60, 34, 74, 52, 90, 40, 66, 30, 58, 80, 46, 26];
  return (
    <div aria-hidden className="flex h-24 items-center gap-[5px]">
      {bars.map((h, i) => (
        <motion.span
          key={i}
          className="w-[5px] rounded-full"
          style={{ height: `${h}%`, background: `linear-gradient(180deg, #5AB8FF, #A779FF)`, opacity: 0.35 + (h / 100) * 0.6 }}
          animate={reduce ? undefined : { scaleY: [1, 0.55 + ((i * 37) % 40) / 100, 1] }}
          transition={reduce ? undefined : { duration: 1.6 + (i % 5) * 0.22, repeat: Infinity, ease: "easeInOut", delay: (i % 7) * 0.12 }}
        />
      ))}
    </div>
  );
}

/** Alternating agent / caller lines — the Conversations motif. */
function TranscriptMotif() {
  const lines: [("agent" | "caller"), number][] = [["agent", 82], ["caller", 56], ["agent", 94], ["agent", 48], ["caller", 70]];
  return (
    <div aria-hidden className="flex w-64 flex-col gap-2.5">
      {lines.map(([who, w], i) => (
        <div key={i} className={`flex items-center gap-2 ${who === "caller" ? "flex-row-reverse" : ""}`}>
          <span className={`h-5 w-5 shrink-0 rounded-full ${who === "agent" ? "bg-gradient-to-br from-[#137EFD] to-[#33B0E6]" : "bg-white/25"}`} />
          <span className={`h-2.5 rounded-full ${who === "agent" ? "bg-white/45" : "bg-[#5AB8FF]/60"}`} style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}

/** Stacked chat bubbles — the WhatsApp motif. */
function ChatMotif() {
  return (
    <div aria-hidden className="flex w-64 flex-col gap-2">
      <div className="max-w-[210px] self-start rounded-2xl rounded-bl-md bg-white/10 px-3.5 py-2 text-[12px] text-white/85 ring-1 ring-white/15">
        Is the hostel open for first-years?
      </div>
      <div className="max-w-[210px] self-end rounded-2xl rounded-br-md bg-gradient-to-br from-[#1FB867] to-[#14B8A6] px-3.5 py-2 text-[12px] text-white shadow-[0_8px_20px_rgba(31,184,103,0.35)]">
        Yes, sharing the fee sheet now.
        <span className="ml-1.5 text-[10px] text-white/75">✓✓</span>
      </div>
      <div className="flex w-fit items-center gap-1 self-start rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/10">
        {[0, 1, 2].map((d) => (
          <span key={d} className="h-1.5 w-1.5 rounded-full bg-white/60" />
        ))}
      </div>
    </div>
  );
}

/** Captured contacts narrowing to a qualified lead — the Leads motif. */
function FunnelMotif() {
  const rows = [
    { w: 100, n: 4 },
    { w: 74, n: 3 },
    { w: 48, n: 2 },
  ];
  return (
    <div aria-hidden className="flex w-64 flex-col items-center gap-2">
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex h-8 items-center justify-center gap-1.5 rounded-full bg-white/[0.07] ring-1 ring-white/10"
          style={{ width: `${r.w}%` }}
        >
          {Array.from({ length: r.n }, (_, j) => (
            <span
              key={j}
              className="h-5 w-5 rounded-full ring-2 ring-[#13295C]"
              style={{ background: i === 2 ? "linear-gradient(135deg,#7732FD,#F27198)" : `rgba(255,255,255,${0.18 + j * 0.06})` }}
            />
          ))}
        </div>
      ))}
      <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#7732FD] to-[#F27198] px-3 py-1 text-[11px] font-semibold text-white shadow-[0_8px_20px_rgba(242,113,152,0.35)]">
        ✓ Qualified
      </span>
    </div>
  );
}

/** Perforated ticket stubs, fanned — the Tickets motif. */
function TicketMotif() {
  const stubs = [
    { r: -8, x: -26, o: 0.45 },
    { r: -2, x: 0, o: 0.7 },
    { r: 5, x: 26, o: 1 },
  ];
  return (
    <div aria-hidden className="relative h-28 w-64">
      {stubs.map((t, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 flex h-16 w-44 overflow-hidden rounded-xl"
          style={{ transform: `translate(calc(-50% + ${t.x}px), -50%) rotate(${t.r}deg)`, opacity: t.o }}
        >
          <div className={`flex flex-1 flex-col justify-center gap-1.5 px-3 ${i === 2 ? "bg-gradient-to-br from-[#FF8A3D] to-[#F0A500]" : "bg-white/15"}`}>
            <span className="h-2 w-20 rounded-full bg-white/70" />
            <span className="h-2 w-12 rounded-full bg-white/40" />
          </div>
          <div className={`w-11 border-l-2 border-dashed border-[#13295C]/70 ${i === 2 ? "bg-[#F0A500]" : "bg-white/10"}`} />
        </div>
      ))}
    </div>
  );
}

/** A page of text with one line being learned — the Knowledge Base motif. */
function PageMotif() {
  const reduce = useReducedMotion();
  const lines = [92, 78, 86, 60, 0, 88, 70, 82];
  return (
    <div aria-hidden className="relative w-56 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
      <div className="mb-3 h-2.5 w-24 rounded-full bg-white/60" />
      <div className="flex flex-col gap-2">
        {lines.map((w, i) =>
          w === 0 ? (
            <motion.div
              key={i}
              className="h-2.5 rounded-full bg-gradient-to-r from-[#14B8A6] to-[#137EFD] shadow-[0_0_14px_rgba(20,184,166,0.55)]"
              style={{ width: "84%" }}
              animate={reduce ? undefined : { width: ["18%", "84%", "84%"] }}
              transition={reduce ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : (
            <span key={i} className="h-2 rounded-full bg-white/20" style={{ width: `${w}%` }} />
          )
        )}
      </div>
    </div>
  );
}

/** An envelope with its thread stacked behind it — the Gmail motif. */
function EnvelopeMotif() {
  return (
    <div aria-hidden className="relative h-28 w-64">
      {[2, 1].map((d) => (
        <div
          key={d}
          className="absolute left-1/2 top-1/2 h-20 w-40 rounded-xl bg-white/[0.07] ring-1 ring-white/10"
          style={{ transform: `translate(calc(-50% + ${d * 14}px), calc(-50% - ${d * 10}px))` }}
        />
      ))}
      <div className="absolute left-1/2 top-1/2 h-20 w-40 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-gradient-to-br from-[#ED5173] to-[#FF8A3D] shadow-[0_12px_26px_rgba(237,81,115,0.35)]">
        <svg viewBox="0 0 160 80" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          <path d="M0 0 L80 46 L160 0" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="3" strokeLinejoin="round" />
          <path d="M0 80 L62 36 M160 80 L98 36" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}

/** Toggles and a slider — the Settings motif. */
function ControlsMotif() {
  const rows: [number, boolean][] = [[70, true], [52, false], [84, true]];
  return (
    <div aria-hidden className="flex w-60 flex-col gap-3 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
      {rows.map(([w, on], i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span className="h-2 rounded-full bg-white/25" style={{ width: `${w}%` }} />
          <span className={`relative h-5 w-9 shrink-0 rounded-full ${on ? "bg-gradient-to-r from-[#5B6B8C] to-[#137EFD]" : "bg-white/15"}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow ${on ? "right-0.5" : "left-0.5"}`} />
          </span>
        </div>
      ))}
      <div className="relative mt-1 h-1.5 rounded-full bg-white/15">
        <span className="absolute inset-y-0 left-0 w-3/5 rounded-full bg-gradient-to-r from-[#5B6B8C] to-[#137EFD]" />
        <span className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow" style={{ left: "calc(60% - 8px)" }} />
      </div>
    </div>
  );
}

const MOTIFS: Record<Tone, () => ReactNode> = {
  voice: () => <VoiceWave />,
  chat: () => <ChatMotif />,
  inbox: () => <TranscriptMotif />,
  leads: () => <FunnelMotif />,
  support: () => <TicketMotif />,
  library: () => <PageMotif />,
  mail: () => <EnvelopeMotif />,
  control: () => <ControlsMotif />,
};

export function ChannelHero({
  tone,
  icon: Icon,
  title,
  description,
  status,
  controls,
  actions,
}: {
  tone: Tone;
  icon: LucideIcon;
  title: string;
  description: string;
  status?: ReactNode;
  controls?: ReactNode;
  actions?: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <section
      className="relative overflow-hidden rounded-[28px] px-5 py-6 text-white shadow-[0_18px_40px_rgba(11,27,63,0.22)] ring-1 ring-white/5 dark:shadow-[0_18px_44px_rgba(0,0,0,0.45)] dark:ring-white/10 sm:px-7 sm:py-7"
      style={{ background: `radial-gradient(120% 140% at 100% 0%, ${t.glow}, transparent 55%), linear-gradient(135deg, #0B1B3F 0%, #13295C 100%)` }}
    >
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-xl">
          <div className="flex items-center gap-3">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})`, boxShadow: `0 10px 22px ${t.glow}` }}
            >
              <Icon className="h-6 w-6" strokeWidth={2.1} />
            </span>
            <div className="min-w-0">
              <h1 className="text-[26px] font-semibold leading-tight sm:text-[30px]">{title}</h1>
              {status && <div className="mt-1">{status}</div>}
            </div>
          </div>
          <p className="mt-3 max-w-[56ch] text-[14px] leading-relaxed text-white/70">{description}</p>
          {(controls || actions) && (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              {controls}
              {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            </div>
          )}
        </div>
        <div className="hidden shrink-0 lg:block">{MOTIFS[tone]()}</div>
      </div>
    </section>
  );
}

/** Status line inside the hero: a dot plus a short sentence. */
export function HeroStatus({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-white/80">
      <span className={`relative flex h-2 w-2`}>
        {ok && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70 motion-reduce:hidden" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`} />
      </span>
      {children}
    </span>
  );
}

/** Select styled for the navy hero. */
export function HeroSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="block min-w-0 text-[12px] font-medium text-white/60">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block h-10 w-full min-w-56 cursor-pointer rounded-xl border-0 bg-white/10 px-3 text-[13px] font-medium text-white ring-1 ring-white/15 outline-none transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70 [&>option]:text-[#0B1B3F]"
      >
        {children}
      </select>
    </label>
  );
}

export function HeroButton({ primary, tone = "voice", children, ...rest }: { primary?: boolean; tone?: Tone; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 ${
        primary ? "text-white hover:brightness-110" : "bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15"
      }`}
      style={primary ? { background: `linear-gradient(135deg, ${t.from}, ${t.to})`, boxShadow: `0 8px 20px ${t.glow}` } : undefined}
    >
      {children}
    </button>
  );
}

/* ================= TABS ================= */

export function SegmentTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly (readonly [T, string, LucideIcon?])[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm ring-1 ring-sky-100 dark:bg-[#0F1A33] dark:ring-white/[0.07]">
      {tabs.map(([key, text, Icon]) => {
        const active = value === key;
        return (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#137EFD] ${
              active ? "bg-[#137EFD] text-white shadow-sm" : "text-[#6B7A99] hover:bg-[#F4F9FF] hover:text-[#0B1B3F] dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
            }`}
          >
            {Icon && <Icon size={15} />}
            {text}
          </button>
        );
      })}
    </div>
  );
}

/* ================= TILES ================= */

export function IconChip({ icon: Icon, from, to, size = "h-11 w-11", iconSize = "h-5 w-5" }: { icon: LucideIcon; from: string; to: string; size?: string; iconSize?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl text-white ${size}`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: `0 6px 14px ${from}40` }}
    >
      <Icon className={iconSize} strokeWidth={2.25} />
    </span>
  );
}

/** KPI tile matching Home's KpiCard. */
export function StatTile({
  label,
  value,
  foot,
  footTone = "neutral",
  icon,
  from,
  to,
  sample,
  onClick,
}: {
  label: string;
  value: ReactNode;
  foot?: ReactNode;
  footTone?: "up" | "down" | "neutral";
  icon: LucideIcon;
  from: string;
  to: string;
  sample?: boolean;
  onClick?: () => void;
}) {
  const footCls =
    footTone === "up" ? "bg-[#DDF7E8] text-[#118A4B] dark:bg-emerald-500/10 dark:text-emerald-300" : footTone === "down" ? "bg-[#FDE4EA] text-[#C42D52] dark:bg-rose-500/10 dark:text-rose-300" : "bg-[#EEF3FB] text-[#55648A] dark:bg-white/[0.06] dark:text-slate-300";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={`${CARD} flex min-w-0 items-start gap-3 p-4 text-left sm:p-5 ${onClick ? "transition hover:ring-[#137EFD]/40 focus-visible:outline-2 focus-visible:outline-[#137EFD]" : ""}`}
    >
      <IconChip icon={icon} from={from} to={to} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[12px] font-medium text-[#6B7A99] dark:text-slate-400">{label}</p>
          {sample && (
            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Sample</span>
          )}
        </div>
        <p className="mt-0.5 text-[26px] font-semibold leading-none tabular-nums text-[#0B1B3F] dark:text-white">{value}</p>
        {foot && <span className={`mt-2 inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-semibold ${footCls}`}>{foot}</span>}
      </div>
    </Tag>
  );
}

/** Card heading row used across both channels. */
export function SectionHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold text-[#0B1B3F] dark:text-white">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-[#6B7A99] dark:text-slate-400">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/* ================= FEEDBACK ================= */

/** Inline success / error / info line. */
export function Notice({ tone, children, onDismiss }: { tone: "success" | "error" | "info"; children: ReactNode; onDismiss?: () => void }) {
  const cls =
    tone === "success"
      ? "bg-[#DDF7E8] text-[#0E6E3C] ring-[#B5EBCB] dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20"
      : tone === "error"
        ? "bg-[#FDE4EA] text-[#A62146] ring-[#F7C3D0] dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20"
        : "bg-[#E3EEFF] text-[#0F5FC4] ring-[#C8DCFF] dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-[13px] font-medium ring-1 ${cls}`}>
      <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="-my-0.5 shrink-0 rounded-md px-1.5 text-[12px] font-semibold opacity-70 hover:opacity-100">
          Dismiss
        </button>
      )}
    </div>
  );
}

/** Empty or not-yet-available state that points to the next step. */
export function EmptyState({ icon: Icon, title, text, tone = "inbox", children }: { icon: LucideIcon; title: string; text: string; tone?: Tone; children?: ReactNode }) {
  return (
    <div className={`${CARD} flex flex-col items-center px-6 py-14 text-center`}>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-white" style={{ background: toneGradient(tone), boxShadow: `0 10px 24px ${TONES[tone].glow}` }}>
        <Icon className="h-6 w-6" strokeWidth={2.1} />
      </span>
      <h2 className="mt-4 text-[16px] font-semibold text-[#0B1B3F] dark:text-white">{title}</h2>
      <p className="mt-1 max-w-[46ch] text-[13px] leading-relaxed text-[#6B7A99] dark:text-slate-400">{text}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

/** Previous / numbered / next pager. */
export function Pager({ page, pages, onPage, total, noun }: { page: number; pages: number; onPage: (p: number) => void; total?: number; noun?: string }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <nav aria-label="Pagination" className={`${CARD} flex flex-col items-center justify-between gap-3 px-4 py-3 sm:flex-row`}>
      <p className="text-[12px] text-[#6B7A99] dark:text-slate-400">
        Page <span className="font-semibold text-[#0B1B3F] dark:text-white">{page}</span> of {pages}
        {total !== undefined && <> · {total.toLocaleString()} {noun}</>}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className={BTN_SECONDARY} disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        {nums.map((n, i) => (
          <span key={n} className="flex items-center">
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-[#9AA8C2]">…</span>}
            <button
              type="button"
              aria-current={n === page ? "page" : undefined}
              onClick={() => onPage(n)}
              className={`h-9 min-w-9 rounded-lg px-2 text-[13px] font-semibold tabular-nums transition ${
                n === page ? "bg-[#137EFD] text-white shadow-sm" : "text-[#6B7A99] hover:bg-[#F4F9FF] hover:text-[#0B1B3F] dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
              }`}
            >
              {n}
            </button>
          </span>
        ))}
        <button type="button" className={BTN_SECONDARY} disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </nav>
  );
}

/** Pill toggle used for on/off settings. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#137EFD] ${checked ? "bg-[#137EFD]" : "bg-[#D5DEEC] dark:bg-white/15"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}
