import { useEffect, useRef, useState, useCallback } from 'react';

interface IdleSessionOptions {
  /** Total idle time before forced logout (ms). Default 30 min. */
  timeoutMs?: number;
  /** Time before timeoutMs to begin warning (ms). Default 5 min. */
  warningMs?: number;
  /** Called when timeoutMs elapses with no activity (and warning unacknowledged). */
  onTimeout: () => void;
  /** Whether tracking is active (skip on unauthenticated pages). */
  enabled: boolean;
}

interface IdleSessionState {
  /** True while in the warningMs window prior to timeout. */
  warning: boolean;
  /** Seconds remaining until forced logout (only meaningful while warning is true). */
  secondsRemaining: number;
  /** Reset activity timer (call after user extends session). */
  resetActivity: () => void;
}

const ACTIVITY_EVENTS: Array<keyof DocumentEventMap> = [
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'pointerdown',
];

export function useIdleSession({
  timeoutMs = 30 * 60 * 1000,
  warningMs = 5 * 60 * 1000,
  onTimeout,
  enabled,
}: IdleSessionOptions): IdleSessionState {
  const [warning, setWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(Math.floor(warningMs / 1000));
  const lastActivityRef = useRef<number>(Date.now());
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setWarning(false);
    setSecondsRemaining(Math.floor(warningMs / 1000));
  }, [warningMs]);

  useEffect(() => {
    if (!enabled) return;

    const handleActivity = () => {
      // Only suppress activity tracking while warning is shown so the user
      // must explicitly acknowledge / extend.
      if (!warning) {
        lastActivityRef.current = Date.now();
      }
    };

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));

    const tick = window.setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      const remaining = timeoutMs - idleMs;

      if (remaining <= 0) {
        onTimeoutRef.current();
        return;
      }

      if (remaining <= warningMs) {
        setWarning(true);
        setSecondsRemaining(Math.max(0, Math.ceil(remaining / 1000)));
      } else if (warning) {
        setWarning(false);
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, handleActivity));
      window.clearInterval(tick);
    };
  }, [enabled, timeoutMs, warningMs, warning]);

  return { warning, secondsRemaining, resetActivity };
}
