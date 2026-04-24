import api from './api';

export interface WorkflowStep {
  id: string;
  workflowTypeId: string;
  label: string;
  status: string;
  icon: string;
  displayOrder: number;
  isInitial: boolean;
  isFinal: boolean;
}

export interface WorkflowType {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  displayOrder: number;
  steps: WorkflowStep[];
  _count?: {
    requestTypes: number;
  };
}

export interface CreateWorkflowData {
  name: string;
  code: string;
  description?: string;
  steps?: {
    label: string;
    status: string;
    icon?: string;
    isInitial?: boolean;
    isFinal?: boolean;
  }[];
}

export interface UpdateWorkflowData {
  name?: string;
  code?: string;
  description?: string;
  isActive?: boolean;
  displayOrder?: number;
}

export interface CreateStepData {
  label: string;
  status: string;
  icon?: string;
  isInitial?: boolean;
  isFinal?: boolean;
}

export interface UpdateStepData {
  label?: string;
  status?: string;
  icon?: string;
  isInitial?: boolean;
  isFinal?: boolean;
}

const workflowService = {
  // Get all workflow types
  getWorkflowTypes: async (): Promise<WorkflowType[]> => {
    const response = await api.get('/admin/workflows');
    return response.data;
  },

  // Get workflow type by ID
  getWorkflowType: async (id: string): Promise<WorkflowType> => {
    const response = await api.get(`/admin/workflows/${id}`);
    return response.data;
  },

  // Get workflow type by code
  getWorkflowTypeByCode: async (code: string): Promise<WorkflowType> => {
    const response = await api.get(`/admin/workflows/code/${code}`);
    return response.data;
  },

  // Create workflow type
  createWorkflowType: async (data: CreateWorkflowData): Promise<WorkflowType> => {
    const response = await api.post('/admin/workflows', data);
    return response.data;
  },

  // Update workflow type
  updateWorkflowType: async (id: string, data: UpdateWorkflowData): Promise<WorkflowType> => {
    const response = await api.put(`/admin/workflows/${id}`, data);
    return response.data;
  },

  // Delete workflow type
  deleteWorkflowType: async (id: string): Promise<void> => {
    await api.delete(`/admin/workflows/${id}`);
  },

  // Add step to workflow
  addWorkflowStep: async (workflowId: string, data: CreateStepData): Promise<WorkflowStep> => {
    const response = await api.post(`/admin/workflows/${workflowId}/steps`, data);
    return response.data;
  },

  // Update workflow step
  updateWorkflowStep: async (workflowId: string, stepId: string, data: UpdateStepData): Promise<WorkflowStep> => {
    const response = await api.put(`/admin/workflows/${workflowId}/steps/${stepId}`, data);
    return response.data;
  },

  // Delete workflow step
  deleteWorkflowStep: async (workflowId: string, stepId: string): Promise<void> => {
    await api.delete(`/admin/workflows/${workflowId}/steps/${stepId}`);
  },

  // Reorder workflow steps
  reorderWorkflowSteps: async (workflowId: string, stepIds: string[]): Promise<WorkflowType> => {
    const response = await api.put(`/admin/workflows/${workflowId}/steps/reorder`, { stepIds });
    return response.data;
  },
};

export default workflowService;