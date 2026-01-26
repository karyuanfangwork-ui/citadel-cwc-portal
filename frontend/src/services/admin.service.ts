import apiClient from './api';

export interface CategoryData {
    name: string;
    description?: string;
    icon: string;
    colorClass: string;
    displayOrder: number;
    isActive?: boolean;
}

export const adminService = {
    /**
     * Create a new category for a service desk
     */
    async createCategory(serviceDeskId: string, data: CategoryData) {
        const response = await apiClient.post(`/service-desks/${serviceDeskId}/categories`, data);
        return response.data.data.category;
    },

    /**
     * Update an existing category
     */
    async updateCategory(serviceDeskId: string, categoryId: string, data: Partial<CategoryData>) {
        const response = await apiClient.put(`/service-desks/${serviceDeskId}/categories/${categoryId}`, data);
        return response.data.data.category;
    },

    /**
     * Delete (soft delete) a category
     */
    async deleteCategory(serviceDeskId: string, categoryId: string) {
        const response = await apiClient.delete(`/service-desks/${serviceDeskId}/categories/${categoryId}`);
        return response.data;
    },
};
