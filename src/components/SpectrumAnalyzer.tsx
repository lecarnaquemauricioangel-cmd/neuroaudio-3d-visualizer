import { useEffect, useRef } from 'react';
import type { AudioEngine } from '../audio/AudioEngine';
import type { Palette } from '../config/palettes';
import { useAnimationFrame } from '../hooks/useAnimationFrame';

interface SpectrumAnalyzerProps {
  engine: AudioEngine;
  palette: Palette;
}

const BAR_COUNT = 72;
const METERS = [
  { key: 'bass', label: 'BASS' },
  { key: 'mid', label: 'MID' },
  { key: 'treble', label: 'HIGH' },
  { key: 'energy', label: 'NRG' },
] as const;

/**
 * Visual equaliser: log-scaled 2D-canvas bars + band meters.
 * Reads the shared feature buffer every frame and writes straight to the DOM/canvas
 * (no React state), so it costs zero re-renders.
 */
export function SpectrumAnalyzer({ engine, palette }: SpectrumAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const meterRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const peaks = useRef(new Float32Array(BAR_COUNT));
  const bins = useRef<Array<[number, number]>>([]);

  // Precompute log-spaced bin ranges.
  useEffect(() => {
    const len = engine.features.spectrum.length;
    const maxBin = Math.floor(len * 0.7);
    const edge = (i: number) => Math.floor(Math.pow(maxBin, i / BAR_COUNT));
    bins.current = Array.from({ length: BAR_COUNT }, (_, i) => {
      const start = Math.max(1, edge(i));
      return [start, Math.max(start, edge(i + 1) - 1)];
    });
  }, [engine]);

  // Keep the backing store matched to the element size × DPR.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useAnimationFrame(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || bins.current.length === 0) return;
    const f = engine.features;
    const { width, height } = canvas;

    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, palette.primary);
    gradient.addColorStop(0.65, palette.secondary);
    gradient.addColorStop(1, palette.accent);

    const gap = Math.max(1, width / BAR_COUNT / 4);
    const barWidth = width / BAR_COUNT - gap;
    ctx.shadowColor = palette.primary;
    ctx.shadowBlur = 8;

    for (let i = 0; i < BAR_COUNT; i++) {
      const [start, end] = bins.current[i];
      let sum = 0;
      for (let b = start; b <= end; b++) sum += f.spectrum[b];
      const value = sum / (end - start + 1) / 255;
      const h = Math.max(2, value * value * height * 1.05);
      const x = i * (barWidth + gap) + gap / 2;

      ctx.fillStyle = gradient;
      ctx.fillRect(x, height - h, barWidth, h);

      // Falling peak caps.
      const peak = Math.max(value, peaks.current[i] - 0.008);
      peaks.current[i] = peak;
      ctx.fillStyle = palette.accent;
      ctx.fillRect(x, height - peak * peak * height * 1.05 - 3, barWidth, 2);
    }
    ctx.shadowBlur = 0;

    METERS.forEach((meter, i) => {
      const el = meterRefs.current[i];
      if (el) el.style.transform = `scaleX(${Math.min(1, f[meter.key]).toFixed(3)})`;
    });
  });

  return (
    <div className="flex items-end gap-4">
      <canvas ref={canvasRef} className="h-14 min-w-0 flex-1" aria-label="Ecualizador visual de frecuencias" role="img" />
      <div className="hidden w-32 shrink-0 space-y-1.5 md:block">
        {METERS.map((meter, i) => (
          <div key={meter.key} className="flex items-center gap-2 font-mono text-[9px] text-white/45">
            <span className="w-8">{meter.label}</span>
            <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
              <span
                ref={(el) => {
                  meterRefs.current[i] = el;
                }}
                className="neon-gradient absolute inset-0 origin-left rounded-full"
                style={{ transform: 'scaleX(0)' }}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
