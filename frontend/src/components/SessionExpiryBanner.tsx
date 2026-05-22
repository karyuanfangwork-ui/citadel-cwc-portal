import React, { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useIdleSession } from '../hooks/useIdleSession';
import { authService } from '../services/auth.service';

const SessionExpiryBanner: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();

  const handleTimeout = useCallback(async () => {
    try {
      await logout();
    } finally {
      window.location.href = '/login?reason=session_expired';
    }
  }, [logout]);

  const { warning, secondsRemaining, resetActivity } = useIdleSession({
    enabled: isAuthenticated,
    onTimeout: handleTimeout,
  });

  const handleExtend = useCallback(async () => {
    try {
      // Hitting /users/me triggers the api interceptor's silent refresh
      // on 401, otherwise just confirms the session is alive.
      await authService.getCurrentUser();
      resetActivity();
    } catch {
      handleTimeout();
    }
  }, [resetActivity, handleTimeout]);

  if (!isAuthenticated || !warning) return null;

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  return (
    <div
      role="alertdialog"
      aria-labelledby="session-expiry-title"
      aria-describedby="session-expiry-desc"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] w-[min(560px,calc(100vw-2rem))] bg-amber-50 border border-amber-300 rounded-cwc-lg shadow-lg p-4 flex items-start gap-3"
    >
      <span className="material-symbols-outlined text-amber-600 text-2xl shrink-0" aria-hidden="true">
        schedule
      </span>
      <div className="flex-1 min-w-0">
        <div id="session-expiry-title" className="text-sm font-bold text-amber-900">
          Session expiring soon
        </div>
        <div id="session-expiry-desc" className="text-sm text-amber-800 mt-0.5">
          You'll be signed out in <span className="font-mono font-bold">{timeStr}</span> due to inactivity.
          Unsaved autosave fields have been preserved.
        </div>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={handleExtend}
            className="px-3 py-1.5 text-sm font-bold rounded-cwc-md bg-amber-600 text-white hover:bg-amber-700"
            style={{ border: 'none', cursor: 'pointer' }}
          >
            Stay signed in
          </button>
          <button
            type="button"
            onClick={handleTimeout}
            className="px-3 py-1.5 text-sm font-semibold rounded-cwc-md text-amber-900 hover:bg-amber-100"
            style={{ background: 'none', border: '1px solid var(--color-border, #d4d4d8)', cursor: 'pointer' }}
          >
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionExpiryBanner;
