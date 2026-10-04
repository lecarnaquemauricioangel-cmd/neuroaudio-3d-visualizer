export type AudioSourceKind = 'none' | 'synth' | 'file' | 'mic';

/** Mirrors `AudioContextState` plus a pre-initialisation state (no context created yet). */
export type EngineContextState = 'uninitialized' | AudioContextState;

/** Per-frame audio features consumed by the 3D scenes and UI meters. All values are normalised 0..1. */
export interface AudioFeatures {
  bass: number;
  mid: number;
  treble: number;
  /** Overall loudness (RMS of the time-domain signal, smoothed). */
  energy: number;
  /** Decaying pulse that jumps to 1 when a beat (bass onset) is detected. */
  beat: number;
  /** Monotonic counter of detected beats; lets consumers react once per beat. */
  beatCount: number;
  /** Raw byte frequency data (length = fftSize / 2). Shared buffer — do not mutate. */
  spectrum: Uint8Array<ArrayBuffer>;
}

export interface EngineSnapshot {
  contextState: EngineContextState;
  source: AudioSourceKind;
  trackName: string;
  isPlaying: boolean;
  /** Seconds. `Infinity` for live sources (mic). */
  duration: number;
  volume: number;
  error: string | null;
}

export type EngineListener = (snapshot: EngineSnapshot) => void;
