import { useEffect, useState, useSyncExternalStore } from 'react';
import { AudioEngine } from '../audio/AudioEngine';
import type { EngineSnapshot } from '../audio/types';

/**
 * Owns the AudioEngine lifecycle. The engine is created inside an effect (not during
 * render) so that React StrictMode's mount → unmount → mount cycle gets a fresh,
 * non-disposed instance, and the AudioContext is always closed on unmount.
 */
export function useAudioEngine(): AudioEngine | null {
  const [engine, setEngine] = useState<AudioEngine | null>(null);

  useEffect(() => {
    const instance = new AudioEngine();
    setEngine(instance);
    return () => {
      setEngine(null);
      void instance.dispose();
    };
  }, []);

  return engine;
}

/** Subscribes a component to engine state changes (tear-free via useSyncExternalStore). */
export function useEngineSnapshot(engine: AudioEngine): EngineSnapshot {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot);
}
