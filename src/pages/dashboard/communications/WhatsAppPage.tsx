import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  MessageCircle,
  Inbox,
  LayoutTemplate,
  Megaphone,
  Plus,
  Send,
  LayoutDashboard,
} from "lucide-react";
import type { Account, Template } from "@/api/whatsapp";
import { card, errorText } from "@/components/whatsapp/shared";
import Campaigns from "@/components/whatsapp/CampaignsTab";
import Templates from "@/components/whatsapp/TemplatesTab";
import Single from "@/components/whatsapp/SingleMessageTab";
import Messages from "@/components/whatsapp/MessagesTab";
import WhatsAppDashboardOverview from "@/components/whatsapp/WhatsAppDashboardOverview";
import { whatsappApi as api } from "@/api/whatsapp";
import { useAuth } from "@/context/AuthContext";
import {
  BTN,
  ChannelHero,
  CommsItem,
  CommsShell,
  HeroButton,
  HeroSelect,
  HeroStatus,
  IconChip,
  SegmentTabs,
} from "@/components/comms/CommsKit";

type Tab = "overview" | "messages" | "templates" | "campaigns" | "single";

const TABS = [
  ["overview", "Overview", LayoutDashboard],
  ["messages", "Inbox", Inbox],
  ["templates", "Templates", LayoutTemplate],
  ["campaigns", "Campaigns", Megaphone],
  ["single", "Single message", Send],
] as const;

export default function WhatsAppPage() {
  const { user } = useAuth();
  const previewMode = user?.email?.toLowerCase() === "sona@voicedots.io";
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    let active = true;
    api
      .settings()
      .then((data) => {
        if (active) {
          setAccounts(data.accounts);
          setAccountId(data.accounts[0]?.id || "");
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const account = accounts.find((a) => a.id === accountId);
  const hasWorkspace = previewMode || !!account;

  const status = previewMode ? (
    <HeroStatus ok={false}>Preview workspace, sending is turned off</HeroStatus>
  ) : account ? (
    <HeroStatus ok={account.ready}>
      {account.ready
        ? `${account.display_name} is connected through the Meta Cloud API`
        : `${account.display_name} needs setup before it can send`}
    </HeroStatus>
  ) : loading ? (
    <HeroStatus ok={false}>Checking your WhatsApp sender…</HeroStatus>
  ) : (
    <HeroStatus ok={false}>No WhatsApp sender linked yet</HeroStatus>
  );

  return (
    <CommsShell>
      <CommsItem>
        <ChannelHero
          tone="chat"
          icon={MessageCircle}
          title="WhatsApp"
          description="Reply to students and parents, send approved templates, and run admission campaigns from one inbox."
          status={status}
          controls={
            accounts.length > 1 ? (
              <HeroSelect label="College sender" value={accountId} onChange={(v) => { setAccountId(v); setTab("overview"); }}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.display_name}
                  </option>
                ))}
              </HeroSelect>
            ) : undefined
          }
          actions={
            hasWorkspace ? (
              <>
                <HeroButton primary tone="chat" onClick={() => setTab("campaigns")}>
                  <Plus size={16} />
                  New campaign
                </HeroButton>
                <HeroButton tone="chat" onClick={() => setTab("messages")}>
                  <Inbox size={15} />
                  Open inbox
                </HeroButton>
              </>
            ) : undefined
          }
        />
      </CommsItem>

      <CommsItem>
        {previewMode ? (
          <PreviewWorkspace tab={tab} setTab={setTab} />
        ) : loading ? (
          <div className={`${card} flex items-center gap-3 p-8 text-[#6B7A99]`}>
            <Loader2 className="animate-spin text-[#1FB867]" />
            Loading WhatsApp…
          </div>
        ) : error ? (
          <div role="alert" className={`${card} p-6 text-rose-600`}>
            {error}
          </div>
        ) : account ? (
          <Workspace key={account.id} account={account} tab={tab} setTab={setTab} />
        ) : (
          <div className={`${card} flex flex-col items-center px-6 py-12 text-center`}>
            <IconChip icon={MessageCircle} from="#1FB867" to="#14B8A6" size="h-12 w-12" />
            <h2 className="mt-4 text-lg font-semibold">Connect Meta WhatsApp to get started</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-[#6B7A99]">
              Share your WhatsApp Business Account ID (WABA ID), phone-number ID,
              and dashboard login email with your administrator. Access tokens
              belong in the backend’s secure configuration.
            </p>
            <p className="mx-auto mt-3 max-w-lg text-sm text-[#6B7A99]">
              After deployment, configure the Meta webhook with verify token
              <code className="mx-1 rounded-md bg-[#E8F8EF] px-1.5 py-0.5 font-semibold text-[#118A4B]">voicedotsai</code>.
              Your templates, campaigns and inbox appear once your sender is linked.
            </p>
          </div>
        )}
      </CommsItem>
    </CommsShell>
  );
}

function PreviewWorkspace({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const content: [string, string, string] = ({
    overview: ["Overview", "WhatsApp Dashboard", "Overview of conversations, templates and campaigns."],
    messages: ["Inbox", "No conversations yet", "Incoming and outgoing conversations will appear here."],
    templates: ["Message templates", "No templates yet", "Approved WhatsApp templates will appear here."],
    campaigns: ["WhatsApp campaigns", "Your first campaign starts here", "Create campaigns, add recipients, and review delivery analytics."],
    single: ["Send a single message", "No sender connected", "Choose an approved template and recipient when your sender is activated."],
  } as Record<Tab, [string, string, string]>)[tab];

  const Icon = TABS.find(([key]) => key === tab)?.[2] || MessageCircle;

  return (
    <div className="space-y-5">
      <SegmentTabs label="WhatsApp preview sections" value={tab} onChange={setTab} tabs={TABS} />

      {tab === "overview" ? (
        <WhatsAppDashboardOverview
          onNavigateTab={(nextTab) => setTab(nextTab)}
          onOpenNewCampaign={() => setTab("campaigns")}
        />
      ) : (
        <section className={`${card} p-5 sm:p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <IconChip icon={Icon} from="#1FB867" to="#14B8A6" />
              <div>
                <h2 className="text-[17px] font-semibold">{content[0]}</h2>
                <p className="mt-0.5 text-[12px] text-[#6B7A99]">Feature preview</p>
              </div>
            </div>
            <button disabled className={BTN}>
              <Plus size={16} />
              {tab === "single"
                ? "Send message"
                : tab === "messages"
                ? "New conversation"
                : tab === "templates"
                ? "New template"
                : "New campaign"}
            </button>
          </div>
          <div className="mt-6 rounded-2xl border border-dashed border-sky-200 bg-[#F4F9FF] p-12 text-center dark:border-slate-700 dark:bg-slate-950">
            <Icon className="mx-auto mb-3 text-[#9AA8C2]" size={32} />
            <h3 className="font-medium">{content[1]}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#6B7A99]">{content[2]}</p>
          </div>
        </section>
      )}
    </div>
  );
}

function Workspace({ account, tab, setTab }: { account: Account; tab: Tab; setTab: (t: Tab) => void }) {
  const [selectedDestination, setSelectedDestination] = useState<string | undefined>();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setTemplates(await api.templates(account.id));
  }, [account.id]);

  useEffect(() => {
    let active = true;
    api
      .templates(account.id)
      .then((rows) => {
        if (active) setTemplates(rows);
      })
      .catch((e) => {
        if (active) setNotice(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [account.id]);

  const go = (next: Tab) => {
    setTab(next);
    setNotice("");
  };

  return (
    <div className="space-y-5">
      {!account.ready && (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100 dark:bg-amber-950/20 dark:text-amber-300 dark:ring-amber-900">
          Sending is not turned on for {account.display_name}. You can prepare
          drafts and view history; ask your administrator to turn on sending.
        </div>
      )}
      {notice && (
        <div role="status" className={`${card} flex items-center justify-between gap-3 p-4 text-sm`}>
          <span>{notice}</span>
          <button aria-label="Dismiss notification" className="rounded-md px-1.5 text-[#6B7A99] hover:text-[#0B1B3F]" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}

      <SegmentTabs label="WhatsApp sections" value={tab} onChange={go} tabs={TABS} />

      {tab === "overview" && (
        <WhatsAppDashboardOverview
          account={account}
          onNavigateTab={(nextTab, destination) => {
            if (destination) setSelectedDestination(destination);
            go(nextTab);
          }}
          onOpenNewCampaign={() => go("campaigns")}
        />
      )}
      {tab === "campaigns" && <Campaigns account={account} templates={templates} notify={setNotice} />}
      {tab === "single" && <Single account={account} templates={templates} notify={setNotice} />}
      {tab === "templates" && <Templates account={account} templates={templates} refresh={refresh} notify={setNotice} />}
      {tab === "messages" && (
        <Messages accountId={account.id} account={account} templates={templates} initialDestination={selectedDestination} />
      )}
    </div>
  );
}
