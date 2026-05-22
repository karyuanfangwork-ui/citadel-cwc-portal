import api from './api';

export interface ReportSummary {
  total: number;
  open: number;
  resolved: number;
  unassigned: number;
  avgResolutionHours: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface ServiceDeskCount {
  serviceDeskId: string;
  name: string;
  code: string;
  count: number;
}

export interface PriorityCount {
  priority: string;
  count: number;
}

export interface AgentWorkload {
  agentId: string;
  name: string;
  email: string;
  activeTickets: number;
}

export interface SlaStatus {
  withinSla: number;
  breached: number;
  noSla: number;
}

export interface DateRange {
  from?: string; // ISO date string
  to?: string;   // ISO date string
}

function dateParams(range?: DateRange): Record<string, string> {
  const params: Record<string, string> = {};
  if (range?.from) params.from = range.from;
  if (range?.to) params.to = range.to;
  return params;
}

const reportsService = {
  async getSummary(range?: DateRange): Promise<ReportSummary> {
    const response = await api.get('/reports/summary', { params: dateParams(range) });
    return response.data.data;
  },
  async getByStatus(range?: DateRange): Promise<StatusCount[]> {
    const response = await api.get('/reports/by-status', { params: dateParams(range) });
    return response.data.data;
  },
  async getByServiceDesk(range?: DateRange): Promise<ServiceDeskCount[]> {
    const response = await api.get('/reports/by-service-desk', { params: dateParams(range) });
    return response.data.data;
  },
  async getByPriority(range?: DateRange): Promise<PriorityCount[]> {
    const response = await api.get('/reports/by-priority', { params: dateParams(range) });
    return response.data.data;
  },
  async getAgentWorkload(range?: DateRange): Promise<AgentWorkload[]> {
    const response = await api.get('/reports/agent-workload', { params: dateParams(range) });
    return response.data.data;
  },
  async getSlaStatus(range?: DateRange): Promise<SlaStatus> {
    const response = await api.get('/reports/sla-status', { params: dateParams(range) });
    return response.data.data;
  },
};

export default reportsService;