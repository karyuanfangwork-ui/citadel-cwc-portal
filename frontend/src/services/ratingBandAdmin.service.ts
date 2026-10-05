import apiClient from './api';

export interface RatingBandConfig {
  id: string;
  scoreMin: number;
  scoreMax: number;
  rating: string;
  riskCategory: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  status?: string;
  name?: string | null;
  description?: string | null;
  bandSetId?: string | null;
  approvedBy?: { id: string; firstName: string; lastName: string; email: string } | null;
}

export interface RatingBandSetConfig {
  id: string;
  name: string;
  description: string | null;
  reason: string;
  version: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'ACTIVE' | 'SUPERSEDED';
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
  bands: RatingBandConfig[];
}

export interface RiskFactorMatrixConfig {
  id: string;
  factor: string;
  weight: number;
  threshold: string | null;
  reasonCodes: any;
  isActive: boolean;
}

export const ratingBandAdminApi = {
  listBands: async (): Promise<RatingBandConfig[]> => {
    const res = await apiClient.get('/credit/rating-bands');
    return res.data.data.bands as RatingBandConfig[];
  },

  listBandSets: async (): Promise<RatingBandSetConfig[]> => {
    const res = await apiClient.get('/credit/rating-bands/band-sets');
    return res.data.data.sets as RatingBandSetConfig[];
  },

  createDraftBandSet: async (data: {
    name: string;
    description?: string;
    reason: string;
    bands: Array<{ scoreMin: number; scoreMax: number; rating: string; riskCategory: string }>;
  }): Promise<RatingBandSetConfig> => {
    const res = await apiClient.post('/credit/rating-bands/band-sets', data);
    return res.data.data.set as RatingBandSetConfig;
  },

  submitBandSet: async (id: string): Promise<RatingBandSetConfig> => {
    const res = await apiClient.post(`/credit/rating-bands/band-sets/${id}/submit`);
    return res.data.data.set as RatingBandSetConfig;
  },

  approveBandSet: async (id: string): Promise<RatingBandSetConfig> => {
    const res = await apiClient.post(`/credit/rating-bands/band-sets/${id}/approve`);
    return res.data.data.set as RatingBandSetConfig;
  },

  activateBandSet: async (id: string, policyApprovalReference: string): Promise<RatingBandSetConfig> => {
    const res = await apiClient.post(`/credit/rating-bands/band-sets/${id}/activate`, { policyApprovalReference });
    return res.data.data.set as RatingBandSetConfig;
  },

  getActiveBands: async (): Promise<RatingBandConfig[]> => {
    const res = await apiClient.get('/credit/rating-bands/active');
    return res.data.data.bands as RatingBandConfig[];
  },

  createBand: async (data: { scoreMin: number; scoreMax: number; rating: string; riskCategory: string; effectiveFrom?: string }): Promise<RatingBandConfig> => {
    const res = await apiClient.post('/credit/rating-bands', data);
    return res.data.data.band as RatingBandConfig;
  },

  updateBand: async (id: string, data: Partial<RatingBandConfig>): Promise<RatingBandConfig> => {
    const res = await apiClient.patch(`/credit/rating-bands/${id}`, data);
    return res.data.data.band as RatingBandConfig;
  },

  seedDefaults: async (): Promise<void> => {
    await apiClient.post('/credit/rating-bands/seed');
  },

  listRiskFactors: async (): Promise<RiskFactorMatrixConfig[]> => {
    const res = await apiClient.get('/credit/rating-bands/risk-factors');
    return res.data.data.matrices as RiskFactorMatrixConfig[];
  },

  upsertRiskFactor: async (data: { factor: string; weight: number; threshold?: string; reasonCodes?: any }): Promise<RiskFactorMatrixConfig> => {
    const res = await apiClient.post('/credit/rating-bands/risk-factors', data);
    return res.data.data.matrix as RiskFactorMatrixConfig;
  },
};