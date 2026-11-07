// Shapes returned by GET /v3/kpis/insights and /v3/kpis/insights/summary.
// Every figure is aggregated server-side from each conversation's stored analysis.

export type SentimentKey = "positive" | "neutral" | "negative";
export type EmotionKey = "happy" | "calm" | "confused" | "frustrated" | "angry" | "sad";
export type ActionKind = "callback" | "follow_up" | "review" | "update_info" | "other";

export interface CountPct {
  count: number;
  pct: number;
}

export interface InsightsTimeseriesPoint {
  date: string; // YYYY-MM-DD (IST)
  total: number;
  analysed: number;
  positive: number;
  neutral: number;
  negative: number;
  urgent: number;
  assessable: number;
  recognized: number;
}

export interface InsightsResponse {
  range: { start: string | null; end: string | null; source: string };
  totals: {
    conversations: number;
    analysed: number;
    /** Has a transcript but the background worker has not analysed it yet. */
    pending: number;
    no_transcript: number;
    /** Analysed, but the person said too little to judge. */
    not_assessable: number;
    assessable: number;
  };
  sentiment: { scored: number } & Record<SentimentKey, CountPct>;
  intent_recognized: CountPct;
  urgent: { count: number };
  emotions: ({ key: EmotionKey } & CountPct)[];
  topics: ({ label: string } & CountPct)[];
  categories: Record<string, number>;
  channels: ({ key: string; label: string } & CountPct)[];
  escalations: {
    urgent_by_topic: { label: string; count: number }[];
    callback_requested: number;
    leads: number;
    negative: number;
  };
  timeseries: InsightsTimeseriesPoint[];
  previous: {
    conversations: number;
    sentiment_scored: number;
    sentiment_pct: Record<SentimentKey, number>;
    intent_recognized_pct: number;
    assessable: number;
    urgent: number;
  } | null;
}

export interface InsightsSummaryResponse {
  summary: string;
  actions: { label: string; kind: ActionKind }[];
  source: "ai" | "rules";
  generated_at: string;
}

/** GET /v3/kpis/calls: phone call figures for the Calling tab. */
export interface CallStatsResponse {
  range: { start: string | null; end: string | null };
  inbound: { total: number; answered: number; missed: number; answered_pct: number };
  outbound: { dialled: number; connected: number; connected_pct: number };
  total_call_secs: number;
  avg_call_secs: number;
  connected_calls: number;
}
