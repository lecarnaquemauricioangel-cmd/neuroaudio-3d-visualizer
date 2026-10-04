import { useRef, useState } from 'react';
import type { AudioEngine } from '../audio/AudioEngine';
import { useAnimationFrame } from './useAnimationFrame';

const UPDATE_INTERVAL_MS = 100;

/** Polls the engine playhead at ~10 Hz — smooth enough for a progress bar without 60 re-renders/s. */
export function usePlaybackPosition(engine: AudioEngine, enabled: boolean): number {
  const [position, setPosition] = useState(0);
  const lastUpdate = useRef(0);

  useAnimationFrame((now) => {
    if (now - lastUpdate.current < UPDATE_INTERVAL_MS) return;
    lastUpdate.current = now;
    const next = engine.getPosition();
    setPosition((prev) => (Math.abs(prev - next) > 0.05 ? next : prev));
  }, enabled);

  return position;
}
