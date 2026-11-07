import { AlertTriangle, Clock3, Inbox, Ticket as TicketIcon, UserCheck } from "lucide-react";
import { CARD, ChannelHero, CommsItem, CommsShell, EmptyState, HeroStatus, IconChip, SectionHeader } from "@/components/comms/CommsKit";

/* What each ticket stage will hold once support ticketing is switched on. */
const STAGES = [
  { icon: Inbox, title: "Raised", text: "The assistant opens a ticket when a caller reports a problem it can't resolve.", from: "#FF8A3D", to: "#F0A500" },
  { icon: UserCheck, title: "Assigned", text: "Your team picks it up, with the call transcript attached.", from: "#137EFD", to: "#33B0E6" },
  { icon: Clock3, title: "Resolved", text: "Close it with a note; the caller can be followed up on WhatsApp or email.", from: "#1FB867", to: "#14B8A6" },
] as const;

export function TicketsPage() {
  return (
    <CommsShell>
      <CommsItem>
        <ChannelHero
          tone="support"
          icon={TicketIcon}
          title="Support tickets"
          description="Issues your callers report to the assistant, tracked from the first message to the fix."
          status={<HeroStatus ok={false}>Not enabled for this account yet</HeroStatus>}
        />
      </CommsItem>

      <CommsItem className={`${CARD} p-5 sm:p-6`}>
        <SectionHeader title="How tickets will work" description="Three stages, each linked to the conversation that started it." />
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {STAGES.map(({ icon, title, text, from, to }) => (
            <div key={title} className="flex gap-3 rounded-xl bg-[#F4F9FF] p-4 dark:bg-white/[0.03]">
              <IconChip icon={icon} from={from} to={to} size="h-10 w-10" iconSize="h-[18px] w-[18px]" />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[#0B1B3F] dark:text-white">{title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-[#6B7A99] dark:text-slate-400">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </CommsItem>

      <CommsItem>
        <EmptyState
          icon={AlertTriangle}
          tone="support"
          title="No tickets to show"
          text="Tickets raised by the assistant will appear here once support ticketing is enabled. Contact the VoiceDots team to turn it on."
        />
      </CommsItem>
    </CommsShell>
  );
}
