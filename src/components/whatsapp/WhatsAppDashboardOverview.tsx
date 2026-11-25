import React, { useEffect, useState, useCallback } from "react";
import {
  MessageCircle,
  Plus,
  Send,
  Mail,
  Users,
  FileText,
  LayoutTemplate,
  Clock,
  ArrowRight,
  MoreVertical,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { Account, Campaign, Thread, Analytics } from "@/api/whatsapp";
import { whatsappApi as api } from "@/api/whatsapp";
import { statusLabel, errorText } from "./shared";
import { StatTile } from "@/components/comms/CommsKit";

interface WhatsAppDashboardOverviewProps {
  account?: Account;
  onNavigateTab?: (
    tab: "messages" | "templates" | "campaigns" | "single",
    destination?: string
  ) => void;
  onOpenNewCampaign?: () => void;
}

const AVATAR_COLORS = [
  "bg-sky-500",
  "bg-[#137EFD]",
  "bg-[#137EFD]",
  "bg-fuchsia-500",
  "bg-teal-500",
  "bg-emerald-500",
  "bg-amber-500",
];

function getAvatarColor(nameOrPhone: string) {
  let hash = 0;
  for (let i = 0; i < nameOrPhone.length; i++) {
    hash = nameOrPhone.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(nameOrPhone: string) {
  const trimmed = (nameOrPhone || "").trim();
  if (!trimmed) return "#";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function formatTimestamp(isoStr?: string) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return isoStr;
  }
}

function formatDate(isoStr?: string) {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoStr;
  }
}

export default function WhatsAppDashboardOverview({
  account,
  onNavigateTab,
  onOpenNewCampaign,
}: WhatsAppDashboardOverviewProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [totalThreads, setTotalThreads] = useState<number>(0);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const loadRealData = useCallback(async (isSilent = false) => {
    if (!account?.id) {
      setLoading(false);
      return;
    }

    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [threadsRes, campaignsRes, analyticsRes] = await Promise.allSettled([
        api.threads(account.id, 0, ""),
        api.campaigns(account.id, 0, "all"),
        api.analytics(account.id),
      ]);

      if (threadsRes.status === "fulfilled") {
        setThreads(threadsRes.value.items || []);
        setTotalThreads(threadsRes.value.total || 0);
      }
      if (campaignsRes.status === "fulfilled") {
        setCampaigns(campaignsRes.value.items || []);
      }
      if (analyticsRes.status === "fulfilled") {
        setAnalytics(analyticsRes.value);
      }
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [account?.id]);

  useEffect(() => {
    loadRealData();
    // Poll updates every 15s to keep conversations and campaigns live
    const interval = setInterval(() => {
      loadRealData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [loadRealData]);

  // Every figure comes from the API; "—" until it has loaded.
  const fmt = (n?: number | null) => (n == null ? "—" : n.toLocaleString());
  const awaiting = analytics?.awaiting_reply;
  const stats = [
    {
      label: "Messages sent",
      value: fmt(analytics?.sent),
      subtext: analytics ? (analytics.failed ? `${analytics.failed.toLocaleString()} failed` : "Campaign messages") : "",
      icon: Send,
      from: "#137EFD",
      to: "#5AB8FF",
    },
    {
      label: "Messages delivered",
      value: fmt(analytics?.delivered),
      subtext: analytics?.delivery_rate != null ? `${analytics.delivery_rate}% delivery rate` : analytics ? "Nothing sent yet" : "",
      icon: MessageCircle,
      from: "#1FB867",
      to: "#6FE0A0",
    },
    {
      label: "Awaiting reply",
      value: fmt(awaiting),
      subtext: awaiting == null ? "" : awaiting ? "Last message is from the contact" : "Inbox is clear",
      icon: Mail,
      from: "#F0A500",
      to: "#FFD35C",
    },
    {
      label: "Contacts",
      value: account?.id && !loading ? totalThreads.toLocaleString() : "—",
      subtext: analytics?.received != null ? `${analytics.received.toLocaleString()} replies received` : "",
      icon: Users,
      from: "#14B8A6",
      to: "#5EEAD4",
    },
  ];

  // Quick Action feature cards
  const quickActions = [
    {
      title: "Create Campaign",
      description: "Send WhatsApp messages to selected leads or groups.",
      icon: FileText,
      iconColor: "text-[#137EFD] dark:text-[#5AB8FF]",
      iconBg: "bg-[#EAF3FF] dark:bg-indigo-950/40",
      cardBg: "hover:border-sky-200 dark:hover:border-indigo-800",
      action: () => {
        if (onOpenNewCampaign) onOpenNewCampaign();
        else if (onNavigateTab) onNavigateTab("campaigns");
      },
    },
    {
      title: "Templates",
      description: "Create and manage approved template messages.",
      icon: LayoutTemplate,
      iconColor: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-50 dark:bg-blue-950/40",
      cardBg: "hover:border-blue-200 dark:hover:border-blue-800",
      action: () => onNavigateTab?.("templates"),
    },
    {
      title: "Contact Groups",
      description: "Manage leads, segments and contact lists.",
      icon: Users,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
      cardBg: "hover:border-emerald-200 dark:hover:border-emerald-800",
      action: () => {
        window.location.hash = "#leads";
      },
    },
    {
      title: "Message History",
      description: "View all sent and received WhatsApp conversations.",
      icon: Clock,
      iconColor: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-50 dark:bg-amber-950/40",
      cardBg: "hover:border-amber-200 dark:hover:border-amber-800",
      action: () => onNavigateTab?.("messages"),
    },
  ];

  const getStatusBadge = (status: string, direction?: string) => {
    const raw = (status || "").toLowerCase();
    const label = statusLabel(status);

    if (raw === "completed" || raw === "replied" || raw === "read" || raw === "delivered") {
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
          {label}
        </span>
      );
    }
    if (raw === "in_progress" || raw === "running" || raw === "sending") {
      return (
        <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-400">
          {label}
        </span>
      );
    }
    if (raw === "scheduled" || raw === "queued") {
      return (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
          {label}
        </span>
      );
    }
    if (raw === "unread" || raw === "failed") {
      return (
        <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
          {label}
        </span>
      );
    }
    if (direction === "inbound") {
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
          Replied
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-[#EEF3FB] px-2.5 py-0.5 text-xs font-medium text-[#33415F] dark:bg-slate-800 dark:text-slate-300">
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Freshness + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-[13px] text-[#6B7A99]">
          {analytics ? (
            <>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1FB867] motion-reduce:animate-none" />
              Live, refreshes every 15 seconds
            </>
          ) : (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-[12px] font-medium text-amber-700 ring-1 ring-amber-100">
              Sample figures until your sender starts sending
            </span>
          )}
        </span>
        <button
          type="button"
          title="Refresh"
          aria-label="Refresh WhatsApp data"
          onClick={() => loadRealData()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#6B7A99] shadow-sm ring-1 ring-sky-100 hover:text-[#0B1B3F] dark:bg-slate-900 dark:ring-slate-800"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin motion-reduce:animate-none" : ""} />
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-[#FDE4EA] px-4 py-3 text-[13px] font-medium text-[#A62146]">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <StatTile key={s.label} label={s.label} value={s.value} foot={s.subtext || undefined} icon={s.icon} from={s.from} to={s.to} />
        ))}
      </div>
      {/* 4 Action / Feature Navigation Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action, idx) => {
          const Icon = action.icon;
          return (
            <div
              key={idx}
              onClick={action.action}
              className={`group relative flex cursor-pointer flex-col justify-between rounded-2xl bg-white shadow-[0_8px_26px_rgba(18,50,120,0.09)] ring-1 ring-sky-100/80 dark:bg-slate-900 dark:ring-slate-800 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 ${action.cardBg}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.iconBg} ${action.iconColor}`}
                >
                  <Icon size={20} />
                </span>
                <button
                  type="button"
                  aria-label={action.title}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F4F9FF] text-[#9AA8C2] transition-colors group-hover:bg-[#EAF3FF] group-hover:text-[#137EFD] dark:bg-slate-800 dark:text-[#9AA8C2] dark:group-hover:bg-slate-700 dark:group-hover:text-[#137EFD]"
                >
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className="mt-5">
                <h3 className="text-sm font-bold text-[#0B1B3F] dark:text-white">
                  {action.title}
                </h3>
                <p className="mt-1 text-xs text-[#6B7A99] dark:text-[#9AA8C2] leading-relaxed">
                  {action.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom 2 Columns: Real Recent Campaigns & Real Recent Conversations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Real Recent Campaigns Table */}
        <div className="rounded-2xl bg-white shadow-[0_8px_26px_rgba(18,50,120,0.09)] ring-1 ring-sky-100/80 dark:bg-slate-900 dark:ring-slate-800 p-5">
          <div className="flex items-center justify-between pb-4 border-b border-[#E6EDF8] dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF3FF] text-[#137EFD] dark:bg-indigo-950/40 dark:text-[#5AB8FF]">
                <FileText size={16} />
              </span>
              <h3 className="text-sm font-bold text-[#0B1B3F] dark:text-white">
                Recent Campaigns
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.("campaigns")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#137EFD] hover:text-[#137EFD] dark:text-[#5AB8FF]"
            >
              View All <ArrowRight size={13} />
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-xs text-[#9AA8C2]">
                <Loader2 size={16} className="animate-spin mr-2 text-[#137EFD]" />
                Loading campaigns…
              </div>
            ) : campaigns.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-xs text-[#6B7A99] dark:text-[#9AA8C2]">
                  No campaigns launched yet.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenNewCampaign) onOpenNewCampaign();
                    else if (onNavigateTab) onNavigateTab("campaigns");
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#EAF3FF] px-3 py-1.5 text-xs font-medium text-[#137EFD] hover:bg-[#EAF3FF] dark:bg-indigo-950/40 dark:text-[#5AB8FF]"
                >
                  <Plus size={13} /> Create your first campaign
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6EDF8] text-[11px] font-semibold text-[#9AA8C2] dark:border-slate-800 dark:text-[#6B7A99]">
                    <th className="pb-3 font-medium">#</th>
                    <th className="pb-3 font-medium">Campaign Name</th>
                    <th className="pb-3 font-medium">Audience</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Created On</th>
                    <th className="pb-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF3FB] dark:divide-slate-800">
                  {campaigns.slice(0, 5).map((camp, index) => (
                    <tr
                      key={camp.id}
                      onClick={() => onNavigateTab?.("campaigns")}
                      className="cursor-pointer hover:bg-[#F4F9FF] dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 font-medium text-[#6B7A99] dark:text-[#9AA8C2]">
                        {index + 1}.
                      </td>
                      <td className="py-3 font-semibold text-[#0B1B3F] dark:text-white whitespace-nowrap">
                        {camp.name}
                      </td>
                      <td className="py-3 text-[#6B7A99] dark:text-[#9AA8C2] whitespace-nowrap">
                        {camp.template_name || (camp.total_contacts ? `${camp.total_contacts} Contacts` : "All Contacts")}
                      </td>
                      <td className="py-3 whitespace-nowrap">
                        {getStatusBadge(camp.status)}
                      </td>
                      <td className="py-3 text-[#9AA8C2] dark:text-[#6B7A99] whitespace-nowrap">
                        {formatDate(camp.created_at)}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          aria-label="Actions"
                          className="p-1 text-[#9AA8C2] hover:text-[#6B7A99] dark:hover:text-slate-200 rounded"
                        >
                          <MoreVertical size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Real Recent Conversations List */}
        <div className="rounded-2xl bg-white shadow-[0_8px_26px_rgba(18,50,120,0.09)] ring-1 ring-sky-100/80 dark:bg-slate-900 dark:ring-slate-800 p-5">
          <div className="flex items-center justify-between pb-4 border-b border-[#E6EDF8] dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF3FF] text-[#137EFD] dark:bg-indigo-950/40 dark:text-[#5AB8FF]">
                <MessageCircle size={16} />
              </span>
              <h3 className="text-sm font-bold text-[#0B1B3F] dark:text-white">
                Recent Conversations
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.("messages")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#137EFD] hover:text-[#137EFD] dark:text-[#5AB8FF]"
            >
              View All <ArrowRight size={13} />
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-xs text-[#9AA8C2]">
                <Loader2 size={16} className="animate-spin mr-2 text-[#137EFD]" />
                Loading conversations…
              </div>
            ) : threads.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-xs text-[#6B7A99] dark:text-[#9AA8C2]">
                  No conversations yet. Messages and student replies will appear here.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.("messages")}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#EAF3FF] px-3 py-1.5 text-xs font-medium text-[#137EFD] hover:bg-[#EAF3FF] dark:bg-indigo-950/40 dark:text-[#5AB8FF]"
                >
                  <MessageCircle size={13} /> Open Inbox
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6EDF8] text-[11px] font-semibold text-[#9AA8C2] dark:border-slate-800 dark:text-[#6B7A99]">
                    <th className="pb-3 font-medium">Contact</th>
                    <th className="pb-3 font-medium">Last Message</th>
                    <th className="pb-3 font-medium">Time</th>
                    <th className="pb-3 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF3FB] dark:divide-slate-800">
                  {threads.slice(0, 5).map((conv) => {
                    const displayName = conv.contact_name || conv.destination;
                    const avatarColor = getAvatarColor(displayName);
                    const avatarInitials = getInitials(displayName);

                    return (
                      <tr
                        key={conv.destination}
                        onClick={() => onNavigateTab?.("messages", conv.destination)}
                        className="cursor-pointer hover:bg-[#F4F9FF] dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor}`}
                            >
                              {avatarInitials}
                            </span>
                            <span className="font-semibold text-[#0B1B3F] dark:text-white">
                              {displayName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 max-w-[180px] truncate text-[#6B7A99] dark:text-[#9AA8C2]">
                          {conv.direction === "outbound" && (
                            <span className="text-[#9AA8C2] font-medium">You: </span>
                          )}
                          {conv.body || "No message preview"}
                        </td>
                        <td className="py-3 text-[#9AA8C2] dark:text-[#6B7A99] whitespace-nowrap">
                          {formatTimestamp(conv.last_at)}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          {getStatusBadge(conv.status, conv.direction)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}