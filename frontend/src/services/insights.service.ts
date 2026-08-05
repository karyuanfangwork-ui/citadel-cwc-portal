// frontend/src/services/insights.service.ts
// API client for the Insights Hub backend endpoints

import api from './api';

// ── Type definitions ──────────────────────────────────────────────────────────

export interface OverviewData {
  totalOpen: number;
  slaBreachRate: number;
  avgResolutionHours: number | null;
  byModule: Array<{ module: string; count: number }>;
}

export interface ItsmSummaryData {
  total: number;
  open: number;
  resolved: number;
  unassigned: number;
  avgResolutionHours: number | null;
}

export interface TrendBucket {
  bucket: string; // ISO date string
  total: number;
  resolved: number;
  breached: number;
}

export interface ServiceDeskBucket {
  serviceDeskId: string | null;
  name: string | null;
  code: string | null;
  count: number;
}

export interface PriorityBucket {
  priority: string;
  count: number;
}

export interface AgentWorkloadItem {
  assignedToId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  openTickets: number;
}

export interface SlaComplianceData {
  withinSla: number;
  breached: number;
  noSla: number;
}

export interface CrmOverviewData {
  totalLeads: number;
  totalOpportunities: number;
  conversionRate: number;
  pipelineValue: number;
  pipelineStages: Array<{
    stageId: string;
    stageName: string;
    probability: number;
    dealCount: number;
    totalValue: number;
  }>;
}

export interface CreditOverviewData {
  totalApplications: number;
  byState: Array<{ state: string; count: number }>;
  totalRequestedAmount: number;
  approvedCount: number;
  rejectedCount: number;
  outstandingCount: number;
}

// ── Helper: unwrap API envelope ─────────────────────────────────────────────

// The backend returns { status: 'success', data: ... } or the raw data directly.
// Axios wraps the entire response in { data: ... }, so we need to unwrap.
function unwrap<T>(response: { data: T | { status: string; data: T } }): T {
  const d = response.data as any;
  if (d && typeof d === 'object' && 'status' in d && 'data' in d) {
    return d.data as T;
  }
  return d as T;
}

// ── Service ──────────────────────────────────────────────────────────────────

const insightsService = {
  // Overview
  getOverview: () =>
    api.get('/insights/overview').then(unwrap<OverviewData>),

  // ITSM
  getItsmSummary: (params?: { from?: string; to?: string }) =>
    api.get('/insights/itsm/summary', { params }).then(unwrap<ItsmSummaryData>),

  getItsmTrends: (params?: { from?: string; to?: string; granularity?: 'day' | 'week' | 'month' }) =>
    api.get('/insights/itsm/trends', { params }).then(unwrap<TrendBucket[]>),

  getItsmByServiceDesk: (params?: { from?: string; to?: string }) =>
    api.get('/insights/itsm/by-service-desk', { params }).then(unwrap<ServiceDeskBucket[]>),

  getItsmByPriority: (params?: { from?: string; to?: string }) =>
    api.get('/insights/itsm/by-priority', { params }).then(unwrap<PriorityBucket[]>),

  getItsmAgentWorkload: () =>
    api.get('/insights/itsm/agent-workload').then(unwrap<AgentWorkloadItem[]>),

  getItsmSlaCompliance: (params?: { from?: string; to?: string }) =>
    api.get('/insights/itsm/sla-compliance', { params }).then(unwrap<SlaComplianceData>),

  // CRM
  getCrmOverview: () =>
    api.get('/insights/crm/overview').then(unwrap<CrmOverviewData>),

  // Credit
  getCreditOverview: () =>
    api.get('/insights/credit/overview').then(unwrap<CreditOverviewData>),
};

export default insightsService;