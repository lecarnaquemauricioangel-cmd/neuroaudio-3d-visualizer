import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { AudioEngine } from '../audio/AudioEngine';
import type { Palette } from '../config/palettes';
import { lerpPalette, type AnimatedPalette } from './animatedPalette';

/**
 * Runs first in every frame (priority -2, before OrbitControls at -1 and the scenes at 0):
 * samples the analyser once and eases the live palette toward the selected one.
 */
export function AudioFrameDriver({
  engine,
  colors,
  palette,
}: {
  engine: AudioEngine;
  colors: AnimatedPalette;
  palette: Palette;
}) {
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    // Live reference: the background follows the lerped colour without extra work.
    scene.background = colors.background;
    return () => {
      scene.background = null;
    };
  }, [scene, colors]);

  useFrame((_, delta) => {
    engine.update(performance.now());
    lerpPalette(colors, palette, delta);
  }, -2);

  return null;
}

/** Measures the real render loop rate (frames actually drawn by R3F), reported twice per second. */
export function FpsProbe({ onFps }: { onFps: (fps: number) => void }) {
  const frames = useRef(0);
  const since = useRef(performance.now());

  useFrame(() => {
    frames.current++;
    const now = performance.now();
    const elapsed = now - since.current;
    if (elapsed >= 500) {
      onFps(Math.round((frames.current * 1000) / elapsed));
      frames.current = 0;
      since.current = now;
    }
  });

  return null;
}
