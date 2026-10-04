import { SCENES, type SceneId } from '../config/settings';
import { cn } from '../utils/format';
import { SCENE_ICONS } from './sceneIcons';

interface SceneSwitcherProps {
  scene: SceneId;
  onChange: (scene: SceneId) => void;
}

/** Quick segmented control for the three visualisation modes. */
export function SceneSwitcher({ scene, onChange }: SceneSwitcherProps) {
  return (
    <nav className="glass pointer-events-auto flex gap-1 rounded-2xl p-1" aria-label="Modo de visualización">
      {SCENES.map((s) => {
        const Icon = SCENE_ICONS[s.id];
        const active = s.id === scene;
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={active}
            title={`${s.name} (${s.hotkey})`}
            onClick={() => onChange(s.id)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold tracking-wide transition',
              active ? 'neon-gradient text-black' : 'text-white/60 hover:bg-white/[0.06] hover:text-white',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">{s.name}</span>
          </button>
        );
      })}
    </nav>
  );
}
