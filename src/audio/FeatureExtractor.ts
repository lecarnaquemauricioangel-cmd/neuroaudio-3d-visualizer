import type { AudioFeatures } from './types';

interface BandRange {
  from: number;
  to: number;
}

const BASS_HZ: BandRange = { from: 20, to: 250 };
const MID_HZ: BandRange = { from: 250, to: 4000 };
const TREBLE_HZ: BandRange = { from: 4000, to: 16000 };

/** Envelope follower: fast attack, slower release — keeps visuals punchy but not jittery. */
function follow(current: number, target: number, attack: number, release: number): number {
  const k = target > current ? attack : release;
  return current + (target - current) * k;
}

/**
 * Turns raw AnalyserNode buffers into normalised musical features
 * (bass / mid / treble / energy) plus a simple adaptive beat detector.
 */
export class FeatureExtractor {
  readonly features: AudioFeatures;

  private readonly timeData: Float32Array<ArrayBuffer>;
  private readonly bins: Record<'bass' | 'mid' | 'treble', [number, number]>;

  private bassHistory: number[] = [];
  private lastBeatAt = 0;

  constructor(
    private readonly analyser: AnalyserNode,
    sampleRate: number,
  ) {
    const binCount = analyser.frequencyBinCount;
    const hzPerBin = sampleRate / analyser.fftSize;
    const toBins = (r: BandRange): [number, number] => [
      Math.max(1, Math.floor(r.from / hzPerBin)),
      Math.min(binCount - 1, Math.ceil(r.to / hzPerBin)),
    ];

    this.bins = { bass: toBins(BASS_HZ), mid: toBins(MID_HZ), treble: toBins(TREBLE_HZ) };
    this.timeData = new Float32Array(analyser.fftSize);
    this.features = {
      bass: 0,
      mid: 0,
      treble: 0,
      energy: 0,
      beat: 0,
      beatCount: 0,
      spectrum: new Uint8Array(binCount),
    };
  }

  /**
   * Samples the analyser and updates `features` in place (zero allocations per frame).
   * @param sensitivity multiplier applied to the bass band (user setting)
   * @param nowMs high-resolution timestamp used for beat cooldown
   */
  update(sensitivity: number, nowMs: number): AudioFeatures {
    const f = this.features;
    this.analyser.getByteFrequencyData(f.spectrum);
    this.analyser.getFloatTimeDomainData(this.timeData);

    const bassRaw = Math.min(1, this.bandAverage(this.bins.bass) * sensitivity);
    const midRaw = this.bandAverage(this.bins.mid) * 1.25;
    // High frequencies carry less energy in most mixes, so we lift them.
    const trebleRaw = this.bandAverage(this.bins.treble) * 1.8;

    let sumSquares = 0;
    for (let i = 0; i < this.timeData.length; i++) sumSquares += this.timeData[i] * this.timeData[i];
    const rms = Math.sqrt(sumSquares / this.timeData.length);

    f.bass = follow(f.bass, bassRaw, 0.55, 0.12);
    f.mid = follow(f.mid, Math.min(1, midRaw), 0.45, 0.1);
    f.treble = follow(f.treble, Math.min(1, trebleRaw), 0.6, 0.15);
    f.energy = follow(f.energy, Math.min(1, rms * 3.2), 0.4, 0.08);

    this.detectBeat(bassRaw, nowMs);
    return f;
  }

  /** Called when no audio is flowing so visuals relax smoothly to idle. */
  decay(): AudioFeatures {
    const f = this.features;
    f.bass *= 0.92;
    f.mid *= 0.92;
    f.treble *= 0.92;
    f.energy *= 0.92;
    f.beat *= 0.9;
    for (let i = 0; i < f.spectrum.length; i++) f.spectrum[i] = Math.floor(f.spectrum[i] * 0.9);
    return f;
  }

  private bandAverage([start, end]: [number, number]): number {
    const s = this.features.spectrum;
    let sum = 0;
    for (let i = start; i <= end; i++) sum += s[i];
    return sum / ((end - start + 1) * 255);
  }

  /** Adaptive threshold beat detection over ~1s of bass history. */
  private detectBeat(bass: number, nowMs: number): void {
    const f = this.features;
    const history = this.bassHistory;
    history.push(bass);
    if (history.length > 60) history.shift();

    let mean = 0;
    for (const v of history) mean += v;
    mean /= history.length;

    const isOnset = bass > mean * 1.18 && bass > 0.25 && nowMs - this.lastBeatAt > 230;
    if (isOnset) {
      this.lastBeatAt = nowMs;
      f.beat = 1;
      f.beatCount++;
    } else {
      f.beat *= 0.9;
    }
  }
}
