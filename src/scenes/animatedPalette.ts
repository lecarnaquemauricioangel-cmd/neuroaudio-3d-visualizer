import { Color } from 'three';
import type { Palette } from '../config/palettes';

/**
 * Live colour set shared by every scene. Shader uniforms hold *references* to these
 * Color instances, so lerping them once per frame recolours everything smoothly.
 */
export interface AnimatedPalette {
  primary: Color;
  secondary: Color;
  accent: Color;
  background: Color;
}

export function createAnimatedPalette(p: Palette): AnimatedPalette {
  return {
    primary: new Color(p.primary),
    secondary: new Color(p.secondary),
    accent: new Color(p.accent),
    background: new Color(p.background),
  };
}

const scratch = new Color();

/** Frame-rate independent exponential approach toward the target palette. */
export function lerpPalette(current: AnimatedPalette, target: Palette, delta: number): void {
  const t = 1 - Math.exp(-delta * 3);
  current.primary.lerp(scratch.set(target.primary), t);
  current.secondary.lerp(scratch.set(target.secondary), t);
  current.accent.lerp(scratch.set(target.accent), t);
  current.background.lerp(scratch.set(target.background), t);
}
