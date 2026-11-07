import { FileText, Inbox, Mail, Megaphone, PenSquare, Settings } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { ChannelHero, CommsItem, CommsShell } from "@/components/comms/CommsKit";

const tabs = [
  ["Inbox", "/dashboard/communications/gmail/inbox", Inbox],
  ["Compose", "/dashboard/communications/gmail/single", PenSquare],
  ["Templates", "/dashboard/communications/gmail/templates", FileText],
  ["Campaigns", "/dashboard/communications/gmail/campaigns", Megaphone],
  ["Settings", "/dashboard/communications/gmail/settings", Settings],
] as const;

export default function EmailPage() {
  return (
    <CommsShell>
      <CommsItem>
        <ChannelHero
          tone="mail"
          icon={Mail}
          title="Gmail"
          description="Read and reply to your connected mailbox, send one-off emails, and run template campaigns to leads and students."
        />
      </CommsItem>
      <CommsItem>
        <nav aria-label="Gmail sections" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm ring-1 ring-sky-100 dark:bg-[#0F1A33] dark:ring-white/[0.07]">
          {tabs.map(([label, path, Icon]) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#137EFD] ${
                  isActive
                    ? "bg-[#137EFD] text-white shadow-sm"
                    : "text-[#6B7A99] hover:bg-[#F4F9FF] hover:text-[#0B1B3F] dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>
      </CommsItem>
      <CommsItem>
        <Outlet />
      </CommsItem>
    </CommsShell>
  );
}
