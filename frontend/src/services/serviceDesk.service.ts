import apiClient from './api';

export const serviceDeskService = {
    async getAllServiceDesks() {
        const response = await apiClient.get('/service-desks');
        return response.data.data.serviceDesks;
    },

    async getServiceDeskById(id: string) {
        const response = await apiClient.get(`/service-desks/${id}`);
        return response.data.data.serviceDesk;
    },

    async getCategories(serviceDeskId: string) {
        const response = await apiClient.get(`/service-desks/${serviceDeskId}/categories`);
        return response.data.data.categories;
    },

    async getRequestTypes(serviceDeskId: string, categoryId?: string) {
        let url = `/service-desks/${serviceDeskId}/request-types`;
        if (categoryId) {
            url += `?categoryId=${categoryId}`;
        }
        const response = await apiClient.get(url);
        return response.data.data.requestTypes;
    },

    async getRequestTypeById(typeName: string) { // Wait, I added getRequestTypeById in controller by ID
        // Simplified for now, will use ID
    },

    // --- Admin Category Management ---

    async createCategory(serviceDeskId: string, data: any) {
        const response = await apiClient.post(`/service-desks/${serviceDeskId}/categories`, data);
        return response.data.data.category;
    },

    async updateCategory(serviceDeskId: string, categoryId: string, data: any) {
        const response = await apiClient.put(`/service-desks/${serviceDeskId}/categories/${categoryId}`, data);
        return response.data.data.category;
    },

    async deleteCategory(serviceDeskId: string, categoryId: string) {
        const response = await apiClient.delete(`/service-desks/${serviceDeskId}/categories/${categoryId}`);
        return response.data;
    },

    // --- Admin Request Type Management ---

    async createRequestType(data: any) {
        const response = await apiClient.post('/service-desks/request-types', data);
        return response.data.data.requestType;
    },

    async updateRequestType(typeId: string, data: any) {
        const response = await apiClient.put(`/service-desks/request-types/${typeId}`, data);
        return response.data.data.requestType;
    },

    async deleteRequestType(typeId: string) {
        const response = await apiClient.delete(`/service-desks/request-types/${typeId}`);
        return response.data;
    },
};
