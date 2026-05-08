import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

const apiClient: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
    withCredentials: true, // send HttpOnly cookies on every request
});

// --- Refresh lock: prevent infinite 401 loops ---
let isRefreshing = false;
let refreshFailed = false;
let refreshPromise: Promise<any> | null = null;

// Response interceptor — silent token refresh on 401
apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
            // If refresh already failed, immediately reject (no retry loop)
            if (refreshFailed) {
                return Promise.reject(error);
            }

            originalRequest._retry = true;

            // Only one refresh at a time — other concurrent 401s wait on the same promise
            if (!isRefreshing) {
                isRefreshing = true;
                refreshPromise = axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true })
                    .then((res) => {
                        return res;
                    })
                    .catch((refreshError) => {
                        refreshFailed = true;
                        // Redirect to login once — never from public auth pages (they handle unauthenticated state themselves)
                        const publicAuthPaths = ['/login', '/forgot-password', '/reset-password'];
                        if (!publicAuthPaths.includes(window.location.pathname)) {
                            window.location.href = '/login';
                        }
                        throw refreshError;
                    })
                    .finally(() => {
                        isRefreshing = false;
                    });
            }

            try {
                await refreshPromise;
                // Refresh succeeded — retry original request with fresh cookie
                return apiClient(originalRequest);
            } catch {
                // Refresh failed — already redirected above
                return Promise.reject(error);
            }
        }

        const axiosError = error as any;
        const errorMessage = axiosError.response?.data?.message || axiosError.message || 'An error occurred';
        return Promise.reject(new Error(errorMessage));
    }
);

export default apiClient;
