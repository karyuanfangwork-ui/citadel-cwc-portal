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

const reportsService = {
  async getSummary(): Promise<ReportSummary> {
    const response = await api.get('/reports/summary');
    return response.data.data;
  },
  async getByStatus(): Promise<StatusCount[]> {
    const response = await api.get('/reports/by-status');
    return response.data.data;
  },
  async getByServiceDesk(): Promise<ServiceDeskCount[]> {
    const response = await api.get('/reports/by-service-desk');
    return response.data.data;
  },
  async getByPriority(): Promise<PriorityCount[]> {
    const response = await api.get('/reports/by-priority');
    return response.data.data;
  },
  async getAgentWorkload(): Promise<AgentWorkload[]> {
    const response = await api.get('/reports/agent-workload');
    return response.data.data;
  },
  async getSlaStatus(): Promise<SlaStatus> {
    const response = await api.get('/reports/sla-status');
    return response.data.data;
  },
};

export default reportsService;
