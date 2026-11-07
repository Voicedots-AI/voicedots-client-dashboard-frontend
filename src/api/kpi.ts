import { apiClient } from './apiClient';
import type { GetKpisResult, KpiSummary } from "@/types/conversation.types";
import type { CallStatsResponse, InsightsResponse, InsightsSummaryResponse } from "@/types/insights.types";


// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getApiVersion = (agentId?: string | null): string => {
  if (agentId && agentId.startsWith("voicedots_agent_")) {
    return "v3";
  }
  if (agentId && (agentId.startsWith("agent_") || agentId.startsWith("agenet_"))) {
    return "v1";
  }
  return "v1"; // Default to v1
};

export const kpiAPI = {
  getKpiSummary: async (agentId?: string | null, startDate?: string, endDate?: string, source?: string): Promise<KpiSummary> => {
    const version = getApiVersion(agentId);
    const params: Record<string, string | undefined> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (source && source !== "all") params.source = source;

    const response = await apiClient.get<KpiSummary>(
      `/${version}/kpis/summary`,
      { params }
    );
    return response.data;
  },

  getKpis: async (agentId?: string | null, startDate?: string, endDate?: string, source?: string): Promise<GetKpisResult> => {
    const version = getApiVersion(agentId);
    const params: Record<string, string | undefined> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (source && source !== "all") params.source = source;

    const response = await apiClient.get<GetKpisResult>(
      `/${version}/kpis/`,
      { params }
    );
    return response.data;
  },

  // Home dashboard insights. Always v3: the route is scoped by the logged-in
  // client, not by agent id, so it serves every client.
  getInsights: async (startDate?: string, endDate?: string, source?: string): Promise<InsightsResponse> => {
    const response = await apiClient.get<InsightsResponse>("/v3/kpis/insights", {
      params: insightParams(startDate, endDate, source),
    });
    return response.data;
  },

  getInsightsSummary: async (startDate?: string, endDate?: string, source?: string): Promise<InsightsSummaryResponse> => {
    const response = await apiClient.get<InsightsSummaryResponse>("/v3/kpis/insights/summary", {
      params: insightParams(startDate, endDate, source),
    });
    return response.data;
  },

  getCallStats: async (startDate?: string, endDate?: string): Promise<CallStatsResponse> => {
    const response = await apiClient.get<CallStatsResponse>("/v3/kpis/calls", {
      params: insightParams(startDate, endDate),
    });
    return response.data;
  },
}

function insightParams(startDate?: string, endDate?: string, source?: string) {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  if (source && source !== "all") params.source = source;
  return params;
}

// export async function getKpis(): Promise<GetKpisResult>
// const res = await apiClient.get(
//     "/v1/conversations/kpis/summary"
//   );

//   return res.data;
