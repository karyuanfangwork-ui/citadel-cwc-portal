/**
 * tokenManager — stub retained for API compatibility.
 *
 * Tokens are now stored exclusively in HttpOnly cookies managed by the server.
 * This module no longer reads or writes localStorage. The server is the single
 * source of truth for session state.
 */
export const tokenManager = {
    /** @deprecated Tokens are server-managed via HttpOnly cookies. Always returns null. */
    getAccessToken(): null {
        return null;
    },

    /** @deprecated Tokens are server-managed via HttpOnly cookies. Always returns null. */
    getRefreshToken(): null {
        return null;
    },

    /** @deprecated No-op. Tokens are set by the server via Set-Cookie. */
    setTokens(_accessToken: string, _refreshToken: string): void {
        // intentional no-op
    },

    /** @deprecated No-op. Tokens are cleared by the server via clearCookie. */
    clearTokens(): void {
        // intentional no-op
    },

    /**
     * Always returns false — token expiry is enforced server-side.
     * @deprecated
     */
    isTokenExpired(_token: string): boolean {
        return false;
    },
};
