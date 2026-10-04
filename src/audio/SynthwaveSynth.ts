/**
 * Procedural synthwave / cyberpunk groove generated entirely with Web Audio nodes.
 * No samples are downloaded: drums are shaped noise + pitched sines, pads are
 * detuned sawtooth stacks with sidechain "pumping", and the arp feeds a dotted delay.
 *
 * Scheduling uses the classic "lookahead" pattern: a coarse JS timer queues notes
 * slightly ahead of `AudioContext.currentTime`, so timing stays sample-accurate even
 * when the main thread is busy rendering WebGL.
 */

const BPM = 104;
const STEPS_PER_BEAT = 4; // 16th notes
const STEPS_PER_BAR = 16;
const BARS = 16;
const TOTAL_STEPS = STEPS_PER_BAR * BARS;
const LOOKAHEAD_S = 0.12;
const TIMER_MS = 25;

/** i – VI – III – VII in A minor: the quintessential synthwave progression. */
const PROGRESSION: ReadonlyArray<{ chord: number[]; root: number }> = [
  { chord: [57, 60, 64, 69], root: 45 }, // Am
  { chord: [53, 57, 60, 65], root: 41 }, // F
  { chord: [55, 60, 64, 67], root: 48 }, // C
  { chord: [55, 59, 62, 67], root: 43 }, // G
];

/** Arp pattern as indexes into the current chord (+12 = octave up). */
const ARP_PATTERN = [0, 1, 2, 3, 2 + 12, 1, 3, 0 + 12, 0, 2, 1 + 12, 3, 2, 0 + 12, 3, 1];
const BASS_PATTERN = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1];

const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

export class SynthwaveSynth {
  static readonly title = 'Neon Drive — Procedural Synthwave';

  /** Final output of the synth; connect it to the engine input bus. */
  readonly output: GainNode;

  private readonly ctx: AudioContext;
  private readonly bus: DynamicsCompressorNode;
  private readonly padBus: GainNode;
  private readonly delaySend: GainNode;
  private readonly delay: DelayNode;
  private readonly delayFeedback: GainNode;
  private readonly delayFilter: BiquadFilterNode;
  private readonly noise: AudioBuffer;

  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextNoteTime = 0;
  private anchorStep = 0;
  private anchorTime = 0;

  readonly stepDuration = 60 / BPM / STEPS_PER_BEAT;
  readonly duration = TOTAL_STEPS * (60 / BPM / STEPS_PER_BEAT);

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    this.output = ctx.createGain();
    this.output.gain.value = 0.9;

    this.bus = ctx.createDynamicsCompressor();
    this.bus.threshold.value = -14;
    this.bus.ratio.value = 4;
    this.bus.attack.value = 0.005;
    this.bus.release.value = 0.18;
    this.bus.connect(this.output);

    this.padBus = ctx.createGain();
    this.padBus.connect(this.bus);

    // Dotted-eighth feedback delay (3 sixteenths) for the arp.
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.35;
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = this.stepDuration * 3;
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.38;
    this.delayFilter = ctx.createBiquadFilter();
    this.delayFilter.type = 'lowpass';
    this.delayFilter.frequency.value = 2400;
    this.delaySend.connect(this.delay);
    this.delay.connect(this.delayFilter);
    this.delayFilter.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delayFilter.connect(this.bus);

    this.noise = this.createNoiseBuffer();
  }

  get isRunning(): boolean {
    return this.timer !== null;
  }

  /** Current playhead in seconds (freezes automatically while the context is suspended). */
  get position(): number {
    if (!this.isRunning) return this.step * this.stepDuration;
    const elapsed = Math.max(0, this.ctx.currentTime - this.anchorTime);
    return (this.anchorStep * this.stepDuration + elapsed) % this.duration;
  }

  start(): void {
    if (this.timer !== null) return;
    this.resetAnchor(this.step);
    this.timer = setInterval(() => this.tick(), TIMER_MS);
    this.tick();
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  seek(seconds: number): void {
    const target = Math.floor(seconds / this.stepDuration);
    this.step = ((target % TOTAL_STEPS) + TOTAL_STEPS) % TOTAL_STEPS;
    if (this.isRunning) this.resetAnchor(this.step);
  }

  /** Stops scheduling and tears down the static part of the graph. */
  dispose(): void {
    this.stop();
    this.output.gain.cancelScheduledValues(this.ctx.currentTime);
    for (const node of [
      this.output,
      this.bus,
      this.padBus,
      this.delaySend,
      this.delay,
      this.delayFeedback,
      this.delayFilter,
    ]) {
      node.disconnect();
    }
  }

  // ---------------------------------------------------------------- scheduling

  private resetAnchor(step: number): void {
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.anchorStep = step;
    this.anchorTime = this.nextNoteTime;
  }

  private tick(): void {
    const horizon = this.ctx.currentTime + LOOKAHEAD_S;
    while (this.nextNoteTime < horizon) {
      this.scheduleStep(this.step, this.nextNoteTime);
      this.nextNoteTime += this.stepDuration;
      this.step = (this.step + 1) % TOTAL_STEPS;
      if (this.step === 0) {
        this.anchorStep = 0;
        this.anchorTime = this.nextNoteTime;
      }
    }
  }

  private scheduleStep(step: number, t: number): void {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const s = step % STEPS_PER_BAR;
    const { chord, root } = PROGRESSION[bar % PROGRESSION.length];
    const intro = bar < 4;
    const withArp = bar >= 8;
    const barLength = this.stepDuration * STEPS_PER_BAR;

    if (s === 0) this.pad(t, chord, barLength);

    // Four-on-the-floor kick with sidechain pump on the pad bus.
    if (!intro && s % 4 === 0) {
      this.kick(t);
      this.pump(t);
    }
    if (!intro && (s === 4 || s === 12)) this.snare(t);
    if (s % 2 === 1 || (intro && s % 4 === 2)) this.hat(t, s === 14 && !intro);

    if (BASS_PATTERN[s] === 1 && (!intro || s % 4 === 0)) {
      const octave = s % 8 === 6 ? 12 : 0;
      this.bass(t, root + octave, this.stepDuration * 0.9);
    }

    if (withArp) {
      const idx = ARP_PATTERN[s];
      const note = chord[idx % 12 % chord.length] + (idx >= 12 ? 12 : 0) + 12;
      this.arp(t, note);
    }
  }

  // -------------------------------------------------------------------- voices

  private kick(t: number): void {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    gain.gain.setValueAtTime(1.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    osc.connect(gain).connect(this.bus);
    this.play(osc, t, t + 0.45, [gain]);
  }

  private snare(t: number): void {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(bp).connect(gain).connect(this.bus);
    this.play(src, t, t + 0.25, [bp, gain]);

    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(220, t);
    body.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    bodyGain.gain.setValueAtTime(0.35, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    body.connect(bodyGain).connect(this.bus);
    this.play(body, t, t + 0.12, [bodyGain]);
  }

  private hat(t: number, open: boolean): void {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    const gain = ctx.createGain();
    const len = open ? 0.22 : 0.05;
    gain.gain.setValueAtTime(open ? 0.14 : 0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(hp).connect(gain).connect(this.bus);
    this.play(src, t, t + len + 0.02, [hp, gain]);
  }

  private bass(t: number, midi: number, dur: number): void {
    const { ctx } = this;
    const saw = ctx.createOscillator();
    const sub = ctx.createOscillator();
    saw.type = 'sawtooth';
    sub.type = 'sine';
    saw.frequency.value = midiToHz(midi);
    sub.frequency.value = midiToHz(midi - 12);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.32, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    saw.connect(lp);
    sub.connect(lp);
    lp.connect(gain).connect(this.bus);
    this.play(saw, t, t + dur + 0.02, [lp, gain]);
    this.play(sub, t, t + dur + 0.02, []);
  }

  private pad(t: number, chord: number[], dur: number): void {
    const { ctx } = this;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(600, t);
    lp.frequency.linearRampToValueAtTime(2200, t + dur * 0.5);
    lp.frequency.linearRampToValueAtTime(900, t + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.06, t + 0.35);
    gain.gain.setValueAtTime(0.06, t + dur - 0.25);
    gain.gain.linearRampToValueAtTime(0.0001, t + dur + 0.1);
    lp.connect(gain).connect(this.padBus);

    const end = t + dur + 0.15;
    chord.forEach((note, i) => {
      for (const detune of [-9, 9]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = midiToHz(note);
        osc.detune.value = detune;
        osc.connect(lp);
        // Only the very last voice owns the shared filter/gain cleanup.
        const owns = i === chord.length - 1 && detune > 0;
        this.play(osc, t, end, owns ? [lp, gain] : []);
      }
    });
  }

  private arp(t: number, midi: number): void {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = midiToHz(midi);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4200, t);
    lp.frequency.exponentialRampToValueAtTime(900, t + 0.16);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.055, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(lp).connect(gain);
    gain.connect(this.bus);
    gain.connect(this.delaySend);
    this.play(osc, t, t + 0.2, [lp, gain]);
  }

  /** Sidechain-style ducking of the pads on every kick. */
  private pump(t: number): void {
    const g = this.padBus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.3, t);
    g.linearRampToValueAtTime(1, t + this.stepDuration * 3.2);
  }

  /** Starts a source and disconnects its private nodes when it ends (no graph leaks). */
  private play(source: AudioScheduledSourceNode, start: number, stop: number, chain: AudioNode[]): void {
    source.onended = () => {
      source.disconnect();
      for (const node of chain) node.disconnect();
    };
    source.start(start);
    source.stop(stop);
  }

  private createNoiseBuffer(): AudioBuffer {
    const length = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}
