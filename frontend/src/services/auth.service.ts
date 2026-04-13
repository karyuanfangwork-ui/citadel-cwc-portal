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
}

export const authService = {
    async login(credentials: LoginCredentials): Promise<AuthUser> {
        const response = await apiClient.post('/auth/login', credentials);
        return response.data.data.user;
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
};
