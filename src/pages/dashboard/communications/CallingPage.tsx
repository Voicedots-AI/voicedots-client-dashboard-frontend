import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, Bot, CalendarDays, CheckCircle2, ChevronRight, Download, FileSpreadsheet, Gauge, LayoutDashboard, Loader2, Megaphone, Phone, PhoneCall, PhoneOutgoing, Plus, RefreshCw, ShieldCheck, Sparkles, Square, Timer, Upload, Users, type LucideIcon } from 'lucide-react';
import { phoneAgentsApi, type ClientPhoneAgent } from '@/api/phoneAgents';
import { outboundCallsApi, type AiHealth, type OutboundAgent, type OutboundCallStatus } from '@/api/outboundCalls';
import { outboundBatchesApi, type BatchDetails, type BatchFilters, type BatchSummary, type BatchUploadResult } from '@/api/outboundBatches';
import { OutboundCallTracker } from '@/components/calling/OutboundCallTracker';
import CallingOverviewTab from '@/components/calling/CallingOverviewTab';
import { BTN, BTN_SECONDARY, CARD, ChannelHero, CommsItem, CommsShell, HeroButton, HeroSelect, HeroStatus, IconChip, INPUT, SectionHeader, SegmentTabs } from '@/components/comms/CommsKit';

const consentText = 'I confirm every recipient in this file consented to receive this call and the campaign complies with applicable calling rules.';
const OUTCOMES = ['Interested', 'Follow-up requested', 'Not interested', 'Connected — inconclusive', 'No response', 'Call not lifted', 'Call not connected'];
const CALL_STATUSES = ['connected', 'failed', 'queued', 'dialing', 'pending', 'blocked', 'skipped'];
type ApiError = { response?: { data?: { detail?: string | { reasons?: string[]; message?: string } } } };
type CampaignGroup = { name: string; batches: BatchSummary[]; total: number; completed: number; failed: number; pending: number; status: string; latest: string };

const errorMessage = (error: unknown, fallback: string) => {
  const detail = (error as ApiError)?.response?.data?.detail;
  return typeof detail === 'string' ? detail : detail?.reasons?.join(' · ') || detail?.message || fallback;
};
const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const statusLabel = (value: string) => value === 'failed' ? 'Call not connected' : value.replaceAll('_', ' ');

function StatusBadge({ value }: { value: string }) {
  const tone = value === 'completed' || value === 'connected' ? 'bg-[#DDF7E8] text-[#118A4B] dark:bg-emerald-950 dark:text-emerald-300'
    : value === 'failed' || value === 'blocked' ? 'bg-[#FDE4EA] text-[#C42D52] dark:bg-rose-950 dark:text-rose-300'
      : value === 'running' || value === 'queued' || value === 'dialing' ? 'bg-[#E3EEFF] text-[#0F5FC4] dark:bg-blue-950 dark:text-blue-300'
        : 'bg-[#EEF3FB] text-[#55648A] dark:bg-slate-800 dark:text-slate-300';
  const live = value === 'running' || value === 'dialing';
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${tone}`}>
      {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none" />}
      {statusLabel(value)}
    </span>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl bg-[#F4F9FF] px-2 py-2 dark:bg-slate-950"><div className="text-[15px] font-semibold tabular-nums">{value}</div><div className="text-[11px] text-[#6B7A99]">{label}</div></div>;
}

export default function CallingPage() {
  const [agents, setAgents] = useState<ClientPhoneAgent[]>([]), [selectedId, setSelectedId] = useState('');
  const [outbound, setOutbound] = useState<OutboundAgent[]>([]), [tab, setTab] = useState<'overview' | 'campaigns' | 'single'>('overview');
  const [message, setMessage] = useState(''), [name, setName] = useState(''), [number, setNumber] = useState('');
  const [singleConsent, setSingleConsent] = useState(false), [calling, setCalling] = useState(false);
  const [batches, setBatches] = useState<BatchSummary[]>([]), [campaignName, setCampaignName] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null), [showCreate, setShowCreate] = useState(false);
  const [details, setDetails] = useState<BatchDetails | null>(null), [file, setFile] = useState<File | null>(null);
  const [batchConsent, setBatchConsent] = useState(false), [uploadResult, setUploadResult] = useState<BatchUploadResult | null>(null);
  const [busy, setBusy] = useState(false), [outcome, setOutcome] = useState(''), [callStatus, setCallStatus] = useState('');
  const [activeCall, setActiveCall] = useState<OutboundCallStatus | null>(null);
  const [aiHealth, setAiHealth] = useState<AiHealth | null>(null), [checkingAi, setCheckingAi] = useState(false);
  const [search, setSearch] = useState(''), [page, setPage] = useState(1);

  const selected = agents.find((agent) => agent.id === selectedId) || agents.find((a) => outbound.some((o) => o.id === a.id)) || agents[0] || null;
  const config = useMemo(() => outbound.find((item) => item.id === selected?.id) || null, [outbound, selected]);
  const capacity = selected?.dids.reduce((total, did) => total + did.channel_limit, 0) || 0;
  const ready = !!config && config.platform_enabled && config.enabled && (config.mode === 'outbound' || config.mode === 'both') && config.status === 'active' && !!config.outbound_trunk_id;
  const reasons = !config ? ['No outbound configuration is assigned to this agent.'] : [!config.platform_enabled ? 'Outbound calling is paused by the administrator.' : '', !config.enabled ? 'This agent is not enabled for outbound calls.' : '', config.mode === 'inbound' ? 'This agent is configured for inbound calls only.' : '', !config.outbound_trunk_id ? 'No outbound trunk is assigned.' : ''].filter(Boolean);
  const campaigns = useMemo<CampaignGroup[]>(() => {
    const groups = new Map<string, BatchSummary[]>();
    batches.forEach((batch) => { const key = batch.campaign_name || batch.agent_name; groups.set(key, [...(groups.get(key) || []), batch]); });
    return [...groups.entries()].map(([campaign, runs]) => ({ name: campaign, batches: runs, total: runs.reduce((sum, run) => sum + run.total_contacts, 0), completed: runs.reduce((sum, run) => sum + run.completed, 0), failed: runs.reduce((sum, run) => sum + run.failed, 0), pending: runs.reduce((sum, run) => sum + run.pending, 0), status: runs.some((run) => run.status === 'running') ? 'running' : runs.some((run) => run.status === 'draft') ? 'draft' : runs.every((run) => run.status === 'completed') ? 'completed' : runs[0]?.status || 'draft', latest: runs[0]?.created_at || '' }));
  }, [batches]);
  const activeCampaign = campaigns.find((campaign) => campaign.name === selectedCampaign) || null;
  const detailId = details?.id;
  const detailStatus = details?.status;
  const filters = useMemo<BatchFilters>(() => ({ outcome, callStatus, search, page, limit: 100 }), [outcome, callStatus, search, page]);
  const loadBatches = useCallback(async () => { try { setBatches(await outboundBatchesApi.list()); } catch (error) { setMessage(errorMessage(error, 'Unable to load campaign history.')); } }, []);
  const loadDetails = useCallback(async (id: string, selectedFilters: BatchFilters = {}) => { try { setDetails(await outboundBatchesApi.get(id, selectedFilters)); } catch (error) { setMessage(errorMessage(error, 'Unable to load campaign details.')); } }, []);

  useEffect(() => {
    Promise.allSettled([phoneAgentsApi.list(), outboundCallsApi.list(), outboundBatchesApi.list()]).then(([agentResult, outboundResult, batchResult]) => {
      const agentList = agentResult.status === 'fulfilled' ? agentResult.value : [];
      const outboundList = outboundResult.status === 'fulfilled' ? outboundResult.value : [];
      if (agentResult.status === 'fulfilled') setAgents(agentList);
      else setMessage('Unable to load assigned phone agents.');
      if (outboundResult.status === 'fulfilled') setOutbound(outboundList);
      else setMessage('Unable to load outbound calling configuration.');
      if (batchResult.status === 'fulfilled') setBatches(batchResult.value);
      else setMessage('Unable to load campaigns.');

      // Automatically select the active outbound-enabled agent instead of falling back to inbound
      const preferred =
        agentList.find((a) => outboundList.some((o) => o.id === a.id && o.status === 'active' && !!o.outbound_trunk_id)) ||
        agentList.find((a) => a.mode === 'outbound' || a.mode === 'both') ||
        agentList[0];
      if (preferred) setSelectedId(preferred.id);
    });
  }, []);
  useEffect(() => { if (!detailId) return; const timer = window.setTimeout(() => loadDetails(detailId, filters), 250); return () => window.clearTimeout(timer); }, [detailId, filters, loadDetails]);
  useEffect(() => { if (!detailId || detailStatus !== 'running') return; const timer = window.setInterval(() => { loadDetails(detailId, filters); loadBatches(); }, 3000); return () => window.clearInterval(timer); }, [detailId, detailStatus, filters, loadBatches, loadDetails]);
  useEffect(() => { if (!activeCall || ['connected', 'failed', 'blocked'].includes(activeCall.status)) return; const refresh = () => outboundCallsApi.status(activeCall.id).then(setActiveCall).catch(() => undefined); const timer = window.setInterval(refresh, 1500); return () => window.clearInterval(timer); }, [activeCall]);
  useEffect(() => { setAiHealth(null); }, [selectedId]);
  useEffect(() => {
    if (config && ready && !aiHealth && !checkingAi) {
      void checkAi();
    }
  }, [config?.id, ready]);

  const checkAi = async () => { if (!config || !ready) return; setCheckingAi(true); setAiHealth(null); setMessage('Checking Gemini voice readiness…'); try { const result = await outboundCallsApi.health(config.id); setAiHealth(result); setMessage(result.message); } catch (error) { setMessage(errorMessage(error, 'Unable to check AI readiness.')); } finally { setCheckingAi(false); } };
  const placeCall = async () => { if (!config || !ready) return; if (!name.trim() || !number.trim() || !singleConsent) { setMessage('Enter a contact, use an international number, and confirm consent.'); return; } setCalling(true); setMessage(''); try { const result = await outboundCallsApi.create({ phone_agent_id: config.id, destination: number.trim(), contact_name: name.trim(), consent_confirmed: true }); setActiveCall({ id: result.id, status: 'queued', contact_name: name.trim(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), user_message: result.user_message }); setMessage(result.user_message || 'Call queued. Preparing the voice agent…'); setName(''); setNumber(''); setSingleConsent(false); } catch (error) { setMessage(errorMessage(error, 'Call could not be queued.')); } finally { setCalling(false); } };
  const uploadBatch = async () => { if (!config || !file || !batchConsent || !campaignName.trim()) { setMessage('Enter a campaign name, select a contact file, and confirm consent.'); return; } setBusy(true); setMessage(''); try { const result = await outboundBatchesApi.upload({ file, phoneAgentId: config.id, campaignName: campaignName.trim(), consentDeclaration: consentText, concurrency: Math.max(1, Math.min(capacity || 1, 20)) }); setUploadResult(result); await loadDetails(result.id); await loadBatches(); setMessage(`${result.accepted} contacts accepted${result.rejected_count ? `; ${result.rejected_count} rejected` : ''}. Review and start the campaign.`); } catch (error) { setMessage(errorMessage(error, 'Contact file could not be uploaded.')); } finally { setBusy(false); } };
  const startBatch = async (id: string) => { setBusy(true); setMessage(''); try { await outboundBatchesApi.start(id); await Promise.all([loadDetails(id), loadBatches()]); setUploadResult(null); setFile(null); setBatchConsent(false); setShowCreate(false); setSelectedCampaign(campaignName.trim()); setMessage('Campaign started. Progress updates automatically.'); } catch (error) { setMessage(errorMessage(error, 'Campaign could not be started.')); } finally { setBusy(false); } };
  const cancelBatch = async (id: string) => { if (!window.confirm('Stop this campaign run? Calls already in progress will finish.')) return; setBusy(true); try { await outboundBatchesApi.cancel(id); await Promise.all([loadDetails(id, filters), loadBatches()]); setMessage('Campaign run cancelled.'); } catch (error) { setMessage(errorMessage(error, 'Campaign could not be cancelled.')); } finally { setBusy(false); } };
  const openRun = (batch: BatchSummary) => { setOutcome(''); setCallStatus(''); setSearch(''); setPage(1); loadDetails(batch.id); };
  const exportReport = async () => { if (!details) return; setBusy(true); try { await outboundBatchesApi.downloadReport(details.id, details.campaign_name, { outcome, callStatus }); } catch (error) { setMessage(errorMessage(error, 'Report could not be exported.')); } finally { setBusy(false); } };
  const exportCampaign = async () => { if (!selectedCampaign) return; setBusy(true); try { await outboundBatchesApi.downloadCampaignReport(selectedCampaign, { outcome, callStatus }); } catch (error) { setMessage(errorMessage(error, 'Campaign report could not be exported.')); } finally { setBusy(false); } };


  const openCreate = () => { setTab('campaigns'); setSelectedCampaign(null); setShowCreate(true); };
  const lineStatus = ready
    ? `Outbound line ready${config?.did ? `, caller ID ${config.did}` : ''}${capacity ? `, ${capacity} parallel calls` : ''}`
    : reasons[0] || 'Outbound calling is not set up for this agent.';

  return (
    <CommsShell>
      <CommsItem>
        <ChannelHero
          tone="voice"
          icon={PhoneCall}
          title="AI Calling"
          description="Your voice agent answers enquiries and calls students back. Review every conversation, run outbound campaigns, or place a single call."
          status={<HeroStatus ok={ready}>{lineStatus}</HeroStatus>}
          controls={agents.length > 0 ? (
            <HeroSelect label="Phone agent" value={selected?.id || ''} onChange={setSelectedId}>
              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.display_name}</option>)}
            </HeroSelect>
          ) : undefined}
          actions={<>
            <HeroButton primary onClick={openCreate}><Plus size={16} />New campaign</HeroButton>
            <HeroButton onClick={() => setTab('single')}><Phone size={15} />Place a call</HeroButton>
          </>}
        />
      </CommsItem>

      {message && (
        <div role="status" className={`${CARD} flex items-start justify-between gap-3 px-4 py-3 text-sm text-[#33415F] dark:text-slate-200`}>
          <span>{message}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setMessage('')} className="rounded-md px-1.5 text-[#6B7A99] hover:text-[#0B1B3F]">×</button>
        </div>
      )}

      {activeCall && (
        <OutboundCallTracker call={activeCall} contactName={activeCall.contact_name || name} destination={number} onClose={() => setActiveCall(null)} />
      )}

      <CommsItem>
        <SegmentTabs
          label="AI Calling sections"
          value={tab}
          onChange={setTab}
          tabs={[['overview', 'Overview', LayoutDashboard], ['campaigns', 'Campaigns', Megaphone], ['single', 'Single call', Phone]] as const}
        />
      </CommsItem>

      <CommsItem>
        {tab === 'overview' ? (
          <CallingOverviewTab agentId={selected?.phone_agent_id || selected?.id} batches={batches} onOpenNewCampaign={openCreate} onOpenSingleCall={() => setTab('single')} />
        ) : tab === 'single' ? (
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <section className={`${CARD} p-5 sm:p-6`}>
              <SectionHeader title="Place an outbound call" description="The agent calls right away and the call appears in Overview when it ends." />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-[13px] font-medium text-[#33415F] dark:text-slate-300">
                  Contact name
                  <input className={INPUT} value={name} onChange={(event) => setName(event.target.value)} placeholder="Customer name" />
                </label>
                <label className="block text-[13px] font-medium text-[#33415F] dark:text-slate-300">
                  Phone number
                  <input className={INPUT} value={number} onChange={(event) => setNumber(event.target.value)} placeholder="+919876543210" inputMode="tel" />
                  <span className="mt-1 block text-xs font-normal text-[#6B7A99]">Include the country code, for example +91.</span>
                </label>
              </div>
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-[#F4F9FF] p-3.5 text-sm ring-1 ring-sky-100 dark:bg-slate-950 dark:ring-slate-700">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#137EFD]" checked={singleConsent} onChange={(event) => setSingleConsent(event.target.checked)} />
                <span>I confirm this recipient consented to receive this call.</span>
              </label>
              <button onClick={placeCall} disabled={calling || !ready} className={`${BTN} mt-5 h-12 w-full`}>
                {calling ? <Loader2 className="animate-spin" size={18} /> : <PhoneOutgoing size={18} />}
                Start call
              </button>
              {!ready && <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">This agent can’t place outbound calls yet. Choose an outbound agent in the panel above.</p>}
            </section>
            <section className={`${CARD} p-5 sm:p-6`}>
              <SectionHeader title="Call safeguards" description="Limits set by your administrator." />
              <dl className="mt-5 space-y-3">
                {[
                  { icon: Gauge, from: '#137EFD', to: '#5AB8FF', label: 'Daily call limit', value: config?.daily_limit ?? '—' },
                  { icon: Timer, from: '#7732FD', to: '#A779FF', label: 'Longest call', value: config ? `${Math.round(config.max_duration_seconds / 60)} minutes` : '—' },
                  { icon: ShieldCheck, from: '#1FB867', to: '#6FE0A0', label: 'Caller ID', value: config?.did || 'Not assigned' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3 rounded-xl bg-[#F4F9FF] p-3 dark:bg-slate-950">
                    <IconChip icon={row.icon} from={row.from} to={row.to} size="h-9 w-9" iconSize="h-4 w-4" />
                    <div>
                      <dt className="text-[12px] text-[#6B7A99]">{row.label}</dt>
                      <dd className="text-[15px] font-semibold tabular-nums">{row.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        ) : !selectedCampaign ? (
          <div className="space-y-5">
            <SectionHeader title="Campaigns" description="Open a campaign to see each upload and how every call went.">
              <button title="Refresh campaigns" aria-label="Refresh campaigns" onClick={loadBatches} className={`${BTN_SECONDARY} h-10 w-10 px-0`}><RefreshCw size={16} /></button>
              <button onClick={() => setShowCreate((value) => !value)} className={`${BTN} h-10`}><Plus size={17} />{showCreate ? 'Close' : 'New campaign'}</button>
            </SectionHeader>
            {showCreate && (
              <CreateCampaign campaignName={campaignName} setCampaignName={setCampaignName} setFile={setFile} batchConsent={batchConsent} setBatchConsent={setBatchConsent} uploadResult={uploadResult} uploadBatch={uploadBatch} startBatch={startBatch} busy={busy} ready={ready} file={file} />
            )}
            {campaigns.length ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {campaigns.map((campaign) => {
                  const pct = campaign.total ? Math.round((campaign.completed / campaign.total) * 100) : 0;
                  return (
                    <button
                      key={campaign.name}
                      onClick={() => { setSelectedCampaign(campaign.name); setDetails(null); }}
                      className={`${CARD} group p-5 text-left transition hover:ring-[#137EFD]/40 focus-visible:outline-2 focus-visible:outline-[#137EFD]`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <IconChip icon={PhoneOutgoing} from="#137EFD" to="#7732FD" />
                        <StatusBadge value={campaign.status} />
                      </div>
                      <h3 className="mt-4 truncate text-[18px] font-semibold">{campaign.name}</h3>
                      <div className="mt-1 flex items-center gap-1.5 text-[12px] text-[#6B7A99]"><CalendarDays size={14} />Last activity {formatDate(campaign.latest)}</div>
                      <div className="mt-5 flex items-end justify-between">
                        <span className="text-[30px] font-semibold leading-none tabular-nums">{pct}%</span>
                        <span className="text-[12px] text-[#6B7A99]">{campaign.completed.toLocaleString()} of {campaign.total.toLocaleString()} reached</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E6EDF8] dark:bg-slate-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#137EFD] to-[#7732FD]" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <Metric label="Runs" value={campaign.batches.length} />
                        <Metric label="Not connected" value={campaign.failed.toLocaleString()} />
                        <Metric label="Waiting" value={campaign.pending.toLocaleString()} />
                      </div>
                      <span className="mt-4 flex items-center justify-end gap-1 text-[13px] font-semibold text-[#137EFD]">
                        View campaign <ChevronRight size={16} className="transition group-hover:translate-x-0.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={FileSpreadsheet} title="No campaigns yet" text="Upload a contact sheet of people who agreed to be called, and the agent will work through it.">
                <button onClick={() => setShowCreate(true)} className={BTN}><Plus size={16} />New campaign</button>
              </EmptyState>
            )}
          </div>
        ) : (
          <CampaignDetails activeCampaign={activeCampaign} selectedCampaign={selectedCampaign} details={details} setDetails={setDetails} setSelectedCampaign={setSelectedCampaign} openRun={openRun} outcome={outcome} setOutcome={setOutcome} callStatus={callStatus} setCallStatus={setCallStatus} search={search} setSearch={setSearch} page={page} setPage={setPage} busy={busy} exportReport={exportReport} exportCampaign={exportCampaign} cancelBatch={cancelBatch} />
        )}
      </CommsItem>
    </CommsShell>
  );
}

function EmptyState({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text: string; children?: ReactNode }) {
  return (
    <div className={`${CARD} flex flex-col items-center px-6 py-12 text-center`}>
      <IconChip icon={Icon} from="#137EFD" to="#7732FD" size="h-12 w-12" />
      <p className="mt-4 text-[15px] font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-[#6B7A99]">{text}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

type CreateProps = {
  campaignName: string;
  setCampaignName: (v: string) => void;
  setFile: (v: File | null) => void;
  batchConsent: boolean;
  setBatchConsent: (v: boolean) => void;
  uploadResult: BatchUploadResult | null;
  uploadBatch: () => void;
  startBatch: (id: string) => void;
  busy: boolean;
  ready: boolean;
  file: File | null;
};
function CreateCampaign(p: CreateProps) {
  return (
    <section className={`${CARD} p-5 sm:p-6`}>
      <SectionHeader title="Create campaign" description="Name it, upload the contact sheet, then review before any call goes out.">
        <button type="button" onClick={() => void outboundBatchesApi.downloadTemplate()} className={`${BTN_SECONDARY} text-[13px]`}><Download size={15} />Excel template</button>
      </SectionHeader>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="text-[13px] font-medium text-[#33415F] dark:text-slate-300">
          Campaign name
          <input className={INPUT} value={p.campaignName} onChange={(e) => p.setCampaignName(e.target.value)} placeholder="e.g. MBA outbound" maxLength={120} />
        </label>
        <label className="text-[13px] font-medium text-[#33415F] dark:text-slate-300">
          Contact sheet (.csv or .xlsx)
          <span className={`${INPUT} flex cursor-pointer items-center gap-2 focus-within:ring-2 focus-within:ring-[#137EFD]`}>
            <Upload size={16} className="shrink-0 text-[#137EFD]" />
            <span className="truncate text-[#6B7A99]">{p.file ? p.file.name : 'Choose a file'}</span>
            <input type="file" accept=".csv,.xlsx" className="sr-only" onChange={(e) => p.setFile(e.target.files?.[0] || null)} />
          </span>
          <span className="mt-1 block text-xs font-normal text-[#6B7A99]">Name and Phone are required. The example row is skipped.</span>
        </label>
      </div>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-[#F4F9FF] p-3.5 text-sm ring-1 ring-sky-100 dark:bg-slate-950 dark:ring-slate-700">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#137EFD]" checked={p.batchConsent} onChange={(e) => p.setBatchConsent(e.target.checked)} />
        <span>{consentText}</span>
      </label>
      <div className="mt-5 flex justify-end">
        <button onClick={p.uploadBatch} disabled={p.busy || !p.ready || !p.file || !p.batchConsent || !p.campaignName.trim()} className={`${BTN} h-11`}>
          {p.busy ? <Loader2 className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
          Upload and check contacts
        </button>
      </div>
      {p.uploadResult && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#EAF3FF] to-[#F1EBFF] p-4 ring-1 ring-sky-100 dark:from-slate-800 dark:to-slate-800 dark:ring-slate-700">
          <div className="flex items-center gap-3">
            <IconChip icon={CheckCircle2} from="#1FB867" to="#6FE0A0" size="h-10 w-10" />
            <div>
              <strong className="text-[15px]">{p.uploadResult.accepted} contacts ready to call</strong>
              <div className="text-[13px] text-[#6B7A99]">{p.uploadResult.rejected_count} rejected, daily limit {p.uploadResult.daily_limit}</div>
            </div>
          </div>
          <button onClick={() => p.startBatch(p.uploadResult!.id)} disabled={p.busy} className={`${BTN} bg-[#1FB867] shadow-[0_6px_16px_rgba(31,184,103,0.3)] hover:bg-[#18A35A]`}>
            <PhoneOutgoing size={16} />Start campaign
          </button>
        </div>
      )}
    </section>
  );
}

type DetailProps = {
  activeCampaign: CampaignGroup | null;
  selectedCampaign: string;
  details: BatchDetails | null;
  setDetails: (v: BatchDetails | null) => void;
  setSelectedCampaign: (v: string | null) => void;
  openRun: (b: BatchSummary) => void;
  outcome: string;
  setOutcome: (v: string) => void;
  callStatus: string;
  setCallStatus: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  busy: boolean;
  exportReport: () => void;
  exportCampaign: () => void;
  cancelBatch: (id: string) => void;
};
function CampaignDetails(p: DetailProps) {
  const runs = p.activeCampaign?.batches || [];
  return (
    <div className="space-y-5">
      <button onClick={() => { p.setSelectedCampaign(null); p.setDetails(null); }} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#137EFD] hover:underline">
        <ArrowLeft size={16} />All campaigns
      </button>
      <section className={`${CARD} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <IconChip icon={PhoneOutgoing} from="#137EFD" to="#7732FD" size="h-12 w-12" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-[20px] font-semibold">{p.activeCampaign?.name || p.selectedCampaign}</h2>
                <StatusBadge value={p.activeCampaign?.status || 'draft'} />
              </div>
              <p className="text-[13px] text-[#6B7A99]">{runs.length} {runs.length === 1 ? 'run' : 'runs'}, {p.activeCampaign?.total.toLocaleString() || 0} contacts</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Outcome to export" className={`${INPUT} mt-0 w-auto py-2`} value={p.outcome} onChange={(e) => { p.setOutcome(e.target.value); p.setPage(1); }}>
              <option value="">All outcomes</option>
              {OUTCOMES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <button onClick={p.exportCampaign} disabled={p.busy} className={BTN}>
              <Download size={16} />{p.outcome ? `Export ${p.outcome}` : 'Export campaign'}
            </button>
          </div>
        </div>
      </section>
      <SectionHeader title="Runs" description="Each run is one uploaded contact sheet. Open one to see every call." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {runs.map((batch, index) => {
          const active = p.details?.id === batch.id;
          return (
            <button
              key={batch.id}
              onClick={() => p.openRun(batch)}
              aria-pressed={active}
              className={`${CARD} p-4 text-left transition focus-visible:outline-2 focus-visible:outline-[#137EFD] ${active ? 'ring-2 ring-[#137EFD]' : 'hover:ring-[#137EFD]/40'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-[#6B7A99]">Run {runs.length - index}</span>
                <StatusBadge value={batch.status} />
              </div>
              <div className="mt-3 truncate font-semibold" title={batch.filename}>{batch.filename}</div>
              <div className="mt-2 flex items-center justify-between text-[12px] text-[#6B7A99]">
                <span className="flex items-center gap-1.5"><Users size={14} />{batch.total_contacts.toLocaleString()} contacts</span>
                <span>{formatDate(batch.created_at)}</span>
              </div>
            </button>
          );
        })}
      </div>
      {!p.details ? (
        <EmptyState icon={FileSpreadsheet} title="Pick a run" text="Choose a run above to see each contact, how the call went, and its transcript." />
      ) : (
        <RunDetails {...p} details={p.details} />
      )}
    </div>
  );
}

const PIPELINE = [
  { icon: Bot, title: 'Agent prepares', text: 'Builds the greeting and context for each contact, about 15 seconds.' },
  { icon: Phone, title: 'Phone rings', text: 'Calls go out only within the agreed calling hours.' },
  { icon: CheckCircle2, title: 'Outcome saved', text: 'The conversation, sentiment and next step are recorded.' },
];

function RunDetails(p: DetailProps & { details: BatchDetails }) {
  const d = p.details;
  return (
    <section className={`${CARD} min-w-0 overflow-hidden`}>
      {d.status === 'running' && (
        <div className="bg-gradient-to-r from-[#0B1B3F] to-[#1E2F6B] p-5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[14px] font-semibold"><Sparkles size={16} className="text-[#A779FF]" />Calling in progress</span>
            <span className="flex items-center gap-1.5 text-[12px] text-white/70"><Loader2 size={13} className="animate-spin" />Pacing contacts automatically</span>
          </div>
          <ol className="mt-4 grid gap-2.5 sm:grid-cols-3">
            {PIPELINE.map((step, i) => (
              <li key={step.title} className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10">
                <div className="flex items-center gap-2 text-[13px] font-semibold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#137EFD] to-[#7732FD] text-[11px]">{i + 1}</span>
                  <step.icon size={14} className="text-white/80" />{step.title}
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-white/65">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[17px] font-semibold">{d.filename}</h2>
              <StatusBadge value={d.status} />
            </div>
            <p className="mt-1 text-[13px] text-[#6B7A99]">{d.agent_name}, {d.total_contacts.toLocaleString()} contacts</p>
          </div>
          <div className="flex gap-2">
            <button onClick={p.exportReport} disabled={p.busy || !d.report_ready} className={BTN_SECONDARY}>
              <Download size={16} />{p.outcome || p.callStatus ? 'Export filtered CSV' : 'Export CSV'}
            </button>
            {d.status === 'running' && (
              <button onClick={() => p.cancelBatch(d.id)} disabled={p.busy} className={`${BTN} bg-[#ED5173] shadow-[0_6px_16px_rgba(237,81,115,0.3)] hover:bg-[#D9405F]`}>
                <Square size={14} />Stop run
              </button>
            )}
          </div>
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <span className="text-[28px] font-semibold leading-none tabular-nums">{d.progress_percent}%</span>
          <span className="text-[12px] text-[#6B7A99]">{d.completed_contacts.toLocaleString()} of {d.total_contacts.toLocaleString()} processed</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#E6EDF8] dark:bg-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-[#137EFD] to-[#7732FD] transition-[width] duration-500" style={{ width: `${d.progress_percent}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-semibold">
          <span className="rounded-full bg-[#DDF7E8] px-2.5 py-1 text-[#118A4B]">Connected {d.call_status_counts.connected || 0}</span>
          <span className="rounded-full bg-[#FDE4EA] px-2.5 py-1 text-[#C42D52]">Not connected {d.call_status_counts.failed || 0}</span>
        </div>
      </div>
      <div className="grid gap-3 bg-[#F4F9FF] px-5 py-4 sm:grid-cols-3 sm:px-6 dark:bg-slate-950">
        <label className="text-[12px] font-semibold text-[#33415F] dark:text-slate-300">
          Outcome
          <select className={`${INPUT} bg-white`} value={p.outcome} onChange={(e) => { p.setOutcome(e.target.value); p.setPage(1); }}>
            <option value="">All outcomes</option>
            {OUTCOMES.map((v) => <option key={v} value={v}>{v} ({d.outcome_counts[v] || 0})</option>)}
          </select>
        </label>
        <label className="text-[12px] font-semibold text-[#33415F] dark:text-slate-300">
          Call status
          <select className={`${INPUT} bg-white`} value={p.callStatus} onChange={(e) => { p.setCallStatus(e.target.value); p.setPage(1); }}>
            <option value="">All statuses</option>
            {CALL_STATUSES.filter((v) => d.call_status_counts[v]).map((v) => <option key={v} value={v}>{statusLabel(v)} ({d.call_status_counts[v]})</option>)}
          </select>
        </label>
        <label className="text-[12px] font-semibold text-[#33415F] dark:text-slate-300">
          Find contact
          <input className={`${INPUT} bg-white`} value={p.search} onChange={(e) => { p.setSearch(e.target.value); p.setPage(1); }} placeholder="Name or phone" />
        </label>
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[860px] text-left text-[13px]">
          <thead className="text-[12px] text-[#6B7A99]">
            <tr className="border-b border-[#E6EDF8] dark:border-slate-800">
              <th className="px-5 py-3 font-medium">#</th>
              <th className="px-3 py-3 font-medium">Contact</th>
              <th className="px-3 py-3 font-medium">Phone</th>
              <th className="px-3 py-3 font-medium">Call status</th>
              <th className="px-3 py-3 font-medium">Outcome</th>
              <th className="px-3 py-3 font-medium">Conversation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF3FB] dark:divide-slate-800">
            {d.contacts.map((c) => (
              <tr key={c.row_number} className="transition-colors hover:bg-[#F7FAFF] dark:hover:bg-slate-800/50">
                <td className="px-5 py-3 tabular-nums text-[#9AA8C2]">{c.row_number}</td>
                <td className="px-3 py-3 font-semibold">{c.contact_name}</td>
                <td className="px-3 py-3 tabular-nums text-[#55648A] dark:text-slate-300">{c.destination}</td>
                <td className="px-3 py-3"><StatusBadge value={c.call_status || c.status} /></td>
                <td className="px-3 py-3 font-medium">{c.outcome || '—'}</td>
                <td className="px-3 py-3">
                  {c.conversation_id ? <a className="font-semibold text-[#137EFD] hover:underline" href={`/dashboard/conversations/${c.conversation_id}`}>View transcript</a> : <span className="text-[#9AA8C2]">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!d.contacts.length && <div className="p-10 text-center text-[13px] text-[#6B7A99]">No contacts match these filters. Clear a filter to see more.</div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6EDF8] px-5 py-4 text-[13px] dark:border-slate-800">
        <span className="text-[#6B7A99]">{d.filtered_total.toLocaleString()} matching {d.filtered_total === 1 ? 'contact' : 'contacts'}</span>
        <div className="flex items-center gap-2">
          <button disabled={p.page === 1} onClick={() => p.setPage((v) => Math.max(1, v - 1))} className={BTN_SECONDARY}>Previous</button>
          <span className="tabular-nums text-[#55648A]">Page {p.page} of {Math.max(1, Math.ceil(d.filtered_total / d.limit))}</span>
          <button disabled={p.page * d.limit >= d.filtered_total} onClick={() => p.setPage((v) => v + 1)} className={BTN_SECONDARY}>Next</button>
        </div>
      </div>
      {(d.counts.failed || 0) > 0 && (
        <div className="flex items-start gap-2 border-t border-amber-100 bg-amber-50 px-5 py-3 text-[12px] text-amber-800 dark:border-slate-800 dark:bg-amber-950/20 dark:text-amber-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          Filter by “Call not connected” to get a retry list of contacts who didn’t pick up.
        </div>
      )}
    </section>
  );
}
