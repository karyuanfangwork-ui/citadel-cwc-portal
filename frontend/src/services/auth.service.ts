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
    tenantId?: string | null;
    /** Task 14: Department memberships from server-authoritative policy */
    departmentIds?: string[];
}

/** P0-2: Error thrown when the backend requires a password reset */
export class PasswordResetRequiredError extends Error {
    resetToken: string;
    email: string;
    constructor(resetToken: string, email: string) {
        super('PASSWORD_RESET_REQUIRED');
        this.name = 'PasswordResetRequiredError';
        this.resetToken = resetToken;
        this.email = email;
    }
}

export const authService = {
    async login(credentials: LoginCredentials): Promise<AuthUser & { accessToken?: string }> {
        try {
            const response = await apiClient.post('/auth/login', credentials);
            return {
                ...response.data.data.user,
                accessToken: response.data.data.accessToken,
            };
        } catch (error: any) {
            // P0-2: Handle mustResetPassword — backend returns 403 with PASSWORD_RESET_REQUIRED
            if (
                error?.response?.status === 403 &&
                error?.response?.data?.message === 'PASSWORD_RESET_REQUIRED' &&
                error?.response?.data?.details?.resetToken
            ) {
                throw new PasswordResetRequiredError(
                    error.response.data.details.resetToken,
                    error.response.data.details.email,
                );
            }
            throw error;
        }
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

    /** Task 14: Fetch server-authoritative policy decisions for frontend route/action consumption */
    async getMyPolicy(): Promise<import('../types/policy').PolicyDecision> {
        const response = await apiClient.get('/users/me/policy');
        return response.data.data;
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