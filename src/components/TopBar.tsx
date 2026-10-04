import { AudioWaveform, EyeOff, Maximize, Minimize, SlidersHorizontal } from 'lucide-react';
import type { EngineContextState } from '../audio/types';
import { cn } from '../utils/format';
import { IconButton } from './ui/IconButton';

interface TopBarProps {
  fps: number;
  contextState: EngineContextState;
  settingsOpen: boolean;
  isFullscreen: boolean;
  onToggleSettings: () => void;
  onToggleFullscreen: () => void;
  onHideUi: () => void;
}

const CONTEXT_LABEL: Record<EngineContextState, string> = {
  uninitialized: 'Sin iniciar',
  suspended: 'Suspendido',
  running: 'Activo',
  closed: 'Cerrado',
};

const CONTEXT_DOT: Record<EngineContextState, string> = {
  uninitialized: 'bg-white/40',
  suspended: 'bg-amber-400 shadow-[0_0_10px_var(--color-amber-400)]',
  running: 'bg-emerald-400 shadow-[0_0_10px_var(--color-emerald-400)]',
  closed: 'bg-rose-500',
};

function fpsColor(fps: number): string {
  if (fps >= 55) return 'text-emerald-300';
  if (fps >= 40) return 'text-amber-300';
  return 'text-rose-400';
}

export function TopBar({
  fps,
  contextState,
  settingsOpen,
  isFullscreen,
  onToggleSettings,
  onToggleFullscreen,
  onHideUi,
}: TopBarProps) {
  return (
    <header className="pointer-events-none flex items-start justify-between gap-4 p-4 sm:p-5">
      <div className="glass pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3">
        <div className="neon-gradient grid h-9 w-9 place-items-center rounded-xl text-black shadow-[0_0_24px_-4px_var(--accent-a)]">
          <AudioWaveform className="h-5 w-5" strokeWidth={2.4} />
        </div>
        <div className="leading-tight">
          <h1 className="font-display text-sm font-extrabold tracking-[0.2em] sm:text-base">
            NEURO<span className="neon-text">AUDIO</span> 3D
          </h1>
          <p className="text-[10px] tracking-[0.3em] text-white/45 uppercase">Visualizer &amp; Studio</p>
        </div>
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        <div className="glass hidden items-center gap-4 rounded-xl px-3.5 py-2.5 font-mono text-[11px] sm:flex">
          <span className="flex items-center gap-1.5" title="Frames por segundo reales del render loop">
            <span className="text-white/45">FPS</span>
            <span className={cn('w-6 text-right font-semibold tabular-nums', fpsColor(fps))}>{fps}</span>
          </span>
          <span className="h-4 w-px bg-white/10" />
          <span className="flex items-center gap-2" title="Estado del AudioContext">
            <span className={cn('h-2 w-2 rounded-full', CONTEXT_DOT[contextState])} />
            <span className="text-white/45">CTX</span>
            <span className="text-white/85">{CONTEXT_LABEL[contextState]}</span>
          </span>
        </div>
        <IconButton label="Ocultar interfaz (H)" onClick={onHideUi}>
          <EyeOff className="h-4 w-4" />
        </IconButton>
        <IconButton label={isFullscreen ? 'Salir de pantalla completa (F)' : 'Pantalla completa (F)'} onClick={onToggleFullscreen}>
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </IconButton>
        <IconButton label="Ajustes (S)" active={settingsOpen} onClick={onToggleSettings}>
          <SlidersHorizontal className="h-4 w-4" />
        </IconButton>
      </div>
    </header>
  );
}
