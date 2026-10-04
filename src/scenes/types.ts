import type { AudioEngine } from '../audio/AudioEngine';
import type { AnimatedPalette } from './animatedPalette';

/** Props shared by every visualisation scene. */
export interface SceneProps {
  engine: AudioEngine;
  colors: AnimatedPalette;
  /** Global animation speed multiplier from the settings panel. */
  speed: number;
  autoRotate: boolean;
}
