import apiClient from './api';

interface LoginCredentials {
    email: string;
    password: string;
}

interface RegisterData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    department?: string;
    jobTitle?: string;
}

interface AuthUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles?: string[];
    permissions?: string[];
    agentTeam?: string | null;
}

export const authService = {
    async login(credentials: LoginCredentials): Promise<AuthUser & { accessToken?: string }> {
        const response = await apiClient.post('/auth/login', credentials);
        // Backend returns { user, accessToken } - return both
        return {
            ...response.data.data.user,
            accessToken: response.data.data.accessToken,
        };
    },

    async register(data: RegisterData): Promise<AuthUser> {
        const response = await apiClient.post('/auth/register', data);
        return response.data.data.user;
    },

    async logout(): Promise<void> {
        try {
            await apiClient.post('/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        }
        // Cookies are cleared by the server via Set-Cookie: access_token=; Max-Age=0
    },

    async getCurrentUser(): Promise<AuthUser> {
        const response = await apiClient.get('/users/me');
        return response.data.data.user;
    },

    async changePassword(data: { currentPassword: string; newPassword: string; confirmPassword: string }): Promise<{ message: string }> {
        const response = await apiClient.put('/users/me/password', data);
        return response.data;
    },

    async forgotPassword(email: string): Promise<{ message: string }> {
        const response = await apiClient.post('/auth/forgot-password', { email });
        return response.data;
    },

    async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
        const response = await apiClient.post('/auth/reset-password', { token, newPassword });
        return response.data;
    },
};
