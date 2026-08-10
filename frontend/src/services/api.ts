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

// Reset refreshFailed when the page becomes visible again (e.g. user returns
// from another tab or the browser wakes up). A page visibility change often
// means a new network context — the stale flag should not persist.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        refreshFailed = false;
    }
});

// Safety net: clear the isRefreshing lock if it's been held too long
// (e.g. the refresh promise never resolved due to network drop).
const REFRESH_LOCK_TIMEOUT_MS = 15_000;
let refreshLockTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRefreshLockExpiry() {
    if (refreshLockTimer) clearTimeout(refreshLockTimer);
    refreshLockTimer = setTimeout(() => {
        isRefreshing = false;
        refreshPromise = null;
    }, REFRESH_LOCK_TIMEOUT_MS);
}

function clearRefreshLockExpiry() {
    if (refreshLockTimer) {
        clearTimeout(refreshLockTimer);
        refreshLockTimer = null;
    }
}

// Response interceptor — silent token refresh on 401
apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        if (axios.isCancel(error)) {
            return Promise.reject(error);
        }
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // ── Extract user-friendly message from any error ──────────
        // Backend returns { status: 'error', message: '...' } — prefer that
        // over Axios's generic "Request failed with status code NNN".
        const axiosError = error as any;
        const serverMessage = axiosError.response?.data?.message;
        const friendlyMessage = serverMessage || axiosError.message || 'An error occurred';

        // ── 401 handling: attempt silent token refresh ─────────────
        if (error.response?.status === 401 && !originalRequest._retry) {
            // Auth endpoints (login, forgot-password, reset-password) should NOT
            // trigger a refresh attempt — the user isn't authenticated yet and
            // the 401 is the expected error response (e.g. "Invalid email or password").
            const authEndpoints = ['/auth/login', '/auth/forgot-password', '/auth/reset-password'];
            const isAuthEndpoint = authEndpoints.some(ep => originalRequest.url?.includes(ep));

            if (isAuthEndpoint) {
                // Return the server's error message directly — no refresh attempt
                return Promise.reject(new Error(friendlyMessage));
            }

            // If refresh already failed, reject immediately but also schedule a
            // retry window so the next user action can attempt a fresh refresh.
            if (refreshFailed) {
                // Allow one more attempt after a short delay — the refresh token
                // cookie (30-day lifetime) is likely still valid; the failure may
                // have been transient (network blip, SSE timeout, etc.).
                refreshFailed = false;
                return Promise.reject(new Error(friendlyMessage));
            }

            originalRequest._retry = true;

            // Only one refresh at a time — other concurrent 401s wait on the same promise
            if (!isRefreshing) {
                isRefreshing = true;
                scheduleRefreshLockExpiry();

                refreshPromise = axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true })
                    .then((res) => {
                        clearRefreshLockExpiry();
                        return res;
                    })
                    .catch((refreshError) => {
                        clearRefreshLockExpiry();
                        refreshFailed = true;
                        // Give the refresh mechanism a second chance after 5 seconds.
                        // The refresh token cookie (30d lifetime) is likely still valid;
                        // the failure is often transient (network blip, SSE timeout, etc.).
                        setTimeout(() => { refreshFailed = false; }, 5_000);
                        // Redirect to login once — never from public auth pages
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
                return Promise.reject(new Error(friendlyMessage));
            }
        }

        // ── Non-401 errors (or 401 with _retry already set) ───────
        const wrapped = new Error(friendlyMessage) as Error & { response?: any; status?: number };
        wrapped.response = axiosError.response;
        wrapped.status = axiosError.response?.status;
        return Promise.reject(wrapped);
    }
);

export default apiClient;
