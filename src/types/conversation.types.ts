/* =============================
   CONVERSATIONS LIST TYPES
============================= */

export interface ConversationsListSummary {
  conversation_id: string;
  title: string;
  duration: number;
  message_count: number;
  call_status: string | boolean;
  start_time: number;
  end_time: number;
  time_format: string
  source?: string | null;
  /** v3 only: outbound when we placed the call. */
  direction?: "inbound" | "outbound";
  caller_phone?: string | null;
  category?: "Follow Up" | "Interested" | "General Inquiry" | "Not Interested" | "Callback Required" | "Not Assessable";
  /** null when the person said too little to judge, or the conversation is not analysed yet. */
  sentiment?: "positive" | "neutral" | "negative" | null;
  emotion?: "happy" | "calm" | "confused" | "frustrated" | "angry" | "sad" | null;
  topic?: string | null;
  urgent?: boolean;
  /** AI team members who replied to the caller, in order. */
  team?: TeamMember[];
  analysed?: boolean;
  /** Only present when the list is requested with include_contact. */
  contact_name?: string | null;
}

export interface GetConversationsResponse {
  status: string;
  data: ConversationsListSummary[];
  next_page: string | null;
  pagination?: {
    total_count: number;
    current_page: number;
    total_pages: number;
    limit: number;
    next_page?: string | number | null;
  };
}

/** One member of a multi-agent "AI team" (e.g. About Us, Courses, Admissions, Placements). */
export interface TeamMember {
  key: string;
  label: string;
}

export interface GetConversationsListResult {
  conversations: ConversationsListSummary[];
  nextPage: string | null;
  /** How many matching conversations each AI team member answered; empty for a single bot. */
  team?: (TeamMember & { count: number })[];
  pagination?: {
    total: number;
    page: number;
    pages: number;
    limit: number;
  };
}

/* =============================
   CONVERSATION DETAILS
============================= */

export interface ConversationDetailsSummary {
  role: "agent" | "user" | "assistant";
  message: string | null;
  avatar: string | null;
  timestamp: number;
  interrupted: boolean;
}

export interface LeadDetails {
  name?: string;
  email?: string;
  phone_number?: string;
  phone?: string;
  mobile?: string;
  business_desc?: string;
  business_description?: string;
  summary?: string;
  status?: string;
  direction?: "inbound" | "outbound";
}

export interface GetConversationDetailsResponse {
  status: string;
  data: ConversationDetailsSummary[];
  lead: LeadDetails | null;
  start_time: number;
  end_time: number;
  duration: number;
  source?: string | null;
  category?: ConversationsListSummary["category"];
  sentiment_analysis?: SentimentAnalysis | null;
}

export interface SentimentAnalysis {
  // The bucket the model chose. The top-level `category` is what the UI shows;
  // this is the raw value it was resolved from.
  category?: ConversationsListSummary["category"];
  overall_sentiment?: string;
  interest_level?: string;
  intent?: string;
  primary_interest?: string;
  main_consideration?: string;
  objection_level?: string;
  follow_up_readiness?: string;
  summary?: string;
  key_data?: string[];
  recommended_action?: string;
  // Version 5 fixed-vocabulary signals (the same values the dashboard counts).
  sentiment?: "positive" | "neutral" | "negative" | null;
  emotion?: "happy" | "calm" | "confused" | "frustrated" | "angry" | "sad" | null;
  topic?: string | null;
  urgency?: "high" | "normal" | null;
}

export interface GetConversationDetailsResult {
  transcription: ConversationDetailsSummary[];
  lead: LeadDetails | null;
  start_time: string;
  end_time: string;
  duration: number;
  source?: string | null;
  category?: ConversationsListSummary["category"];
  sentiment_analysis?: SentimentAnalysis | null;
}

/* =============================
   KPI SUMMARY (CARDS)
============================= */

export interface KpiSummary {
  total_conversations: number;
  total_messages: number;

  total_cost_usd: number;
  avg_cost_per_conversation_usd: number;

  total_call_duration_secs: number;
  avg_call_duration_secs: number;
}

/* =============================
   KPI TIMESERIES (GRAPHS)
============================= */

export interface KpiTimeseriesPoint {
  date: string; // YYYY-MM-DD
  conversations: number;
  messages: number;
  cost_usd: number;
  total_call_duration_secs: number;
  avg_call_duration_secs: number;
  leads_captured?: number;
}

/* =============================
   KPI API RESPONSE
============================= */

export interface GetKpisResult {
  summary: KpiSummary;
  timeseries: KpiTimeseriesPoint[];
}
