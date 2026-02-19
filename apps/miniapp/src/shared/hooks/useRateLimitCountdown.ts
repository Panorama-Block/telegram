import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook that manages a rate-limit countdown timer.
 *
 * When a 429 response is received, call `trigger(seconds)` with the
 * retry-after value. The hook returns the remaining seconds (ticking
 * every second) and a boolean `isLimited` for easy gating.
 */
export function useRateLimitCountdown() {
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRemaining(0);
  }, []);

  const trigger = useCallback(
    (seconds: number) => {
      // Sanity clamp: 1–120 s
      const clamped = Math.max(1, Math.min(120, Math.ceil(seconds)));
      clear();
      setRemaining(clamped);

      timerRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [clear],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    /** Seconds remaining in the cooldown (0 = not limited) */
    remaining,
    /** Whether the cooldown is active */
    isLimited: remaining > 0,
    /** Start a cooldown for `seconds` */
    trigger,
    /** Manually clear the cooldown */
    clear,
  };
}

/**
 * Extract retry-after seconds from an Error message or a Response.
 * Returns a default (30s) when the header is missing.
 */
export function parseRetryAfter(
  errorOrResponse: unknown,
  defaultSeconds = 30,
): number {
  // From a Response object
  if (errorOrResponse instanceof Response) {
    const header = errorOrResponse.headers.get('retry-after');
    if (header) {
      const n = Number(header);
      if (Number.isFinite(n) && n > 0) return Math.ceil(n);
      const d = Date.parse(header);
      if (Number.isFinite(d)) {
        const delta = Math.ceil((d - Date.now()) / 1000);
        if (delta > 0) return delta;
      }
    }
    return defaultSeconds;
  }

  // From an Error message containing "Try again in Xs" or "retry-after: X"
  if (errorOrResponse instanceof Error || typeof errorOrResponse === 'string') {
    const msg =
      typeof errorOrResponse === 'string'
        ? errorOrResponse
        : errorOrResponse.message;
    const match = msg.match(/(?:try again in|retry[- ]after[:\s]*)\s*(\d+)/i);
    if (match) return Number(match[1]);
  }

  return defaultSeconds;
}
