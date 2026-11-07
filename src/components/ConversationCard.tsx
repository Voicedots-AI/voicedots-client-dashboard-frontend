import { CalendarClock, ChevronRight, Clock3, Globe2, MessageSquareText, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ConversationsListSummary } from "@/types/conversation.types";
import { CARD } from "@/components/comms/CommsKit";

interface ConversationCardProps { conversation: ConversationsListSummary; index: number; }

// Same sentiment palette as the Home dashboard.
const CATEGORY_TONE: Record<string, { chip: string; dot: string }> = {
  "Follow Up": { chip: "bg-[#E3EEFF] text-[#0F5FC4] dark:bg-blue-950/50 dark:text-blue-300", dot: "#137EFD" },
  Interested: { chip: "bg-[#DDF7E8] text-[#118A4B] dark:bg-emerald-950/50 dark:text-emerald-300", dot: "#1FB867" },
  "General Inquiry": { chip: "bg-[#EFE7FF] text-[#5B21D6] dark:bg-violet-950/50 dark:text-violet-300", dot: "#7732FD" },
  "Not Interested": { chip: "bg-[#FDE4EA] text-[#C42D52] dark:bg-rose-950/50 dark:text-rose-300", dot: "#ED5173" },
  "Callback Required": { chip: "bg-[#FFF1D6] text-[#A86A00] dark:bg-amber-950/50 dark:text-amber-300", dot: "#F0A500" },
  "Not Assessable": { chip: "bg-[#EEF3FB] text-[#55648A] dark:bg-slate-800 dark:text-slate-300", dot: "#8A9BB5" },
};

const SENTIMENT_TONE: Record<string, string> = {
  positive: "bg-[#DDF7E8] text-[#118A4B] dark:bg-emerald-950/50 dark:text-emerald-300",
  neutral: "bg-[#FFF1D6] text-[#A86A00] dark:bg-amber-950/50 dark:text-amber-300",
  negative: "bg-[#FDE4EA] text-[#C42D52] dark:bg-rose-950/50 dark:text-rose-300",
};

function formatDuration(seconds = 0) {
  if (!seconds) return "No duration";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

export function ConversationCard({ conversation, index }: ConversationCardProps) {
  const navigate = useNavigate();
  const isPhone = conversation.source === "phone_call" || conversation.source === "phone";
  const category = conversation.category || "Not Assessable";
  const tone = CATEGORY_TONE[category] || CATEGORY_TONE["Not Assessable"];
  const SourceIcon = isPhone ? Phone : Globe2;
  const [from, to] = isPhone ? ["#7732FD", "#A779FF"] : ["#137EFD", "#5AB8FF"];

  return (
    <button
      type="button"
      onClick={() => navigate(`./${conversation.conversation_id}`, { state: { source: conversation.source } })}
      className={`${CARD} group relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden px-4 py-4 text-left transition hover:ring-[#137EFD]/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#137EFD] sm:gap-6 sm:px-5`}
    >
      {/* Category colour runs down the left edge so the list scans by outcome. */}
      <span aria-hidden className="absolute inset-y-3 left-0 w-1 rounded-r-full" style={{ background: tone.dot }} />
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <span
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ background: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: `0 6px 14px ${from}40` }}
        >
          <SourceIcon size={18} strokeWidth={2.25} />
          <span className="absolute -bottom-1.5 -right-1.5 rounded-md bg-white px-1 text-[10px] font-semibold tabular-nums text-[#6B7A99] shadow-sm ring-1 ring-sky-100 dark:bg-slate-900 dark:ring-slate-700">
            {index}
          </span>
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-[#0B1B3F] transition group-hover:text-[#137EFD] dark:text-slate-100">
            {conversation.title || "Untitled conversation"}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] text-[#6B7A99] dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">{isPhone ? "Phone call" : "Website chat"}</span>
            {conversation.sentiment && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${SENTIMENT_TONE[conversation.sentiment]}`}>
                {conversation.sentiment}
              </span>
            )}
            {conversation.urgent && (
              <span className="rounded-full bg-[#FDE4EA] px-2 py-0.5 text-[11px] font-semibold text-[#C42D52] dark:bg-rose-950/50 dark:text-rose-300">Urgent</span>
            )}
            {conversation.topic && conversation.topic !== "Other" && (
              <span className="hidden rounded-full bg-[#EEF3FB] px-2 py-0.5 text-[11px] font-medium text-[#55648A] sm:inline dark:bg-slate-800 dark:text-slate-300">{conversation.topic}</span>
            )}
            {conversation.analysed === false && <span className="text-[11px] italic">Analysing…</span>}
            <span className="hidden items-center gap-1.5 sm:inline-flex"><Clock3 size={13} />{formatDuration(conversation.duration)}</span>
            <span className="hidden items-center gap-1.5 md:inline-flex"><MessageSquareText size={13} />{conversation.message_count || 0} messages</span>
            <span className="hidden items-center gap-1.5 lg:inline-flex">
              <CalendarClock size={13} />
              {new Date(conversation.start_time * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <span className={`max-w-[112px] rounded-full px-2.5 py-1 text-center text-[11px] font-semibold leading-4 sm:max-w-none sm:px-3 ${tone.chip}`}>{category}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full text-[#9AA8C2] transition group-hover:bg-[#EAF3FF] group-hover:text-[#137EFD] dark:group-hover:bg-slate-800">
          <ChevronRight size={18} />
        </span>
      </div>
    </button>
  );
}
