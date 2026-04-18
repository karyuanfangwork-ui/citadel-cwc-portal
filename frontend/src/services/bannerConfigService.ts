import apiClient from './api';

export interface BannerConfigItem {
  id: string;
  role: string;
  status: string;
  icon: string;
  title: string;
  description: string;
  colorScheme: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateBannerConfigPayload = Omit<BannerConfigItem, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateBannerConfigPayload = Partial<CreateBannerConfigPayload>;

export const bannerConfigService = {
  async getActive(): Promise<BannerConfigItem[]> {
    const response = await apiClient.get('/admin/banner-configs/active');
    return response.data.data.configs;
  },

  async getAll(): Promise<BannerConfigItem[]> {
    const response = await apiClient.get('/admin/banner-configs');
    return response.data.data.configs;
  },

  async create(payload: CreateBannerConfigPayload): Promise<BannerConfigItem> {
    const response = await apiClient.post('/admin/banner-configs', payload);
    return response.data.data.config;
  },

  async update(id: string, payload: UpdateBannerConfigPayload): Promise<BannerConfigItem> {
    const response = await apiClient.put(`/admin/banner-configs/${id}`, payload);
    return response.data.data.config;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/admin/banner-configs/${id}`);
  },
};
