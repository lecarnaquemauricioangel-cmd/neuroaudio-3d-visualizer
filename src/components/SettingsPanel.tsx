import type { ReactNode } from 'react';
import { Keyboard, RotateCcw, X } from 'lucide-react';
import { PALETTE_LIST } from '../config/palettes';
import { SCENES, type VisualizerSettings } from '../config/settings';
import { cn } from '../utils/format';
import { SCENE_ICONS } from './sceneIcons';
import { Slider } from './ui/Slider';
import { Toggle } from './ui/Toggle';

interface SettingsPanelProps {
  open: boolean;
  settings: VisualizerSettings;
  onChange: (patch: Partial<VisualizerSettings>) => void;
  onReset: () => void;
  onClose: () => void;
}

const SHORTCUTS: Array<[string, string]> = [
  ['Espacio', 'Play / Pausa'],
  ['1 · 2 · 3', 'Cambiar escena'],
  ['P', 'Siguiente paleta'],
  ['S', 'Panel de ajustes'],
  ['H', 'Ocultar interfaz'],
  ['F', 'Pantalla completa'],
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[10px] font-semibold tracking-[0.25em] text-white/40 uppercase">{title}</h3>
      {children}
    </section>
  );
}

export function SettingsPanel({ open, settings, onChange, onReset, onClose }: SettingsPanelProps) {
  return (
    <aside
      aria-label="Ajustes del visualizador"
      aria-hidden={!open}
      inert={!open}
      className={cn(
        'glass pointer-events-auto fixed top-20 right-4 bottom-4 z-30 flex w-[min(20rem,calc(100vw-2rem))] flex-col rounded-2xl',
        'transition-[transform,opacity] duration-300 ease-out sm:right-5',
        open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-[110%] opacity-0',
      )}
    >
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <h2 className="font-display text-xs font-semibold tracking-[0.2em]">AJUSTES</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/5 hover:text-white"
            aria-label="Restablecer ajustes"
            title="Restablecer ajustes"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/5 hover:text-white"
            aria-label="Cerrar ajustes"
            title="Cerrar ajustes"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4 [scrollbar-width:thin]">
        <Section title="Escena 3D">
          <div className="space-y-2">
            {SCENES.map((scene) => {
              const Icon = SCENE_ICONS[scene.id];
              const active = settings.scene === scene.id;
              return (
                <button
                  key={scene.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ scene: scene.id })}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border p-2.5 text-left transition',
                    active
                      ? 'neon-ring border-transparent bg-white/[0.07]'
                      : 'border-white/[0.06] hover:border-white/15 hover:bg-white/[0.04]',
                  )}
                >
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', active ? 'text-[var(--accent-a)]' : 'text-white/50')} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between text-xs font-semibold text-white/90">
                      {scene.name}
                      <kbd className="font-mono text-[10px] text-white/35">{scene.hotkey}</kbd>
                    </span>
                    <span className="block text-[11px] leading-snug text-white/40">{scene.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Paleta de color">
          <div className="grid grid-cols-2 gap-2">
            {PALETTE_LIST.map((p) => {
              const active = settings.palette === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ palette: p.id })}
                  className={cn(
                    'rounded-xl border p-2 text-left transition',
                    active ? 'neon-ring border-transparent' : 'border-white/[0.06] hover:border-white/15',
                  )}
                >
                  <span
                    className="block h-6 rounded-md"
                    style={{ background: `linear-gradient(90deg, ${p.primary}, ${p.secondary} 65%, ${p.accent})` }}
                  />
                  <span className="mt-1.5 block text-[11px] text-white/70">{p.name}</span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Reactividad y animación">
          <Slider
            label="Sensibilidad de graves"
            value={settings.bassSensitivity}
            min={0.5}
            max={3}
            step={0.05}
            format={(v) => `×${v.toFixed(2)}`}
            onChange={(bassSensitivity) => onChange({ bassSensitivity })}
            hint="Amplifica la banda 20–250 Hz que dirige pulsos y detección de beat."
          />
          <Slider
            label="Velocidad de animación"
            value={settings.animationSpeed}
            min={0.2}
            max={3}
            step={0.05}
            format={(v) => `×${v.toFixed(2)}`}
            onChange={(animationSpeed) => onChange({ animationSpeed })}
          />
          <Slider
            label="Intensidad de bloom"
            value={settings.bloomStrength}
            min={0}
            max={3}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(bloomStrength) => onChange({ bloomStrength })}
          />
        </Section>

        <Section title="Cámara">
          <Toggle
            label="Rotación automática"
            description="Órbita / balanceo / giro según la escena"
            checked={settings.autoRotate}
            onChange={(autoRotate) => onChange({ autoRotate })}
          />
          <Toggle
            label="Efectos de cámara al beat"
            description="FOV kick, sacudida y aberración cromática"
            checked={settings.cameraFx}
            onChange={(cameraFx) => onChange({ cameraFx })}
          />
        </Section>

        <Section title="Atajos de teclado">
          <ul className="space-y-1.5">
            {SHORTCUTS.map(([key, action]) => (
              <li key={key} className="flex items-center justify-between text-[11px] text-white/50">
                <span className="flex items-center gap-1.5">
                  <Keyboard className="h-3 w-3" />
                  {action}
                </span>
                <kbd className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-white/70">
                  {key}
                </kbd>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </aside>
  );
}
