import { useEffect, useState, useCallback, useDeferredValue, useRef } from "react";
import { format, parseISO } from "date-fns";
import { CheckCircle2, Download, Loader2, Percent, Phone, Search, Trash2, UserPlus, Users } from "lucide-react";
import leadsApi from "@/api/leads";
import { LeadDetailsDrawer } from "@/components/LeadDetailsDrawer";
import { DatePickerWithRange } from "@/components/DatePickerWithRange";
import type { Lead } from "@/types/lead.types";
import { useAuth } from "@/context/AuthContext";
import {
  CARD,
  ChannelHero,
  CommsItem,
  CommsShell,
  EmptyState,
  HeroButton,
  HeroStatus,
  INPUT,
  Notice,
  Pager,
  SegmentTabs,
  StatTile,
} from "@/components/comms/CommsKit";

type StatusFilter = "" | "Qualified" | "Follow Up" | "Unqualified";

const STATUS_TABS = [
  ["", "All leads"],
  ["Qualified", "Qualified"],
  ["Follow Up", "Follow up"],
  ["Unqualified", "Unqualified"],
] as const;

const initials = (name?: string | null) =>
  (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

/* Avatar hue is stable per lead so the list is scannable. */
const AVATAR_GRADIENTS = [
  ["#7732FD", "#A779FF"],
  ["#137EFD", "#5AB8FF"],
  ["#F27198", "#FF8FA3"],
  ["#14B8A6", "#6FE0C8"],
  ["#FF8A3D", "#FFB27A"],
];
const avatarFor = (key: string) => AVATAR_GRADIENTS[[...key].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_GRADIENTS.length];

function LeadStatus({ value }: { value?: string }) {
  const cls =
    value === "Qualified"
      ? "bg-[#DDF7E8] text-[#118A4B] dark:bg-emerald-500/10 dark:text-emerald-300"
      : value === "Unqualified"
        ? "bg-[#FFF1DA] text-[#A86A00] dark:bg-amber-500/10 dark:text-amber-300"
        : "bg-[#EFE6FF] text-[#6A2EE0] dark:bg-violet-500/10 dark:text-violet-300";
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>{value || "Follow Up"}</span>;
}

export function LeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    qualified: 0,
    page: 1,
    limit: 20,
    pages: 0,
  });
  const deferredSearch = useDeferredValue(search.trim());

  const fetchLeads = useCallback(
    async (isExport = false) => {
      if (!user?.agent_id && !isExport) return;
      if (!isExport) setLoading(true);
      if (!isExport) setLoadError("");
      try {
        const response = await leadsApi.getLeads({
          agentId: user?.agent_id,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          status: statusFilter || undefined,
          search: deferredSearch || undefined,
          page: isExport ? 1 : page,
          limit: isExport ? 10000 : 20,
        });
        if (isExport) return response.data;
        setLeads(response.data);
        setPagination(response.pagination);
      } catch (err) {
        console.error("Failed to fetch leads:", err);
        if (!isExport) setLoadError("Leads couldn't be loaded. Check your connection and retry.");
      } finally {
        if (!isExport) setLoading(false);
      }
    },
    [user?.agent_id, startDate, endDate, statusFilter, deferredSearch, page]
  );

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, statusFilter, search]);

  // Close the export menu on outside click / Escape.
  useEffect(() => {
    if (!exportMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExportMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [exportMenuOpen]);

  const handleDeleteLead = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    if (!window.confirm("Delete this lead? This can't be undone.")) return;
    try {
      await leadsApi.deleteLead(conversationId, user?.agent_id);
      setLeads((prev) => prev.filter((l) => l.conversation_id !== conversationId));
      if (selectedLead?.conversation_id === conversationId) {
        setDrawerOpen(false);
        setSelectedLead(null);
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const generateDownload = (leadsToExport: Lead[], filename: string) => {
    if (!leadsToExport.length) return;
    const escapeCsv = (str: unknown) => `"${String(str || "").replace(/"/g, '""')}"`;
    const formatDt = (iso: string | undefined) => {
      if (!iso) return '""';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '""';
      const p = (n: number) => String(n).padStart(2, "0");
      return `"${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}"`;
    };

    const headers = ["Name", "Phone", "Email", "Description", "Status", "Date"].join(",");
    const rows = [...leadsToExport]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .map((l) =>
        [escapeCsv(l.name), escapeCsv(l.mobile || l.phone), escapeCsv(l.email), escapeCsv(l.business_description || l.summary), escapeCsv(l.status), formatDt(l.created_at)].join(",")
      );

    const blob = new Blob(["﻿" + [headers, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const all = await fetchLeads(true);
      if (all) generateDownload(all as Lead[], "leads_all.csv");
    } finally {
      setExporting(false);
      setExportMenuOpen(false);
    }
  };

  const rate = pagination.total > 0 ? Math.round((pagination.qualified / pagination.total) * 100) : 0;
  const openLead = (lead: Lead) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  };

  return (
    <>
      <div className={`transition-[margin] duration-300 ${drawerOpen ? "lg:mr-[420px]" : ""}`}>
        <CommsShell>
          <CommsItem>
            <ChannelHero
              tone="leads"
              icon={UserPlus}
              title="Leads"
              description="Contacts your assistant captured during conversations, with the details it qualified them on."
              status={
                <HeroStatus ok={pagination.total > 0}>
                  {loading ? "Counting leads…" : `${pagination.total.toLocaleString()} captured · ${pagination.qualified.toLocaleString()} qualified`}
                </HeroStatus>
              }
              actions={
                <div ref={exportRef} className="relative">
                  <HeroButton
                    primary
                    tone="leads"
                    aria-haspopup="menu"
                    aria-expanded={exportMenuOpen}
                    onClick={() => setExportMenuOpen((v) => !v)}
                    disabled={leads.length === 0}
                  >
                    {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    Export CSV
                  </HeroButton>
                  {exportMenuOpen && (
                    <div role="menu" className={`${CARD} absolute left-0 top-full z-50 mt-2 w-52 p-1 text-[#0B1B3F] dark:text-slate-100`}>
                      <button
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          generateDownload(leads, "leads_current.csv");
                          setExportMenuOpen(false);
                        }}
                        className="w-full rounded-lg px-3 py-2.5 text-left text-[13px] font-medium hover:bg-[#F4F9FF] dark:hover:bg-white/[0.06]"
                      >
                        This page
                        <span className="block text-[11px] font-normal text-[#6B7A99] dark:text-slate-400">{leads.length} leads</span>
                      </button>
                      <button
                        role="menuitem"
                        type="button"
                        onClick={exportAll}
                        className="w-full rounded-lg px-3 py-2.5 text-left text-[13px] font-medium hover:bg-[#F4F9FF] dark:hover:bg-white/[0.06]"
                      >
                        All matching leads
                        <span className="block text-[11px] font-normal text-[#6B7A99] dark:text-slate-400">{pagination.total.toLocaleString()} leads</span>
                      </button>
                    </div>
                  )}
                </div>
              }
            />
          </CommsItem>

          <CommsItem className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile label="Total leads" value={loading ? "—" : pagination.total.toLocaleString()} icon={Users} from="#7732FD" to="#A779FF" foot="In this view" />
            <StatTile
              label="Qualified"
              value={loading ? "—" : pagination.qualified.toLocaleString()}
              icon={CheckCircle2}
              from="#1FB867"
              to="#6FE0A0"
              foot="Ready for follow-up"
              footTone="up"
            />
            <StatTile label="Qualification rate" value={loading ? "—" : `${rate}%`} icon={Percent} from="#F27198" to="#FF8FA3" foot="Qualified ÷ captured" />
          </CommsItem>

          {/* FILTERS */}
          <CommsItem className={`${CARD} flex flex-col gap-3 p-3 sm:p-4 xl:flex-row xl:items-center xl:justify-between`}>
            <SegmentTabs label="Lead status" value={statusFilter} onChange={setStatusFilter} tabs={STATUS_TABS} />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative block min-w-0 sm:w-64">
                <span className="sr-only">Search leads</span>
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 mt-0.5 -translate-y-1/2 text-[#9AA8C2]" />
                <input placeholder="Search name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} className={`${INPUT} mt-0 pl-10`} />
              </label>
              <DatePickerWithRange
                value={startDate ? { from: parseISO(startDate), to: endDate ? parseISO(endDate) : undefined } : undefined}
                onChange={(range) => {
                  setStartDate(range?.from ? format(range.from, "yyyy-MM-dd") : "");
                  setEndDate(range?.to ? format(range.to, "yyyy-MM-dd") : "");
                }}
                onClear={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                showClear={Boolean(startDate || endDate)}
                label="Date Range"
                className="w-full sm:w-auto [&_label]:sr-only"
              />
            </div>
          </CommsItem>

          {/* LIST */}
          <CommsItem>
            {loading ? (
              <div className={`${CARD} flex items-center justify-center gap-2 py-24 text-[13px] text-[#6B7A99] dark:text-slate-400`}>
                <Loader2 className="animate-spin text-[#7732FD]" size={20} /> Loading leads…
              </div>
            ) : loadError ? (
              <Notice tone="error">
                {loadError}{" "}
                <button type="button" onClick={() => fetchLeads()} className="font-semibold underline">
                  Retry
                </button>
              </Notice>
            ) : leads.length === 0 ? (
              <EmptyState
                icon={Search}
                tone="leads"
                title={search || statusFilter || startDate ? "No leads match these filters" : "No leads yet"}
                text={
                  search || statusFilter || startDate
                    ? "Try a wider date range, another status, or a different search."
                    : "When a caller shares their details with the assistant, they'll appear here."
                }
              />
            ) : (
              <div className={`${CARD} overflow-hidden`}>
                <div className="hidden grid-cols-[minmax(0,1fr)_170px_190px_120px_44px] gap-4 border-b border-sky-100 px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-[#6B7A99] dark:border-white/[0.06] dark:text-slate-500 lg:grid">
                  <span>Lead</span>
                  <span>Phone</span>
                  <span>Captured</span>
                  <span>Status</span>
                  <span className="sr-only">Actions</span>
                </div>
                <ul className="divide-y divide-sky-100/80 dark:divide-white/[0.06]">
                  {leads.map((lead) => {
                    const [a, b] = avatarFor(lead.conversation_id);
                    const active = drawerOpen && selectedLead?.conversation_id === lead.conversation_id;
                    return (
                      <li key={lead.conversation_id}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => openLead(lead)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openLead(lead);
                            }
                          }}
                          className={`group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 outline-none transition-colors focus-visible:bg-[#F4F9FF] sm:px-5 lg:grid-cols-[minmax(0,1fr)_170px_190px_120px_44px] lg:gap-4 ${
                            active ? "bg-[#F4F0FF] dark:bg-violet-500/[0.08]" : "hover:bg-[#F8FBFF] dark:hover:bg-white/[0.03] dark:focus-visible:bg-white/[0.05]"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
                              style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
                            >
                              {initials(lead.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-semibold text-[#0B1B3F] dark:text-white">{lead.name ?? "Unknown caller"}</p>
                              <p className="truncate text-[12px] text-[#6B7A99] dark:text-slate-400">{lead.email ?? "No email shared"}</p>
                            </div>
                          </div>
                          <span className="hidden items-center gap-2 text-[13px] tabular-nums text-[#0B1B3F] dark:text-slate-200 lg:flex">
                            <Phone size={14} className="shrink-0 text-[#9AA8C2]" />
                            <span className="truncate">{lead.mobile || lead.phone || "—"}</span>
                          </span>
                          <span className="hidden text-[12px] text-[#6B7A99] dark:text-slate-400 lg:block">
                            {lead.created_at ? new Date(lead.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}
                          </span>
                          <span className="justify-self-end lg:justify-self-start">
                            <LeadStatus value={lead.status} />
                          </span>
                          <button
                            type="button"
                            aria-label={`Delete lead ${lead.name ?? ""}`}
                            onClick={(e) => handleDeleteLead(e, lead.conversation_id)}
                            className="hidden h-9 w-9 items-center justify-center rounded-lg text-[#9AA8C2] opacity-0 transition hover:bg-[#FDE4EA] hover:text-[#C42D52] focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-rose-500/10 dark:hover:text-rose-300 lg:flex"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CommsItem>

          {!loading && (
            <CommsItem>
              <Pager page={pagination.page} pages={pagination.pages} onPage={setPage} total={pagination.total} noun="leads" />
            </CommsItem>
          )}
        </CommsShell>
      </div>

      <LeadDetailsDrawer
        lead={selectedLead}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onUpdateLead={(updated) => {
          setLeads((prev) => prev.map((l) => (l.conversation_id === updated.conversation_id ? updated : l)));
          setSelectedLead(updated);
        }}
        onDeleteLead={(id) => {
          setLeads((prev) => prev.filter((l) => l.conversation_id !== id));
          setDrawerOpen(false);
          setSelectedLead(null);
        }}
      />
    </>
  );
}
