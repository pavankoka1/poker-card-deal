import { useEffect, useRef, useState } from 'react';

/**
 * rAF-based delay. Returns true once delay elapses. Resets when inputs change.
 * No setTimeout/Promise used; purely requestAnimationFrame + performance.now.
 */
export function useRafDelay(delayMs: number, active: boolean = true): boolean {
  const [ready, setReady] = useState(delayMs <= 0 && active);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      // If not active, ensure we are not running and not ready
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      startRef.current = null;
      setReady(false);
      return;
    }

    if (delayMs <= 0) {
      setReady(true);
      return;
    }

    setReady(false);
    const now = performance.now();
    startRef.current = now;

    const loop = () => {
      const current = performance.now();
      const elapsed = current - (startRef.current ?? current);
      if (elapsed >= delayMs) {
        setReady(true);
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [delayMs, active]);

  return ready;
}
