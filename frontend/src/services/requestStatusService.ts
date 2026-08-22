import apiClient from './api';

export interface RequestStatusDefinition {
  id: string;
  code: string;
  label: string;
  description?: string;
  category?: string;
  displayOrder: number;
  isActive: boolean;
  lifecycleType: 'OPEN' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStatusDefinitionInput {
  code: string;
  label: string;
  description?: string;
  category?: string;
  displayOrder?: number;
  isActive?: boolean;
  lifecycleType?: RequestStatusDefinition['lifecycleType'];
  retiredAt?: string | null;
}

export interface UpdateStatusDefinitionInput extends Partial<CreateStatusDefinitionInput> {}

const BASE = '/admin/status-definitions';

export const requestStatusService = {
  getAll: async (category?: string): Promise<RequestStatusDefinition[]> => {
    const params = category ? { category } : {};
    const res = await apiClient.get(BASE, { params });
    return res.data.data.definitions;
  },

  getActive: async (category?: string, workflowTypeId?: string): Promise<RequestStatusDefinition[]> => {
    const params = { ...(category ? { category } : {}), ...(workflowTypeId ? { workflowTypeId } : {}) };
    const res = await apiClient.get(`${BASE}/active`, { params });
    return res.data.data.definitions;
  },

  create: async (input: CreateStatusDefinitionInput): Promise<RequestStatusDefinition> => {
    const res = await apiClient.post(BASE, input);
    return res.data.data.definition;
  },

  update: async (id: string, input: UpdateStatusDefinitionInput): Promise<RequestStatusDefinition> => {
    const res = await apiClient.put(`${BASE}/${id}`, input);
    return res.data.data.definition;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${BASE}/${id}`);
  },

  retire: async (id: string): Promise<RequestStatusDefinition> => {
    const res = await apiClient.post(`${BASE}/${id}/retire`);
    return res.data.data.definition;
  },

  usage: async (id: string): Promise<Record<string, number>> => {
    const res = await apiClient.get(`${BASE}/${id}/usage`);
    return res.data.data.usage;
  },
};
