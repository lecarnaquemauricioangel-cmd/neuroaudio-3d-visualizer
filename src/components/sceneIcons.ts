import { Mountain, Orbit, Tornado, type LucideIcon } from 'lucide-react';
import type { SceneId } from '../config/settings';

export const SCENE_ICONS: Record<SceneId, LucideIcon> = {
  sphere: Orbit,
  terrain: Mountain,
  tunnel: Tornado,
};
