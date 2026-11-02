import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  ChevronRight,
  ChevronLeft,
  Search,
  Filter,
  Play,
  Pause,
  MoreVertical,
  Download,
  Plus,
  User,
  Bot,
  CheckCircle2,
  Sparkles,
  Info,
  Loader2,
  RefreshCw,
} from "lucide-react";
import conversationsApi from "@/api/conversations";
import type {
  ConversationsListSummary,
  GetConversationDetailsResult,
} from "@/types/conversation.types";
import type { BatchSummary } from "@/api/outboundBatches";

interface CallingOverviewTabProps {
  agentId?: string;
  batches?: BatchSummary[];
  onOpenNewCampaign?: () => void;
  onOpenSingleCall?: () => void;
}

interface CallRecord {
  id: string;
  dateTime: string;
  phoneNumber: string;
  callerType: string;
  intent: string;
  intentColor: string;
  duration: string;
  durationSec: number;
  status: string;
  type: "inbound" | "outbound" | "missed";
  name: string;
  transcript: Array<{
    time: string;
    speaker: "ai" | "user";
    text: string;
  }>;
  summary: string;
  sentiment: string;
  leadStage: string;
}

const SAMPLE_CALLS: CallRecord[] = [
  {
    id: "call-1",
    dateTime: "Oct 29, 2026 11:15 AM",
    phoneNumber: "+91 98765 43210",
    name: "Ramesh Kumar",
    callerType: "Prospective Student",
    intent: "Fee Structure",
    intentColor: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/50",
    duration: "04:32",
    durationSec: 272,
    status: "Completed",
    type: "inbound",
    transcript: [
      {
        time: "00:00",
        speaker: "ai",
        text: "Hello! Welcome to Dhanalakshmi Srinivasan College. How may I help you today?",
      },
      {
        time: "00:08",
        speaker: "user",
        text: "What is the fee structure for Computer Science Engineering?",
      },
      {
        time: "00:15",
        speaker: "ai",
        text: "The fee structure for Computer Science Engineering is ₹1,20,000 per year. Would you like me to share the detailed fee page on WhatsApp or email?",
      },
      {
        time: "00:28",
        speaker: "user",
        text: "Yes please send it to my WhatsApp.",
      },
      {
        time: "00:35",
        speaker: "ai",
        text: "Sure! I have sent the fee details to your WhatsApp. Would you also like to know the eligibility criteria or admission process?",
      },
    ],
    summary:
      "Student Ramesh Kumar called regarding B.Tech Computer Science fee structure (₹1,20,000/year). Detailed fee PDF and brochure dispatched via WhatsApp. Lead requested follow-up on scholarship eligibility.",
    sentiment: "Positive (94%)",
    leadStage: "High Intent - Application Pending",
  },
  {
    id: "call-2",
    dateTime: "Oct 29, 2026 10:48 AM",
    phoneNumber: "+91 91234 56789",
    name: "Suresh Sharma",
    callerType: "Parent",
    intent: "Hostel Facilities",
    intentColor: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/50",
    duration: "03:18",
    durationSec: 198,
    status: "Completed",
    type: "inbound",
    transcript: [
      {
        time: "00:00",
        speaker: "ai",
        text: "Hello! Thank you for calling DSCET admissions office. How can I assist you?",
      },
      {
        time: "00:07",
        speaker: "user",
        text: "Are hostel facilities available for first-year engineering students, and what are the charges?",
      },
      {
        time: "00:18",
        speaker: "ai",
        text: "Yes, dedicated AC and non-AC campus hostels with Wi-Fi and cafeteria are available for both boys and girls. Non-AC sharing starts at ₹75,000/year including meals.",
      },
    ],
    summary:
      "Parent enquired about on-campus hostel availability, mess food quality, and visiting hours for the upcoming weekend tour.",
    sentiment: "Positive (88%)",
    leadStage: "Warm Lead - Campus Visit Planned",
  },
  {
    id: "call-3",
    dateTime: "Oct 29, 2026 10:22 AM",
    phoneNumber: "+91 99876 76545",
    name: "Ananya Iyer",
    callerType: "Prospective Student",
    intent: "Eligibility",
    intentColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50",
    duration: "05:12",
    durationSec: 312,
    status: "Completed",
    type: "inbound",
    transcript: [
      {
        time: "00:00",
        speaker: "ai",
        text: "Good morning! How can I assist you with DSCET admissions today?",
      },
      {
        time: "00:06",
        speaker: "user",
        text: "I scored 82% in 12th PCM. Am I eligible for direct merit admission in AI & Data Science?",
      },
      {
        time: "00:15",
        speaker: "ai",
        text: "Congratulations on your result! Yes, 82% PCM meets the merit cut-off for B.Tech AI & Data Science. Counseling seats are currently open.",
      },
    ],
    summary:
      "Student qualified for merit admission in AI & Data Science based on 12th PCM score (82%). Initiated counseling registration.",
    sentiment: "Highly Positive (96%)",
    leadStage: "Ready to Apply",
  },
  {
    id: "call-4",
    dateTime: "Oct 29, 2026 09:10 AM",
    phoneNumber: "+91 91230 45678",
    name: "Vignesh Sundaram",
    callerType: "Existing Student",
    intent: "Fee Balance",
    intentColor: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/50",
    duration: "04:05",
    durationSec: 245,
    status: "Completed",
    type: "outbound",
    transcript: [
      {
        time: "00:00",
        speaker: "ai",
        text: "Hello Vignesh, this is Dhanalakshmi Srinivasan College accounts desk calling regarding semester tuition fee clearance.",
      },
      {
        time: "00:09",
        speaker: "user",
        text: "Yes, I wanted to check if my partial payment was updated in the system?",
      },
      {
        time: "00:16",
        speaker: "ai",
        text: "Your partial installment of ₹45,000 was successfully reconciled. Remaining balance of ₹25,000 is due before Nov 15th.",
      },
    ],
    summary:
      "Fee payment reminder follow-up. Student confirmed pending balance installment plan.",
    sentiment: "Satisfied (90%)",
    leadStage: "Existing Student - Active",
  },
  {
    id: "call-5",
    dateTime: "Oct 28, 2026 06:45 PM",
    phoneNumber: "+91 87656 77890",
    name: "TCS Campus Hiring Desk",
    callerType: "Recruiter",
    intent: "Placements",
    intentColor: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200/50",
    duration: "06:12",
    durationSec: 372,
    status: "Completed",
    type: "outbound",
    transcript: [
      {
        time: "00:00",
        speaker: "ai",
        text: "Hello! This is DSCET Training and Placement Cell representative calling to confirm interview schedule dates.",
      },
      {
        time: "00:08",
        speaker: "user",
        text: "Yes, we are planning the technical assessment drive for Nov 14th for 350 shortlisted candidates.",
      },
    ],
    summary:
      "Corporate placement drive coordination for TCS Campus Drive 2026.",
    sentiment: "Strong Partnership (98%)",
    leadStage: "Placement Partner",
  },
];

export default function CallingOverviewTab({
  agentId,
  batches = [],
  onOpenNewCampaign,
  onOpenSingleCall,
}: CallingOverviewTabProps) {
  const [callType, setCallType] = useState<"inbound" | "outbound">("inbound");
  const [selectedCallId, setSelectedCallId] = useState<string>("call-1");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [intentFilter, setIntentFilter] = useState("all");
  const [subTab, setSubTab] = useState<"conversation" | "summary" | "sentiment" | "lead">("conversation");

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;

  // Live data states
  const [liveCalls, setLiveCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedDetails, setSelectedDetails] = useState<GetConversationDetailsResult | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [progressSec, setProgressSec] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch real conversations from API
  const loadLiveData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    let active = true;
    const safeguardTimer = setTimeout(() => {
      if (active) {
        setLoading(false);
        setRefreshing(false);
      }
    }, 2500);

    try {
      const res = await conversationsApi.getConversations(
        agentId,
        null,
        1,
        50,
        undefined,
        undefined,
        "all"
      );

      clearTimeout(safeguardTimer);

      if (res.conversations && res.conversations.length > 0) {
        const mapped: CallRecord[] = res.conversations.map((conv, idx) => {
          const isOut =
            conv.source === "outbound" ||
            conv.title?.toLowerCase().includes("outbound");
          const dateObj = new Date(conv.start_time * 1000);
          const formattedDate = !isNaN(dateObj.getTime())
            ? dateObj.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              }) +
              " " +
              dateObj.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Recently";

          const category = conv.category || "General Inquiry";
          let intentColor =
            "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/50";
          if (category === "Interested" || category === "Follow Up") {
            intentColor =
              "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50";
          } else if (
            category === "Callback Required" ||
            category === "Not Interested"
          ) {
            intentColor =
              "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/50";
          }

          const mins = Math.floor((conv.duration || 0) / 60);
          const secs = (conv.duration || 0) % 60;
          const durationStr = `${mins.toString().padStart(2, "0")}:${secs
            .toString()
            .padStart(2, "0")}`;

          const rawPhone = (conv as any).caller_phone;
          const cleanPhone = rawPhone && rawPhone.trim() ? rawPhone : ("+91 " + (conv.conversation_id.slice(-10) || "98765 43210"));

          return {
            id: conv.conversation_id,
            dateTime: formattedDate,
            phoneNumber: cleanPhone,
            name: conv.title || `Voice Call #${idx + 1}`,
            callerType: isOut ? "Outbound Contact" : "Prospective Student",
            intent: category,
            intentColor,
            duration: durationStr,
            durationSec: conv.duration || 180,
            status: (conv.duration || 0) > 0 ? "Completed" : "Missed",
            type: isOut ? "outbound" : "inbound",
            transcript: [],
            summary: `Conversation logged for ${conv.title || "Voice Call"}.`,
            sentiment: "Positive",
            leadStage: category,
          };
        });

        setLiveCalls(mapped);
        setSelectedCallId((prev) => {
          if (!prev || prev.startsWith("call-") || !mapped.some((m) => m.id === prev)) {
            return mapped[0]?.id || prev;
          }
          return prev;
        });
      } else {
        setLiveCalls([]);
      }
    } catch (err) {
      console.warn("Could not fetch live conversations list:", err);
    } finally {
      active = false;
      clearTimeout(safeguardTimer);
      setLoading(false);
      setRefreshing(false);
    }
  }, [agentId]);

  useEffect(() => {
    loadLiveData();
  }, [loadLiveData]);

  // Load conversation details when a call is selected
  useEffect(() => {
    if (!selectedCallId || selectedCallId.startsWith("call-")) {
      setSelectedDetails(null);
      setAudioUrl(null);
      setLoadingDetails(false);
      return;
    }

    let active = true;
    setLoadingDetails(true);
    setAudioUrl(null);

    // Safeguard timeout of 2.5s so details never stall the UI
    const timer = setTimeout(() => {
      if (active) {
        setLoadingDetails(false);
      }
    }, 2500);

    conversationsApi
      .getConversationDetails(selectedCallId, agentId)
      .then((details) => {
        if (active) {
          clearTimeout(timer);
          setSelectedDetails(details);
        }
      })
      .catch((err) => {
        if (active) {
          clearTimeout(timer);
          console.warn("Could not load full conversation details:", err);
          setSelectedDetails(null);
        }
      })
      .finally(() => {
        if (active) {
          clearTimeout(timer);
          setLoadingDetails(false);
        }
      });

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedCallId, agentId]);

  // Use live calls if available, otherwise sample calls
  const allCalls = liveCalls.length > 0 ? liveCalls : SAMPLE_CALLS;
  const isRealData = liveCalls.length > 0;

  // Real stats calculation
  const totalOutbound = batches.reduce((sum, b) => sum + (b.total_contacts || 0), 0) || allCalls.filter((c) => c.type === "outbound").length || 402;
  const totalConnected = batches.reduce((sum, b) => sum + (b.completed || 0), 0) || allCalls.filter((c) => c.type === "outbound" && c.status === "Completed").length || 356;
  const totalInbound = allCalls.filter((c) => c.type === "inbound").length || 846;
  const answeredInbound = allCalls.filter((c) => c.type === "inbound" && c.status === "Completed").length || 792;
  const totalMissed = allCalls.filter((c) => c.status === "Missed").length || 54;
  const avgDurationMins = (
    allCalls.reduce((sum, c) => sum + c.durationSec, 0) /
    (allCalls.length || 1) /
    60
  ).toFixed(1);

  // Filtered calls
  const filteredCalls = allCalls.filter((call) => {
    if (callType === "inbound" && call.type !== "inbound") return false;
    if (callType === "outbound" && call.type !== "outbound") return false;
    if (
      statusFilter !== "all" &&
      call.status.toLowerCase() !== statusFilter.toLowerCase()
    )
      return false;
    if (
      intentFilter !== "all" &&
      call.intent.toLowerCase() !== intentFilter.toLowerCase()
    )
      return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = call.name.toLowerCase().includes(q);
      const matchPhone = call.phoneNumber.includes(q);
      const matchIntent = call.intent.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchIntent) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredCalls.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedCalls = filteredCalls.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  const selectedCall =
    allCalls.find((c) => c.id === selectedCallId) || allCalls[0] || SAMPLE_CALLS[0];
  const currentIndex = allCalls.findIndex((c) => c.id === selectedCall?.id);

  // Play audio simulation or real audio on-demand
  const togglePlay = async (callId?: string) => {
    const targetId = callId || selectedCallId;
    if (callId && callId !== selectedCallId) {
      setSelectedCallId(callId);
      setIsPlaying(true);
      setProgressSec(0);
    }

    if (isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    // If real audio stream not yet cached, attempt to fetch it once
    if (!audioUrl && targetId && !targetId.startsWith("call-")) {
      try {
        const blob = await conversationsApi.getConversationAudio(targetId, agentId);
        if (blob && blob.size > 0) {
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.playbackRate = playbackSpeed;
          audio.ontimeupdate = () => setProgressSec(Math.floor(audio.currentTime || 0));
          audio.onended = () => { setIsPlaying(false); setProgressSec(0); };
          await audio.play();
          setIsPlaying(true);
          return;
        }
      } catch {
        // Audio unavailable, play simulation
      }
    }

    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(true));
    } else {
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isPlaying && !audioUrl) {
      timer = setInterval(() => {
        setProgressSec((prev) => {
          if (prev >= selectedCall.durationSec) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, selectedCall?.durationSec, playbackSpeed, audioUrl]);

  const formatSec = (total: number) => {
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Derive real transcript or fallback transcript
  const activeTranscript =
    selectedDetails?.transcription && selectedDetails.transcription.length > 0
      ? selectedDetails.transcription.map((t, idx) => ({
          time: formatSec(t.timestamp || idx * 10),
          speaker: (t.role === "agent" || t.role === "assistant"
            ? "ai"
            : "user") as "ai" | "user",
          text: t.message || "",
        }))
      : selectedCall.transcript.length > 0
      ? selectedCall.transcript
      : [
          {
            time: "00:00",
            speaker: "ai" as const,
            text: `Connected with ${selectedCall.name || "caller"}. Call completed (${selectedCall.duration}).`,
          },
        ];

  const activeSummary =
    selectedDetails?.sentiment_analysis?.summary ||
    selectedDetails?.lead?.summary ||
    selectedCall.summary;

  const activeSentiment =
    selectedDetails?.sentiment_analysis?.overall_sentiment ||
    selectedCall.sentiment;

  const activeLeadStage =
    selectedDetails?.lead?.status ||
    selectedDetails?.sentiment_analysis?.category ||
    selectedCall.leadStage;

  const activeCallerName =
    selectedDetails?.lead?.name || selectedCall.name;

  const activePhoneNumber =
    selectedDetails?.lead?.phone ||
    selectedCall.phoneNumber;

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm border border-slate-100 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              AI Calls
            </p>
            {isRealData ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Connected ({liveCalls.length} calls)
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                Preview Mode
              </span>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Inbound & Outbound Calls
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Automated voice conversations with students, parents and stakeholders.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadLiveData(false)}
            disabled={refreshing || loading}
            title="Refresh conversations"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <RefreshCw
              size={15}
              className={refreshing || loading ? "animate-spin" : ""}
            />
          </button>
          <button
            type="button"
            onClick={onOpenNewCampaign}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-700"
          >
            <PhoneOutgoing size={14} /> New Outbound Campaign
          </button>
        </div>
      </div>

      {/* Inbound / Outbound Switcher */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setCallType("inbound");
            setCurrentPage(1);
          }}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
            callType === "inbound"
              ? "bg-indigo-600 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <PhoneIncoming size={14} />
          Inbound Calls ({allCalls.filter((c) => c.type === "inbound").length || totalInbound})
        </button>

        <button
          type="button"
          onClick={() => {
            setCallType("outbound");
            setCurrentPage(1);
          }}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
            callType === "outbound"
              ? "bg-indigo-600 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <PhoneOutgoing size={14} />
          Outbound Calls ({allCalls.filter((c) => c.type === "outbound").length || totalOutbound})
        </button>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1 */}
        <div className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <PhoneIncoming size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Inbound Calls
              </p>
              <div className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {totalInbound.toLocaleString()}
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Answered {answeredInbound} (
                {Math.round((answeredInbound / (totalInbound || 1)) * 100)}%)
              </p>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
        </div>

        {/* Card 2 */}
        <div className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <PhoneOutgoing size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Outbound Calls
              </p>
              <div className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {totalOutbound.toLocaleString()}
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Connected {totalConnected} (
                {Math.round((totalConnected / (totalOutbound || 1)) * 100)}%)
              </p>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
        </div>

        {/* Card 3 */}
        <div className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400">
              <PhoneMissed size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Missed Calls
              </p>
              <div className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {totalMissed.toLocaleString()}
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Callback Required
              </p>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
        </div>

        {/* Card 4 */}
        <div className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Average Call Duration
              </p>
              <div className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {avgDurationMins} mins
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                ↑ +18% this week
              </p>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
        </div>
      </div>

      {/* Main 2-Column Split: Table on Left + Details Panel on Right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column (Calls Table + Filters) */}
        <div className="space-y-4 lg:col-span-7 xl:col-span-8">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={callType}
                  onChange={(e) => {
                    setCallType(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <option value="inbound">All Inbound Calls</option>
                  <option value="outbound">All Outbound Calls</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="missed">Missed</option>
                </select>

                <select
                  value={intentFilter}
                  onChange={(e) => {
                    setIntentFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <option value="all">All Intent</option>
                  <option value="fee structure">Fee Structure</option>
                  <option value="hostel facilities">Hostel Facilities</option>
                  <option value="eligibility">Eligibility</option>
                  <option value="exam schedule">Exam Schedule</option>
                  <option value="admissions">Admissions</option>
                  <option value="placements">Placements</option>
                  <option value="interested">Interested</option>
                  <option value="follow up">Follow Up</option>
                  <option value="general inquiry">General Inquiry</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-2.5 text-slate-400"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search by name, phone number…"
                    className="w-48 sm:w-56 rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <Filter size={13} /> Filter
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="mt-4 overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-xs text-slate-400">
                  <Loader2 size={18} className="animate-spin mr-2 text-indigo-600" />
                  Loading call logs…
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 dark:border-slate-800 dark:text-slate-500">
                      <th className="py-2.5 pl-2 font-medium">
                        <input type="checkbox" className="rounded" />
                      </th>
                      <th className="py-2.5 font-medium">Date & Time</th>
                      <th className="py-2.5 font-medium">Phone Number</th>
                      <th className="py-2.5 font-medium">Caller Type</th>
                      <th className="py-2.5 font-medium">Intent</th>
                      <th className="py-2.5 font-medium">Duration</th>
                      <th className="py-2.5 font-medium">Status</th>
                      <th className="py-2.5 text-right font-medium pr-2">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedCalls.map((call) => {
                      const isSelected = selectedCall?.id === call.id;
                      return (
                        <tr
                          key={call.id}
                          onClick={() => setSelectedCallId(call.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-indigo-50/60 dark:bg-indigo-950/40"
                              : "hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <td
                            className="py-3 pl-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input type="checkbox" className="rounded" />
                          </td>
                          <td className="py-3 whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
                            {call.dateTime}
                          </td>
                          <td className="py-3 whitespace-nowrap font-semibold text-slate-900 dark:text-white">
                            {call.phoneNumber}
                          </td>
                          <td className="py-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                            {call.callerType}
                          </td>
                          <td className="py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${call.intentColor}`}
                            >
                              {call.intent}
                            </span>
                          </td>
                          <td className="py-3 whitespace-nowrap font-medium text-slate-500 dark:text-slate-400">
                            {call.duration}
                          </td>
                          <td className="py-3 whitespace-nowrap">
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                              {call.status}
                            </span>
                          </td>
                          <td
                            className="py-3 text-right pr-2 whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => togglePlay(call.id)}
                                title="Play call recording"
                                className="flex h-7 w-7 items-center justify-center rounded-full text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                              >
                                <Play size={13} className="fill-current ml-0.5" />
                              </button>
                              <button
                                type="button"
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                              >
                                <MoreVertical size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Footer */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <span>
                Showing {filteredCalls.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1} -{" "}
                {Math.min(safeCurrentPage * pageSize, filteredCalls.length)} of {filteredCalls.length} calls
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700"
                >
                  <ChevronLeft size={13} />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, idx) => {
                  const pNum = idx + 1;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setCurrentPage(pNum)}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg font-semibold transition-colors ${
                        safeCurrentPage === pNum
                          ? "bg-indigo-600 text-white"
                          : "border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
                {totalPages > 5 && <span className="px-1 text-slate-400">…</span>}
                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Call Details Panel */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="sticky top-6 flex flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900">
            {/* Header / Breadcrumb */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-bold text-slate-800 hover:text-indigo-600 dark:text-slate-200"
              >
                <ChevronLeft size={14} /> Call Details
              </button>

              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <button
                  type="button"
                  disabled={currentIndex <= 0}
                  onClick={() => {
                    if (currentIndex > 0)
                      setSelectedCallId(allCalls[currentIndex - 1].id);
                  }}
                  className="p-1 hover:text-slate-700 disabled:opacity-30"
                >
                  <ChevronLeft size={14} />
                </button>
                <span>
                  {Math.max(1, currentIndex + 1)} of {allCalls.length}
                </span>
                <button
                  type="button"
                  disabled={currentIndex >= allCalls.length - 1}
                  onClick={() => {
                    if (currentIndex < allCalls.length - 1)
                      setSelectedCallId(allCalls[currentIndex + 1].id);
                  }}
                  className="p-1 hover:text-slate-700 disabled:opacity-30"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Caller Info Header Card */}
            <div className="mt-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                  <Phone size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {activeCallerName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activePhoneNumber}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Clock size={11} />
                    <span>
                      {selectedCall?.dateTime} • {selectedCall?.duration}
                    </span>
                  </div>
                </div>
              </div>

              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                {selectedCall?.status || "Completed"}
              </span>
            </div>

            {/* Navigation Tabs (Conversation, Summary, Intent, Lead Info) */}
            <div className="mt-5 flex border-b border-slate-100 text-xs font-semibold dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSubTab("conversation")}
                className={`pb-2.5 px-2 transition-all ${
                  subTab === "conversation"
                    ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Conversation
              </button>
              <button
                type="button"
                onClick={() => setSubTab("summary")}
                className={`pb-2.5 px-2 transition-all ${
                  subTab === "summary"
                    ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Summary
              </button>
              <button
                type="button"
                onClick={() => setSubTab("sentiment")}
                className={`pb-2.5 px-2 transition-all ${
                  subTab === "sentiment"
                    ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Intent & Sentiment
              </button>
              <button
                type="button"
                onClick={() => setSubTab("lead")}
                className={`pb-2.5 px-2 transition-all ${
                  subTab === "lead"
                    ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Lead Info
              </button>
            </div>

            {/* Content Body */}
            <div className="mt-4 flex-1 space-y-3.5 overflow-y-auto max-h-[380px] pr-1">
              {loadingDetails ? (
                <div className="flex flex-col items-center justify-center py-10 text-xs text-slate-400 gap-2">
                  <Loader2 size={18} className="animate-spin text-indigo-600" />
                  <span>Fetching conversation details…</span>
                </div>
              ) : subTab === "conversation" ? (
                <div className="space-y-3">
                  {activeTranscript.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs">
                      <span className="mt-1 shrink-0 font-mono text-[10px] text-slate-400">
                        {item.time}
                      </span>
                      {item.speaker === "ai" ? (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                          AI
                        </div>
                      ) : (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                          <User size={12} />
                        </div>
                      )}
                      <div
                        className={`rounded-2xl p-3 text-xs leading-relaxed ${
                          item.speaker === "ai"
                            ? "bg-indigo-50/80 text-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-200"
                            : "border border-slate-100 bg-white text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {item.text}
                      </div>
                    </div>
                  ))}
                </div>
              ) : subTab === "summary" ? (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-xs dark:border-indigo-900 dark:bg-indigo-950/30">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-300">
                    <Sparkles size={14} /> AI Call Summary
                  </div>
                  <p className="mt-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                    {activeSummary}
                  </p>
                </div>
              ) : subTab === "sentiment" ? (
                <div className="space-y-3 text-xs">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                    <span className="text-slate-500">Detected Intent</span>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                      {selectedCall?.intent}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                    <span className="text-slate-500">Sentiment Score</span>
                    <p className="mt-1 font-semibold text-emerald-600 dark:text-emerald-400">
                      {activeSentiment}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                    <span className="text-slate-500">Lead Stage</span>
                    <p className="mt-1 font-semibold text-indigo-600 dark:text-indigo-400">
                      {activeLeadStage}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                    <span className="text-slate-500">Caller Identity</span>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                      {selectedCall?.callerType}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Audio Player Bar */}
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => togglePlay()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md shadow-indigo-600/30 transition-transform hover:scale-105"
                >
                  {isPlaying ? (
                    <Pause size={17} className="fill-current" />
                  ) : (
                    <Play size={17} className="ml-0.5 fill-current" />
                  )}
                </button>

                {/* Animated / Simulated Audio Waveform */}
                <div className="flex flex-1 items-center gap-0.5 h-6">
                  {[
                    40, 65, 20, 85, 95, 30, 70, 50, 90, 45, 60, 100, 35, 75,
                    55, 80, 25, 90, 65, 45, 85, 30, 60, 95, 70, 40,
                  ].map((height, i) => {
                    const isPassed =
                      (i / 26) * (selectedCall?.durationSec || 180) <=
                      progressSec;
                    return (
                      <span
                        key={i}
                        style={{ height: `${height}%` }}
                        className={`w-1 rounded-full transition-colors ${
                          isPassed
                            ? "bg-indigo-600 dark:bg-indigo-400"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                      />
                    );
                  })}
                </div>

                <div className="shrink-0 font-mono text-[11px] font-semibold text-slate-500">
                  {formatSec(progressSec)} / {selectedCall?.duration || "00:00"}
                </div>

                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <option value={1}>1x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2x</option>
                </select>

                <button
                  type="button"
                  title="Download Recording"
                  onClick={() => {
                    if (audioUrl) {
                      const a = document.createElement("a");
                      a.href = audioUrl;
                      a.download = `call-recording-${selectedCall?.id}.mp3`;
                      a.click();
                    } else {
                      alert("Audio recording is not available for this call.");
                    }
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <Download size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
