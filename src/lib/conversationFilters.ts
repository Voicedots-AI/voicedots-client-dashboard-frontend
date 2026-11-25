// The Conversations list filters, kept in the page URL so a Home dashboard
// figure can link straight to the conversations it counted, and so a filtered
// list survives a refresh, the back button and being shared.
//
// The drill-down keys are the backend's own query params on GET /v3/conversations;
// the backend applies the exact rules the dashboard counted with.

import type { EmotionKey, SentimentKey } from "@/types/insights.types";

export const CONVERSATIONS_PATH = "/dashboard/conversations";

export type AnalysisState = "analysed" | "assessable" | "not_assessable" | "pending" | "no_transcript";

/** Filters that narrow to what one dashboard figure counted. */
export interface DrilldownFilters {
  sentiment?: SentimentKey;
  emotion?: EmotionKey;
  topic?: string;
  urgent?: boolean;
  intent_recognized?: boolean;
  analysis_state?: AnalysisState;
  /** A Channels card group: website_chat, website_voice, telephone, whatsapp, other. */
  channel?: string;
  /** One category, or several comma-separated. */
  category?: string;
  /** AI team member who answered (persona key), or "none" for no reply. */
  persona?: string;
}

export interface ConversationQuery extends DrilldownFilters {
  start_date?: string;
  end_date?: string;
  /** Channel tab: all, web_voice or phone_call. */
  source?: string;
  search?: string;
}

const BOOLEAN_KEYS = ["urgent", "intent_recognized"] as const;
const STRING_KEYS = [
  "start_date", "end_date", "source", "search",
  "sentiment", "emotion", "topic", "analysis_state", "channel", "category", "persona",
] as const;

/** Home's "Website" filter is web_call; the list's tab for the same sources is web_voice. */
export const normaliseSource = (source?: string | null) =>
  source === "web_call" ? "web_voice" : source && source !== "all" ? source : undefined;

export function readConversationQuery(params: URLSearchParams): ConversationQuery {
  const query: ConversationQuery = {};
  for (const key of STRING_KEYS) {
    const value = params.get(key);
    if (value) (query as Record<string, string>)[key] = value;
  }
  for (const key of BOOLEAN_KEYS) {
    const value = params.get(key);
    if (value === "true" || value === "false") query[key] = value === "true";
  }
  query.source = normaliseSource(query.source);
  return query;
}

export function toSearchParams(query: ConversationQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of [...STRING_KEYS, ...BOOLEAN_KEYS]) {
    const value = query[key];
    if (value === undefined || value === "" || value === null) continue;
    if (key === "source" && value === "all") continue;
    params.set(key, String(value));
  }
  return params;
}

export function conversationsHref(query: ConversationQuery): string {
  const params = toSearchParams({ ...query, source: normaliseSource(query.source) });
  const qs = params.toString();
  return qs ? `${CONVERSATIONS_PATH}?${qs}` : CONVERSATIONS_PATH;
}

/** The drill-down part only, as the API call takes it. */
export function drilldownOf(query: ConversationQuery): DrilldownFilters {
  const { sentiment, emotion, topic, urgent, intent_recognized, analysis_state, channel, persona } = query;
  return { sentiment, emotion, topic, urgent, intent_recognized, analysis_state, channel, persona };
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const STATE_LABEL: Record<AnalysisState, string> = {
  analysed: "Analysed",
  assessable: "Analysed, with enough speech to judge",
  not_assessable: "Not assessable (too little speech)",
  pending: "Waiting for analysis",
  no_transcript: "No transcript",
};

const CHANNEL_LABEL: Record<string, string> = {
  website_chat: "Website Chat",
  website_voice: "Website Voice",
  telephone: "Telephone",
  whatsapp: "WhatsApp",
  other: "Other",
};

/** One removable chip per active drill-down filter, in reading order. */
export function drilldownChips(query: ConversationQuery): { key: keyof DrilldownFilters; label: string }[] {
  const chips: { key: keyof DrilldownFilters; label: string }[] = [];
  if (query.sentiment) chips.push({ key: "sentiment", label: `Sentiment: ${capital(query.sentiment)}` });
  if (query.emotion) chips.push({ key: "emotion", label: `Emotion: ${capital(query.emotion)}` });
  if (query.topic) chips.push({ key: "topic", label: `Intent: ${query.topic}` });
  if (query.intent_recognized !== undefined)
    chips.push({ key: "intent_recognized", label: query.intent_recognized ? "Intent recognised" : "Intent not recognised" });
  if (query.urgent !== undefined) chips.push({ key: "urgent", label: query.urgent ? "Urgent" : "Not urgent" });
  if (query.analysis_state) chips.push({ key: "analysis_state", label: STATE_LABEL[query.analysis_state] ?? query.analysis_state });
  if (query.channel) chips.push({ key: "channel", label: `Channel: ${CHANNEL_LABEL[query.channel] ?? query.channel}` });
  return chips;
}
