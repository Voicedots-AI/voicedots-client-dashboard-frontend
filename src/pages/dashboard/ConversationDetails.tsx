import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  User,
  Phone,
  Mail,
  Briefcase,
  AlertCircle,
  FileText,
  Clock,
  PhoneCall,
  Sparkles,
  Tag,
  X,
  Globe2,
  Info,
} from "lucide-react";
import conversationsApi from "@/api/conversations";
import type { GetConversationDetailsResult, LeadDetails, SentimentAnalysis } from "@/types/conversation.types";
import { ConversationAudioPlayer } from "@/components/ConversationAudioPlayer";
import { useAuth } from "@/context/AuthContext";
import {outboundCallsApi,type OutboundAgent,type OutboundCallStatus} from "@/api/outboundCalls";
import {OutboundCallTracker} from "@/components/calling/OutboundCallTracker";
import { BTN, BTN_SECONDARY, CARD, CommsShell, HeroButton, IconChip, INPUT } from "@/components/comms/CommsKit";

const logoIcon = "/voicedotslogo.svg";

const formatTime = (timestamp?: number) => {
  if (!timestamp) return "";
  const date = new Date(timestamp > 1e10 ? timestamp : timestamp * 1000);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const capitalise = (value?: string | null) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : "");

const formatDuration = (duration?: number) =>
  typeof duration === "number" ? `${Math.floor(duration / 60)}m ${duration % 60}s` : "Unknown length";

const CATEGORY_CHIP: Record<string, string> = {
  "Follow Up": "bg-[#E3EEFF] text-[#0F5FC4]",
  Interested: "bg-[#DDF7E8] text-[#118A4B]",
  "General Inquiry": "bg-[#EFE7FF] text-[#5B21D6]",
  "Not Interested": "bg-[#FDE4EA] text-[#C42D52]",
  "Callback Required": "bg-[#FFF1D6] text-[#A86A00]",
  "Not Assessable": "bg-[#EEF3FB] text-[#55648A]",
};

export function ConversationDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<GetConversationDetailsResult | null>(null);
  const [showMobileInfo, setShowMobileInfo] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [outboundAgents,setOutboundAgents]=useState<OutboundAgent[]>([]);
  const [showCall,setShowCall]=useState(false);
  const [callNumber,setCallNumber]=useState("");
  const [consent,setConsent]=useState(false);
  const [callStatus,setCallStatus]=useState("");
  const [calling,setCalling]=useState(false);
  const [activeCall,setActiveCall]=useState<OutboundCallStatus|null>(null);

  useEffect(() => {
    if (!activeCall || ['connected', 'failed', 'blocked'].includes(activeCall.status)) return;
    const timer = window.setInterval(() => {
      outboundCallsApi.status(activeCall.id).then(setActiveCall).catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [activeCall]);

  useEffect(() => {
    async function fetchConversationDetails() {
      try {
        setIsLoading(true);
        if (id) {
          const response = await conversationsApi.getConversationDetails(id, user?.agent_id);
          setData(response);
          const audioBlob = await conversationsApi.getConversationAudio(id, user?.agent_id);
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
        }
      } finally {
        setIsLoading(false);
      }
    }
    fetchConversationDetails();
    outboundCallsApi.list().then(setOutboundAgents).catch(()=>setOutboundAgents([]));
  }, [id, user?.agent_id]);


  const lead = data?.lead;
  const messages = data?.transcription;
  const outboundAgent=outboundAgents[0];
  const outboundReady=!!outboundAgent&&outboundAgent.platform_enabled&&outboundAgent.enabled&&outboundAgent.status==='active'&&!!outboundAgent.outbound_trunk_id;
  const leadPhone = lead?.mobile || lead?.phone || lead?.phone_number || "";
  const hasPhone = !!leadPhone;
  // Website conversations have no phone call to follow up on — hide the
  // call button and the phone-lead sidebar. Falls back to showing when the
  // source is unknown (e.g. direct URL) to stay backward compatible.
  const stateSource = (location.state as { source?: string | null } | null)?.source;
  const dataSource = (data as { source?: string | null } | null)?.source;
  const source = stateSource || dataSource;
  const isWebsite = source !== undefined && source !== null && source !== "phone_call" && source !== "phone";
  const showLeadInfo = hasPhone && !isWebsite;
  const openCall=()=>{setCallNumber(leadPhone);setCallStatus('');setActiveCall(null);setConsent(false);setShowCall(true)};
  const placeCall=async()=>{if(!id||!outboundAgent)return;setCalling(true);setCallStatus('');try{const result=await outboundCallsApi.create({phone_agent_id:outboundAgent.id,destination:callNumber,contact_name:lead?.name||'DSCET enquiry',consent_confirmed:consent,conversation_id:id});setActiveCall({id:result.id,status:'queued',contact_name:lead?.name||'DSCET enquiry',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),user_message:result.user_message});setCallStatus(`Call queued successfully (${result.id}).`)}catch(e:any){const d=e.response?.data?.detail;setCallStatus(typeof d==='string'?d:d?.reasons?.join(' · ')||d?.message||'Unable to place the call.')}finally{setCalling(false)}};

  const category = data?.category || "Not Assessable";
  const title = lead?.name || (isWebsite ? "Website chat" : "Conversation");
  const SourceIcon = isWebsite ? Globe2 : Phone;
  const info = <LeadInfo lead={lead} duration={data?.duration} sentiment={data?.sentiment_analysis} category={category} showContact={showLeadInfo} />;

  return (
    <CommsShell>
      {/* SUMMARY HEADER */}
      <section className="relative overflow-hidden rounded-[28px] px-5 py-5 text-white shadow-[0_18px_40px_rgba(11,27,63,0.22)] sm:px-7 sm:py-6" style={{ background: "radial-gradient(120% 140% at 100% 0%, rgba(51,176,230,0.32), transparent 55%), linear-gradient(135deg, #0B1B3F 0%, #13295C 100%)" }}>
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium text-white/70 transition hover:text-white focus-visible:outline-2 focus-visible:outline-white">
            <ArrowLeft size={16} />
            All conversations
          </button>
          {!isLoading && (
            <button onClick={() => setShowMobileInfo(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-semibold ring-1 ring-white/15 md:hidden">
              <Info size={14} />
              Details
            </button>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#137EFD] to-[#33B0E6] shadow-[0_10px_22px_rgba(51,176,230,0.32)]">
              <SourceIcon className="h-6 w-6" strokeWidth={2.1} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[24px] font-semibold leading-tight sm:text-[28px]">{isLoading ? "Loading conversation…" : title}</h1>
              {!isLoading && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-white/75">
                  <span className="inline-flex items-center gap-1.5"><SourceIcon size={13} />{isWebsite ? "Website chat" : "Phone call"}</span>
                  <span className="inline-flex items-center gap-1.5"><Clock size={13} />{formatDuration(data?.duration)}</span>
                  {leadPhone && !isWebsite && <span className="tabular-nums">{leadPhone}</span>}
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${CATEGORY_CHIP[category] || CATEGORY_CHIP["Not Assessable"]}`}>{category}</span>
                </div>
              )}
            </div>
          </div>
          {showLeadInfo && (
            <HeroButton primary onClick={openCall} disabled={!outboundReady} title={outboundReady ? "Call this lead using this conversation as context" : "Outbound follow-up is not enabled"}>
              <PhoneCall size={16} />
              Call this lead
            </HeroButton>
          )}
        </div>
      </section>

      {/* RECORDING */}
      <div className={`${CARD} flex flex-col gap-1 px-4 pb-4 pt-3.5 sm:px-5`}>
        <p className="text-[13px] font-semibold text-[#0B1B3F] dark:text-white">Recording</p>
        <ConversationAudioPlayer startTime={data?.start_time} endTime={data?.end_time} audioUrl={audioUrl} />
      </div>

      {/* BODY */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* TRANSCRIPT */}
        <section className={`${CARD} min-w-0 px-4 py-5 sm:px-6`} aria-label="Transcript">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-[17px] font-semibold text-[#0B1B3F] dark:text-white">Transcript</h2>
            {!isLoading && <span className="text-[12px] text-[#6B7A99]">{messages?.filter((m) => m.message).length || 0} messages</span>}
          </div>
          <div className="mx-auto max-w-3xl space-y-5">
            <div className="flex justify-center">
              <span className="rounded-full bg-[#F4F9FF] px-3 py-1 text-[11px] font-medium text-[#6B7A99] ring-1 ring-sky-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                Conversation start
              </span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#6B7A99]">
                <Loader2 className="animate-spin text-[#137EFD]" size={18} />
                Loading transcript…
              </div>
            ) : !messages?.some((m) => m.message) ? (
              <p className="py-14 text-center text-[13px] text-[#6B7A99]">No transcript was saved for this conversation.</p>
            ) : (
              messages?.map((msg, i) => {
                const isAgent = msg.role === "agent" || msg.role === "assistant";
                if (!msg.message) return null;

                return (
                  <div key={i} className={`flex gap-3 ${isAgent ? "flex-row" : "flex-row-reverse"}`}>
                    {isAgent ? (
                      <img src={logoIcon} alt="" className="h-9 w-9 shrink-0 rounded-full bg-white p-1 ring-1 ring-sky-100 dark:ring-slate-700" />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7732FD] to-[#A779FF] text-white">
                        <User size={16} />
                      </div>
                    )}

                    <div className={`flex max-w-[80%] flex-col ${isAgent ? "items-start" : "items-end"}`}>
                      <div className="mb-1 text-[11px] text-[#6B7A99] dark:text-slate-400">
                        {isAgent ? "SRK" : lead?.name || "Caller"}, {formatTime(msg.timestamp)}
                      </div>

                      <div
                        className={`rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
                          isAgent
                            ? "rounded-tl-md bg-[#F4F9FF] text-[#0B1B3F] ring-1 ring-sky-100 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
                            : "rounded-tr-md bg-gradient-to-br from-[#137EFD] to-[#3A95FF] text-white shadow-[0_6px_16px_rgba(19,126,253,0.22)]"
                        }`}
                      >
                        {msg.message}

                        {msg.interrupted && (
                          <div className={`mt-1 flex items-center gap-1 text-[11px] ${isAgent ? "text-[#C42D52]" : "text-white/80"}`}>
                            <AlertCircle size={12} />
                            Interrupted
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* DESKTOP SIDEBAR */}
        {!isLoading && (
          <aside className="hidden md:block">
            <div className="sticky top-20 max-h-[calc(100vh-96px)] overflow-y-auto pb-2 custom-scrollbar">{info}</div>
          </aside>
        )}
      </div>

      {/* MOBILE BOTTOM SHEET */}
      {showMobileInfo && (
        <div className="fixed inset-0 z-50 bg-[#0B1B3F]/50 md:hidden" onClick={() => setShowMobileInfo(false)}>
          <div className="absolute bottom-0 max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-[#F4F9FF] p-4 dark:bg-slate-900" style={{ fontFamily: "Poppins, Manrope, sans-serif" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-[#0B1B3F] dark:text-slate-100">Conversation details</h3>
              <button aria-label="Close details" onClick={() => setShowMobileInfo(false)} className="rounded-lg p-1 text-[#6B7A99]"><X /></button>
            </div>
            {info}
          </div>
        </div>
      )}

      {/* FOLLOW-UP CALL DIALOG */}
      {showCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1B3F]/55 p-4" role="dialog" aria-modal="true" aria-labelledby="follow-up-title">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-[0_24px_60px_rgba(11,27,63,0.35)] dark:bg-slate-900" style={{ fontFamily: "Poppins, Manrope, sans-serif" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <IconChip icon={PhoneCall} from="#137EFD" to="#7732FD" />
                <div>
                  <h2 id="follow-up-title" className="text-[19px] font-semibold text-[#0B1B3F] dark:text-slate-100">Follow-up call</h2>
                  <p className="mt-1 text-[13px] text-[#6B7A99]">The follow-up agent gets a secure summary and the recent turns of this conversation.</p>
                </div>
              </div>
              <button aria-label="Close" onClick={() => setShowCall(false)} className="rounded-lg p-1 text-[#6B7A99] hover:text-[#0B1B3F]"><X /></button>
            </div>
            {activeCall ? (
              <div className="mt-5 space-y-4">
                <OutboundCallTracker call={activeCall} contactName={lead?.name || 'DSCET enquiry'} destination={callNumber} />
                <button onClick={() => { setActiveCall(null); setCallStatus(''); }} className={`${BTN_SECONDARY} w-full`}>Back to the form</button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <label className="block text-[13px] font-medium text-[#33415F] dark:text-slate-200">
                  Contact
                  <input value={lead?.name || 'DSCET enquiry'} readOnly className={`${INPUT} cursor-default opacity-80`} />
                </label>
                <label className="block text-[13px] font-medium text-[#33415F] dark:text-slate-200">
                  Phone number
                  <input value={callNumber} onChange={e => setCallNumber(e.target.value)} placeholder="+919876543210" inputMode="tel" className={INPUT} />
                  <span className="mt-1 block text-xs font-normal text-[#6B7A99]">Check the number and include its country code.</span>
                </label>
                <div className="rounded-xl bg-[#EAF3FF] p-3.5 text-[13px] leading-relaxed text-[#0F3E80] dark:bg-blue-950/30 dark:text-blue-200">
                  <strong>Shared with the agent:</strong> the lead’s name and summary, plus up to the last 20 transcript turns. Audio and other conversations are never sent.
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#F4F9FF] p-3.5 text-sm ring-1 ring-sky-100 dark:bg-slate-950 dark:ring-slate-700 dark:text-slate-200">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#137EFD]" checked={consent} onChange={e => setConsent(e.target.checked)} />
                  <span>I confirm this person consented to this follow-up call.</span>
                </label>
                {callStatus && <p role="status" className="rounded-xl bg-[#EEF3FB] p-3 text-[13px] text-[#33415F] dark:bg-slate-800 dark:text-slate-200">{callStatus}</p>}
                <button onClick={placeCall} disabled={calling || !consent || !callNumber} className={`${BTN} h-12 w-full`}>
                  {calling ? <Loader2 className="animate-spin" size={18} /> : <PhoneCall size={18} />}
                  Place follow-up call
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </CommsShell>
  );
}

/* ========== SHARED LEAD INFO ========== */

function LeadInfo({ lead, duration, sentiment, category, showContact }: { lead?: LeadDetails | null; duration?: number; sentiment?: SentimentAnalysis | null; category: string; showContact: boolean }) {
  return (
    <div className="space-y-4">
      {showContact && (
        <section className={`${CARD} overflow-hidden`}>
          <div className="flex items-center gap-3 border-b border-[#E6EDF8] px-4 py-3.5 dark:border-slate-800">
            <IconChip icon={User} from="#7732FD" to="#A779FF" size="h-10 w-10" iconSize="h-4 w-4" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-[#0B1B3F] dark:text-slate-100">{lead?.name || "Unknown caller"}</p>
              <p className="text-[12px] text-[#6B7A99]">{lead?.direction === "outbound" ? "Outbound call" : "Inbound call"}</p>
            </div>
          </div>
          <div className="py-1.5">
            <InfoRow icon={<Phone size={14} />} label="Phone" value={lead?.mobile || lead?.phone || lead?.phone_number || "Not shared"} />
            <InfoRow icon={<Mail size={14} />} label="Email" value={lead?.email || "Not shared"} />
            <InfoRow icon={<Briefcase size={14} />} label="About" value={lead?.business_description || lead?.business_desc || lead?.summary || "Not shared"} />
          </div>
        </section>
      )}

      <section className={`${CARD} p-4`}>
        <CardTitle icon={FileText} from="#137EFD" to="#5AB8FF">Call summary</CardTitle>
        <div className="mt-3 space-y-2.5">
          <SummaryRow icon={<Clock size={14} />} label="Length" value={formatDuration(duration)} />
          <SummaryRow icon={<Tag size={14} />} label="Category" value={<span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${CATEGORY_CHIP[category] || CATEGORY_CHIP["Not Assessable"]}`}>{category}</span>} />
        </div>
      </section>

      <section className={`${CARD} p-4`}>
        <CardTitle icon={Sparkles} from="#1FB867" to="#6FE0A0">Sentiment</CardTitle>
        {sentiment ? (
          <div className="mt-3 space-y-2.5">
            <SummaryRow label="Overall" value={capitalise(sentiment.sentiment) || sentiment.overall_sentiment || "Unknown"} />
            {sentiment.emotion && <SummaryRow label="Emotion" value={capitalise(sentiment.emotion)} />}
            {sentiment.topic && <SummaryRow label="Topic" value={sentiment.topic} />}
            {sentiment.urgency && (
              <SummaryRow
                label="Urgency"
                value={sentiment.urgency === "high"
                  ? <span className="rounded-full bg-[#FDE4EA] px-2.5 py-0.5 text-[11px] font-semibold text-[#C42D52] dark:bg-rose-950/50 dark:text-rose-300">High</span>
                  : "Normal"}
              />
            )}
            <SummaryRow label="Interest" value={sentiment.interest_level || "Unknown"} />
            <SummaryRow label="Intent" value={sentiment.intent || "Unknown"} />
            {sentiment.summary && <p className="pt-1 text-[13px] leading-relaxed text-[#33415F] dark:text-slate-300">{sentiment.summary}</p>}
            {sentiment.recommended_action && (
              <div className="rounded-xl bg-[#DDF7E8]/70 p-3 text-[13px] leading-relaxed text-[#0E5A33] dark:bg-emerald-950/30 dark:text-emerald-200">
                <strong>Next step:</strong> {sentiment.recommended_action}
              </div>
            )}
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-[#6B7A99]">No sentiment analysis was produced for this conversation.</p>
        )}
      </section>
    </div>
  );
}

/* HELPERS */
function CardTitle({ icon, from, to, children }: { icon: typeof FileText; from: string; to: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <IconChip icon={icon} from={from} to={to} size="h-8 w-8" iconSize="h-4 w-4" />
      <h3 className="text-[14px] font-semibold text-[#0B1B3F] dark:text-slate-100">{children}</h3>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3 px-4 py-2">
      <div className="mt-0.5 shrink-0 text-[#9AA8C2]">{icon}</div>
      <div className="w-full min-w-0">
        <p className="text-[11px] text-[#6B7A99] dark:text-slate-400">{label}</p>
        <p className="break-words text-[13px] font-medium text-[#0B1B3F] dark:text-slate-200">{value}</p>
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon?: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="flex items-center gap-2 text-[#6B7A99] dark:text-slate-400">
        {icon} {label}
      </span>
      <span className="text-right font-medium capitalize text-[#0B1B3F] dark:text-slate-200">{value}</span>
    </div>
  );
}
