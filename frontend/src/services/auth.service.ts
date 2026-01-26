import apiClient from './api';
import { tokenManager } from '../utils/tokenManager';

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

interface AuthResponse {
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        roles?: string[];
    };
    accessToken: string;
    refreshToken: string;
}

export const authService = {
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const response = await apiClient.post('/auth/login', credentials);
        const { accessToken, refreshToken, user } = response.data.data;

        // Store tokens
        tokenManager.setTokens(accessToken, refreshToken);

        return { user, accessToken, refreshToken };
    },

    async register(data: RegisterData): Promise<AuthResponse> {
        const response = await apiClient.post('/auth/register', data);
        const { accessToken, refreshToken, user } = response.data.data;

        // Store tokens
        tokenManager.setTokens(accessToken, refreshToken);

        return { user, accessToken, refreshToken };
    },

    async logout(): Promise<void> {
        try {
            await apiClient.post('/auth/logout');
        } catch (error) {
            // Ignore errors on logout
            console.error('Logout error:', error);
        } finally {
            // Always clear tokens
            tokenManager.clearTokens();
        }
    },

    async getCurrentUser() {
        const response = await apiClient.get('/users/me');
        return response.data.data.user;
    },

    async refreshToken(): Promise<string> {
        const refreshToken = tokenManager.getRefreshToken();
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        const response = await apiClient.post('/auth/refresh', { refreshToken });
        const { accessToken } = response.data.data;

        tokenManager.setTokens(accessToken, refreshToken);
        return accessToken;
    },
};
