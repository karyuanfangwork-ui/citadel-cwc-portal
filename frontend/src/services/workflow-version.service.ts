import apiClient from './api';

export type WorkflowVersionStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface RequestTypeSummary {
  id: string;
  name: string;
}

export interface WorkflowVersionSummary {
  id: string;
  version: number;
  status: WorkflowVersionStatus;
  publishedAt: string | null;
  publishedBy?: { id: string; firstName: string; lastName: string } | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowSummary {
  id: string;
  code: string;
  name: string;
  requestTypes: RequestTypeSummary[];
  activeVersion: WorkflowVersionSummary | null;
  draftVersion: WorkflowVersionSummary | null;
}

export interface GraphNode {
  id: string;
  type: 'STATUS';
  statusCode: string | null;
  label?: string | null;
  displayOrder?: number | null;
  positionX: number | null;
  positionY: number | null;
  isInitial: boolean;
  isFinal: boolean;
  slaPause: boolean;
  icon: string;
}

export interface GraphEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  transitionLabel: string | null;
  requiresComment: boolean;
  autoAssignRole: string | null;
  autoAssignUserId: string | null;
  allowedRoles: string[];
  allowedExecutiveRoles: string[];
}

export interface WorkflowGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type FindingCode = string;

export interface ValidationFinding {
  code: FindingCode;
  message: string;
  nodeId?: string;
  edgeId?: string;
  statusCode?: string;
}

export interface ValidationResult {
  blocking: ValidationFinding[];
  warnings: ValidationFinding[];
}

export interface RemapEntry {
  statusCode: string;
  requestCount: number;
  suggestedTarget: string | null;
  suggestionReason: string;
  allowedTargets: string[];
  sourcePausesSla: boolean;
}

export interface RemapPlan {
  entries: RemapEntry[];
  totalRequests: number;
}

export interface WorkflowVersionDetail {
  version: WorkflowVersionSummary & { workflowTypeId: string };
  graph: WorkflowGraph;
  validation: ValidationResult;
  remapPlan: RemapPlan;
  activeCodes?: string[];
  runtimeMissingCodes?: string[];
}

export interface PublishResult {
  version: number;
  transitionCount: number;
  stepCount: number;
  movedCount: number;
}

export interface NodeBatch {
  upsert: GraphNode[];
  remove: string[];
}

export interface EdgeBatch {
  upsert: GraphEdge[];
  remove: string[];
}

interface ApiEnvelope<T> {
  status: 'success';
  data: T;
}

const unwrap = <T>(response: { data: ApiEnvelope<T> }): T => response.data.data;

export const workflowVersionService = {
  async listWorkflows(): Promise<{ workflows: WorkflowSummary[] }> {
    return unwrap(await apiClient.get<ApiEnvelope<{ workflows: WorkflowSummary[] }>>('/admin/workflows'));
  },

  async listVersions(workflowTypeId: string): Promise<{ versions: WorkflowVersionSummary[] }> {
    return unwrap(await apiClient.get<ApiEnvelope<{ versions: WorkflowVersionSummary[] }>>(`/admin/workflows/${workflowTypeId}/versions`));
  },

  async createDraft(workflowTypeId: string): Promise<{ draft: { id: string; version: number } }> {
    return unwrap(await apiClient.post<ApiEnvelope<{ draft: { id: string; version: number } }>>(`/admin/workflows/${workflowTypeId}/versions`));
  },

  async getVersion(versionId: string): Promise<WorkflowVersionDetail> {
    return unwrap(await apiClient.get<ApiEnvelope<WorkflowVersionDetail>>(`/admin/workflows/versions/${versionId}`));
  },

  async updateNodes(versionId: string, batch: NodeBatch): Promise<{ upserted: number; removed: number }> {
    return unwrap(await apiClient.patch<ApiEnvelope<{ upserted: number; removed: number }>>(`/admin/workflows/versions/${versionId}/nodes`, batch));
  },

  async updateEdges(versionId: string, batch: EdgeBatch): Promise<{ upserted: number; removed: number }> {
    return unwrap(await apiClient.patch<ApiEnvelope<{ upserted: number; removed: number }>>(`/admin/workflows/versions/${versionId}/edges`, batch));
  },

  async replaceGraph(versionId: string, graph: WorkflowGraph): Promise<{ nodeCount: number; edgeCount: number }> {
    return unwrap(await apiClient.patch<ApiEnvelope<{ nodeCount: number; edgeCount: number }>>(`/admin/workflows/versions/${versionId}/graph`, graph));
  },

  async validateVersion(versionId: string): Promise<{ validation: ValidationResult; remapPlan: RemapPlan }> {
    return unwrap(await apiClient.post<ApiEnvelope<{ validation: ValidationResult; remapPlan: RemapPlan }>>(`/admin/workflows/versions/${versionId}/validate`));
  },

  async publishVersion(versionId: string, statusRemap: Record<string, string> = {}): Promise<PublishResult> {
    return unwrap(await apiClient.post<ApiEnvelope<PublishResult>>(`/admin/workflows/versions/${versionId}/publish`, { statusRemap }));
  },

  async rollbackVersion(versionId: string): Promise<{ version: number }> {
    return unwrap(await apiClient.post<ApiEnvelope<{ version: number }>>(`/admin/workflows/versions/${versionId}/rollback`));
  },

  async discardDraft(versionId: string): Promise<{ discarded: true }> {
    return unwrap(await apiClient.delete<ApiEnvelope<{ discarded: true }>>(`/admin/workflows/versions/${versionId}`));
  },
};

export default workflowVersionService;
