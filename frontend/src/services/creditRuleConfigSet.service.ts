import apiClient from './api';

export type RequiredFieldRuleInput = {
  fieldPath: string;
  fieldLabel: string;
  isMandatory: boolean;
  sortOrder: number;
  productType?: string | null;
  lane?: string | null;
  borrowerType?: string | null;
};

export type CreditRuleConfigSet = {
  id: string;
  name: string;
  version: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'ACTIVE' | 'SUPERSEDED';
  reason: string;
  createdById: string;
  submittedById: string | null;
  approvedById: string | null;
  activatedById: string | null;
  policyApprovalReference: string | null;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  activatedAt: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  rules: Array<RequiredFieldRuleInput & { id: string; isActive: boolean }>;
};

export const creditRuleConfigSetApi = {
  list: async (): Promise<CreditRuleConfigSet[]> => {
    const response = await apiClient.get('/credit/rule-config-sets');
    return response.data.data.ruleSets as CreditRuleConfigSet[];
  },
  create: async (input: { reason: string; rules: RequiredFieldRuleInput[] }): Promise<CreditRuleConfigSet> => {
    const response = await apiClient.post('/credit/rule-config-sets', input);
    return response.data.data.ruleSet as CreditRuleConfigSet;
  },
  submit: async (id: string): Promise<CreditRuleConfigSet> => {
    const response = await apiClient.post(`/credit/rule-config-sets/${id}/submit`);
    return response.data.data.ruleSet as CreditRuleConfigSet;
  },
  approve: async (id: string): Promise<CreditRuleConfigSet> => {
    const response = await apiClient.post(`/credit/rule-config-sets/${id}/approve`);
    return response.data.data.ruleSet as CreditRuleConfigSet;
  },
  activate: async (id: string, policyApprovalReference: string): Promise<CreditRuleConfigSet> => {
    const response = await apiClient.post(`/credit/rule-config-sets/${id}/activate`, { policyApprovalReference });
    return response.data.data.ruleSet as CreditRuleConfigSet;
  },
};
