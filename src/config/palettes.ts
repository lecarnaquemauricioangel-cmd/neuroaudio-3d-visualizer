export type PaletteId = 'cyber' | 'synthwave' | 'toxic' | 'aurora';

export interface Palette {
  id: PaletteId;
  name: string;
  /** Main neon colour (low energy). */
  primary: string;
  /** Secondary neon colour (high energy / accents). */
  secondary: string;
  /** Hot accent used on beats. */
  accent: string;
  /** Scene clear colour / fog. */
  background: string;
}

export const PALETTES: Record<PaletteId, Palette> = {
  cyber: {
    id: 'cyber',
    name: 'Cyber Neón',
    primary: '#00f0ff',
    secondary: '#b026ff',
    accent: '#ff2bd6',
    background: '#04030b',
  },
  synthwave: {
    id: 'synthwave',
    name: 'Synthwave Sunset',
    primary: '#ff2e88',
    secondary: '#ff9e2c',
    accent: '#fff36b',
    background: '#0b0410',
  },
  toxic: {
    id: 'toxic',
    name: 'Toxic Matrix',
    primary: '#39ff14',
    secondary: '#00c2a8',
    accent: '#e6ff4f',
    background: '#020805',
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora Ice',
    primary: '#7df9ff',
    secondary: '#5b6cff',
    accent: '#c8fff4',
    background: '#03060d',
  },
};

export const PALETTE_LIST: Palette[] = Object.values(PALETTES);
