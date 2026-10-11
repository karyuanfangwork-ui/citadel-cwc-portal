import api from './api';

export type DashboardScope = 'mine' | 'team' | 'accessible';
export type DashboardQueue = 'open' | 'closed' | 'all' | 'unassigned';
export type DashboardSlaState = 'BREACHED' | 'DUE_SOON' | 'ON_TRACK' | 'PAUSED' | 'NO_SLA' | 'MET' | 'MISSED' | 'NOT_APPLICABLE' | 'UNKNOWN';
export type DashboardSort = 'urgency' | 'created-desc' | 'created-asc' | 'updated-desc';
export type DashboardPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface DashboardQuery {
  scope: DashboardScope;
  queue: DashboardQueue;
  page: number;
  limit: 25 | 50 | 100;
  search?: string;
  requestTypeId?: string;
  priority?: DashboardPriority;
  slaState?: DashboardSlaState;
  sort: DashboardSort;
}
export interface DashboardTicket {
  id: string; reference: string; summary: string; priority: string; status: string; isTerminal: boolean;
  createdAt: string; updatedAt: string;
  requester: { id: string; name: string } | null;
  assignee: { id: string; name: string } | null;
  assignedTeam: string | null;
  requestType: { id: string; name: string } | null;
  sla: { state: DashboardSlaState; dueAt: string | null; remainingMs: number | null; completedAt: string | null; evidence: 'resolution-clock' | 'legacy-request' | 'none' };
}
export interface AgentDashboardResponse {
  asOf: string; scope: DashboardScope; scopeLabel: string; availableScopes: DashboardScope[];
  metrics: { open: number; dueSoon: number; breached: number; avgResolutionHours: number | null; resolutionSampleSize: number; resolutionWindow: { from: string; to: string } };
  queueCounts: { open: number; closed: number; all: number; unassigned: number };
  requestTypes: { id: string; name: string }[];
  attention: { total: number; tickets: DashboardTicket[] };
  tickets: DashboardTicket[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const agentDashboardService = {
  async get(query: DashboardQuery, signal?: AbortSignal): Promise<AgentDashboardResponse> {
    const response = await api.get<{ status: 'success'; data: AgentDashboardResponse }>('/requests/agent-dashboard', { params: query, signal });
    return response.data.data;
  },
};
