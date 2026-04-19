import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

const apiClient: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
    withCredentials: true, // send HttpOnly cookies on every request
});

// Response interceptor — silent token refresh on 401
apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // POST to /refresh — browser sends refresh_token cookie automatically
                await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
                // Retry original request — browser now has fresh access_token cookie
                return apiClient(originalRequest);
            } catch {
                // Refresh failed — redirect to login
                window.location.href = '/#/login';
                return Promise.reject(error);
            }
        }

        const axiosError = error as any;
        const errorMessage = axiosError.response?.data?.message || axiosError.message || 'An error occurred';
        return Promise.reject(new Error(errorMessage));
    }
);

export default apiClient;
