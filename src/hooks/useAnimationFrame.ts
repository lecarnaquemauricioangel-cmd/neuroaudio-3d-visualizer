import { useEffect, useRef } from 'react';

/**
 * Runs `callback` on every animation frame while `enabled` is true.
 * The latest callback is always used (no stale closures) and the loop is
 * cancelled with `cancelAnimationFrame` on unmount or when disabled.
 */
export function useAnimationFrame(callback: (now: number, deltaMs: number) => void, enabled = true): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!enabled) return;
    let frameId = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const delta = now - last;
      last = now;
      callbackRef.current(now, delta);
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [enabled]);
}
