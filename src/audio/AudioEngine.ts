import { FeatureExtractor } from './FeatureExtractor';
import { SynthwaveSynth } from './SynthwaveSynth';
import type { AudioFeatures, EngineListener, EngineSnapshot } from './types';

export const FFT_SIZE = 2048;
const ACCEPTED_EXTENSIONS = /\.(mp3|wav|ogg|oga|m4a|aac|flac|webm)$/i;

/**
 * Audio graph:
 *
 *   [synth | <audio> | mic] → inputBus → analyser → monitor → master(volume) → destination
 *
 * - The analyser sits *before* the volume stage, so visuals don't fade when the user lowers volume.
 * - `monitor` is muted for the microphone to avoid acoustic feedback.
 *
 * The engine is framework-agnostic; React subscribes through `subscribe/getSnapshot`
 * (compatible with `useSyncExternalStore`).
 */
export class AudioEngine {
  /** Multiplier applied to the bass band (exposed to the settings panel). */
  sensitivity = 1.4;

  private ctx: AudioContext | null = null;
  private inputBus: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private monitor: GainNode | null = null;
  private master: GainNode | null = null;
  private extractor: FeatureExtractor | null = null;

  private synth: SynthwaveSynth | null = null;
  private mediaEl: HTMLAudioElement | null = null;
  private mediaNode: MediaElementAudioSourceNode | null = null;
  private objectUrl: string | null = null;
  private micStream: MediaStream | null = null;
  private micNode: MediaStreamAudioSourceNode | null = null;

  private autoPausedByVisibility = false;
  private readonly listeners = new Set<EngineListener>();
  private readonly idleFeatures: AudioFeatures = {
    bass: 0,
    mid: 0,
    treble: 0,
    energy: 0,
    beat: 0,
    beatCount: 0,
    spectrum: new Uint8Array(FFT_SIZE / 2),
  };

  private snapshot: EngineSnapshot = {
    contextState: 'uninitialized',
    source: 'none',
    trackName: 'Sin pista',
    isPlaying: false,
    duration: 0,
    volume: 0.8,
    error: null,
  };

  constructor() {
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  // ------------------------------------------------------------ store contract

  readonly subscribe = (listener: EngineListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): EngineSnapshot => this.snapshot;

  private patch(partial: Partial<EngineSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    for (const l of this.listeners) l(this.snapshot);
  }

  // --------------------------------------------------------------- per-frame

  /** Latest features (shared object, mutated in place by `update`). */
  get features(): AudioFeatures {
    return this.extractor?.features ?? this.idleFeatures;
  }

  /** Call once per animation frame (the 3D loop does this before any scene reads features). */
  update(nowMs: number): AudioFeatures {
    const ex = this.extractor;
    if (!ex) return this.idleFeatures;
    const flowing = this.snapshot.isPlaying && this.ctx?.state === 'running';
    return flowing ? ex.update(this.sensitivity, nowMs) : ex.decay();
  }

  /** Current playhead in seconds. */
  getPosition(): number {
    if (this.snapshot.source === 'file' && this.mediaEl) return this.mediaEl.currentTime;
    if (this.snapshot.source === 'synth' && this.synth) return this.synth.position;
    return 0;
  }

  // ----------------------------------------------------------------- sources

  /** Starts the procedural synthwave demo — works instantly, no downloads. */
  async playSynth(): Promise<void> {
    const ctx = this.ensureContext();
    this.teardownSource();
    const synth = new SynthwaveSynth(ctx);
    synth.output.connect(this.requireNode(this.inputBus));
    this.setMonitor(1);
    this.synth = synth;
    synth.start();
    this.patch({
      source: 'synth',
      trackName: SynthwaveSynth.title,
      duration: synth.duration,
      isPlaying: true,
      error: null,
    });
    await this.resume();
  }

  async loadFile(file: File): Promise<void> {
    if (!file.type.startsWith('audio/') && !ACCEPTED_EXTENSIONS.test(file.name)) {
      this.patch({ error: `"${file.name}" no es un archivo de audio compatible (MP3, WAV, OGG).` });
      return;
    }
    this.ensureContext();
    this.teardownSource();

    const el = this.getMediaElement();
    this.objectUrl = URL.createObjectURL(file);
    el.src = this.objectUrl;
    this.setMonitor(1);
    this.patch({
      source: 'file',
      trackName: file.name.replace(/\.[^.]+$/, ''),
      duration: 0,
      isPlaying: true,
      error: null,
    });

    try {
      await this.resume();
      await el.play();
    } catch (err) {
      this.patch({ isPlaying: false, error: `No se pudo reproducir el archivo: ${describeError(err)}` });
    }
  }

  async startMic(): Promise<void> {
    this.ensureContext();
    if (!navigator.mediaDevices?.getUserMedia) {
      this.patch({ error: 'Este navegador no soporta captura de micrófono (se requiere HTTPS o localhost).' });
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (err) {
      const denied = err instanceof DOMException && err.name === 'NotAllowedError';
      this.patch({
        error: denied ? 'Permiso de micrófono denegado.' : `Error de micrófono: ${describeError(err)}`,
      });
      return;
    }

    const ctx = this.ensureContext();
    this.teardownSource();
    this.micStream = stream;
    this.micNode = ctx.createMediaStreamSource(stream);
    this.micNode.connect(this.requireNode(this.inputBus));
    this.setMonitor(0); // never route the mic back to the speakers
    const label = stream.getAudioTracks()[0]?.label;
    this.patch({
      source: 'mic',
      trackName: label ? `Micrófono · ${label}` : 'Micrófono en vivo',
      duration: Infinity,
      isPlaying: true,
      error: null,
    });
    await this.resume();
  }

  // --------------------------------------------------------------- transport

  async play(): Promise<void> {
    if (this.snapshot.source === 'none') return this.playSynth();
    this.ensureContext();
    this.autoPausedByVisibility = false;
    this.patch({ isPlaying: true });
    await this.resume();
    if (this.snapshot.source === 'file' && this.mediaEl) {
      try {
        await this.mediaEl.play();
      } catch (err) {
        this.patch({ isPlaying: false, error: describeError(err) });
      }
    }
  }

  /** Pauses the source and suspends the AudioContext to release the audio thread. */
  async pause(): Promise<void> {
    this.mediaEl?.pause();
    this.patch({ isPlaying: false });
    if (this.ctx?.state === 'running') await this.ctx.suspend();
  }

  togglePlay(): Promise<void> {
    return this.snapshot.isPlaying ? this.pause() : this.play();
  }

  seek(seconds: number): void {
    if (this.snapshot.source === 'file' && this.mediaEl && Number.isFinite(this.mediaEl.duration)) {
      this.mediaEl.currentTime = Math.min(Math.max(0, seconds), this.mediaEl.duration);
    } else if (this.snapshot.source === 'synth' && this.synth) {
      this.synth.seek(seconds);
    }
  }

  setVolume(volume: number): void {
    const v = Math.min(1, Math.max(0, volume));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    this.patch({ volume: v });
  }

  clearError(): void {
    this.patch({ error: null });
  }

  /** Full teardown — closes the AudioContext and releases every resource. */
  async dispose(): Promise<void> {
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.teardownSource();
    this.mediaNode?.disconnect();
    this.mediaNode = null;
    if (this.mediaEl) {
      this.mediaEl.onended = null;
      this.mediaEl.onloadedmetadata = null;
      this.mediaEl = null;
    }
    for (const node of [this.inputBus, this.analyser, this.monitor, this.master]) node?.disconnect();
    const ctx = this.ctx;
    this.ctx = null;
    this.extractor = null;
    if (ctx && ctx.state !== 'closed') await ctx.close();
    this.listeners.clear();
  }

  // ---------------------------------------------------------------- internals

  /**
   * Lazily creates the AudioContext. Must be invoked synchronously from a user
   * gesture handler so browsers' autoplay policies allow it to start running.
   */
  private ensureContext(): AudioContext {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    const ctx = new AudioContext({ latencyHint: 'interactive' });

    const inputBus = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.78;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -12;
    const monitor = ctx.createGain();
    const master = ctx.createGain();
    master.gain.value = this.snapshot.volume;

    inputBus.connect(analyser);
    analyser.connect(monitor);
    monitor.connect(master);
    master.connect(ctx.destination);

    ctx.onstatechange = () => this.patch({ contextState: ctx.state });

    this.ctx = ctx;
    this.inputBus = inputBus;
    this.analyser = analyser;
    this.monitor = monitor;
    this.master = master;
    this.extractor = new FeatureExtractor(analyser, ctx.sampleRate);
    this.patch({ contextState: ctx.state });
    void ctx.resume();
    return ctx;
  }

  private async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
  }

  private setMonitor(value: number): void {
    if (this.monitor && this.ctx) this.monitor.gain.setValueAtTime(value, this.ctx.currentTime);
  }

  private requireNode<T extends AudioNode>(node: T | null): T {
    if (!node) throw new Error('AudioEngine: audio graph not initialised');
    return node;
  }

  /** A single <audio> element is reused because `createMediaElementSource` can only be called once per element. */
  private getMediaElement(): HTMLAudioElement {
    if (this.mediaEl) return this.mediaEl;
    const ctx = this.ensureContext();
    const el = new Audio();
    el.preload = 'auto';
    el.onloadedmetadata = () => this.patch({ duration: el.duration });
    el.onended = () => {
      this.patch({ isPlaying: false });
      void this.ctx?.suspend();
    };
    this.mediaNode = ctx.createMediaElementSource(el);
    this.mediaNode.connect(this.requireNode(this.inputBus));
    this.mediaEl = el;
    return el;
  }

  /** Stops whatever source is active and frees its resources (object URLs, mic tracks, synth graph). */
  private teardownSource(): void {
    if (this.synth) {
      this.synth.dispose();
      this.synth = null;
    }
    if (this.mediaEl) {
      this.mediaEl.pause();
      this.mediaEl.removeAttribute('src');
      this.mediaEl.load();
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    if (this.micNode) {
      this.micNode.disconnect();
      this.micNode = null;
    }
    if (this.micStream) {
      for (const track of this.micStream.getTracks()) track.stop();
      this.micStream = null;
    }
    this.patch({ source: 'none', isPlaying: false, duration: 0 });
  }

  /** Suspends audio while the tab is hidden (background timers are throttled anyway) and resumes on return. */
  private readonly handleVisibility = (): void => {
    if (document.hidden) {
      if (this.snapshot.isPlaying && this.snapshot.source !== 'mic') {
        this.autoPausedByVisibility = true;
        void this.pause();
      }
    } else if (this.autoPausedByVisibility) {
      this.autoPausedByVisibility = false;
      void this.play();
    }
  };
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
