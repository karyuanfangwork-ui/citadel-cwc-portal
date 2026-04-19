import apiClient from './api';

export interface RequestStatusDefinition {
  id: string;
  code: string;
  label: string;
  description?: string;
  category?: string;
  displayOrder: number;
  isActive: boolean;
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
}

export interface UpdateStatusDefinitionInput extends Partial<CreateStatusDefinitionInput> {}

const BASE = '/admin/status-definitions';

export const requestStatusService = {
  getAll: async (category?: string): Promise<RequestStatusDefinition[]> => {
    const params = category ? { category } : {};
    const res = await apiClient.get(BASE, { params });
    return res.data.data.definitions;
  },

  getActive: async (category?: string): Promise<RequestStatusDefinition[]> => {
    const params = category ? { category } : {};
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
};
