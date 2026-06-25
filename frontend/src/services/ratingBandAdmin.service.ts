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
  approvedBy?: { id: string; firstName: string; lastName: string; email: string } | null;
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