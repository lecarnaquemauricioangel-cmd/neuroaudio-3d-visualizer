import type { PaletteId } from './palettes';

export type SceneId = 'sphere' | 'terrain' | 'tunnel';

export interface SceneInfo {
  id: SceneId;
  name: string;
  description: string;
  hotkey: string;
}

export const SCENES: SceneInfo[] = [
  {
    id: 'sphere',
    name: 'Neural Particle Sphere',
    description: 'Miles de partículas con ruido 3D que respiran con los graves.',
    hotkey: '1',
  },
  {
    id: 'terrain',
    name: 'Cyberpunk Neon Grid',
    description: 'Terreno alámbrico infinito esculpido por el historial del espectro.',
    hotkey: '2',
  },
  {
    id: 'tunnel',
    name: 'Tunnel Vortice',
    description: 'Anillos neón que se expanden y giran al ritmo del beat.',
    hotkey: '3',
  },
];

export interface VisualizerSettings {
  scene: SceneId;
  palette: PaletteId;
  /** Multiplier for the bass band, 0.5 – 3. */
  bassSensitivity: number;
  /** Global animation speed multiplier, 0.2 – 3. */
  animationSpeed: number;
  autoRotate: boolean;
  /** Base bloom strength, 0 – 3. */
  bloomStrength: number;
  /** Camera shake / FOV kick on beats. */
  cameraFx: boolean;
}

export const DEFAULT_SETTINGS: VisualizerSettings = {
  scene: 'sphere',
  palette: 'cyber',
  bassSensitivity: 1.4,
  animationSpeed: 1,
  autoRotate: true,
  bloomStrength: 1.2,
  cameraFx: true,
};
