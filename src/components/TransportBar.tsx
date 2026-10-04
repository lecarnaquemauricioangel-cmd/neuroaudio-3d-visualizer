import { useState } from 'react';
import { Mic, Music, Pause, Play, Sparkles, Volume1, Volume2, VolumeX } from 'lucide-react';
import type { AudioEngine } from '../audio/AudioEngine';
import type { AudioSourceKind, EngineSnapshot } from '../audio/types';
import type { Palette } from '../config/palettes';
import { usePlaybackPosition } from '../hooks/usePlaybackPosition';
import { cn, formatTime } from '../utils/format';
import { SpectrumAnalyzer } from './SpectrumAnalyzer';

interface TransportBarProps {
  engine: AudioEngine;
  snapshot: EngineSnapshot;
  palette: Palette;
}

const SOURCE_META: Record<AudioSourceKind, { label: string; icon: typeof Music }> = {
  none: { label: 'Sin fuente', icon: Music },
  synth: { label: 'Sintetizador procedural', icon: Sparkles },
  file: { label: 'Archivo local', icon: Music },
  mic: { label: 'Micrófono en vivo', icon: Mic },
};

export function TransportBar({ engine, snapshot, palette }: TransportBarProps) {
  const { isPlaying, duration, source, trackName, volume } = snapshot;
  const isLive = source === 'mic';
  const seekable = !isLive && source !== 'none' && Number.isFinite(duration) && duration > 0;

  const position = usePlaybackPosition(engine, seekable);
  // While dragging, show the thumb where the user holds it instead of the live playhead.
  const [scrub, setScrub] = useState<number | null>(null);
  const shown = scrub ?? position;
  const progress = seekable ? Math.min(100, (shown / duration) * 100) : 0;

  const [lastVolume, setLastVolume] = useState(volume || 0.8);
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const SourceIcon = SOURCE_META[source].icon;

  const commitSeek = () => {
    if (scrub !== null) engine.seek(scrub);
    setScrub(null);
  };

  return (
    <section className="glass pointer-events-auto w-full space-y-3 rounded-2xl p-3 sm:p-4" aria-label="Controles de reproducción">
      <SpectrumAnalyzer engine={engine} palette={palette} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <button
          type="button"
          onClick={() => void engine.togglePlay()}
          aria-label={isPlaying ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}
          title={isPlaying ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}
          className="neon-gradient grid h-12 w-12 shrink-0 place-items-center rounded-full text-black shadow-[0_0_28px_-6px_var(--accent-a)] transition hover:brightness-110 active:scale-95"
        >
          {isPlaying ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="ml-0.5 h-5 w-5" fill="currentColor" />}
        </button>

        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate text-sm font-semibold text-white/95" title={trackName}>
            {trackName}
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-white/45">
            <SourceIcon className="h-3 w-3" />
            {SOURCE_META[source].label}
            {isPlaying && <span className="ml-1 h-1.5 w-1.5 animate-pulse-glow rounded-full bg-[var(--accent-a)]" />}
          </p>
        </div>

        <div className="order-last flex w-full items-center gap-3 font-mono text-[11px] text-white/55 md:order-none md:w-auto md:flex-[2]">
          {isLive ? (
            <span className="flex w-full items-center gap-2">
              <span className="rounded-md bg-rose-500/90 px-2 py-0.5 font-semibold tracking-widest text-white">EN VIVO</span>
              <span className="h-px flex-1 bg-gradient-to-r from-rose-500/60 to-transparent" />
            </span>
          ) : (
            <>
              <span className="w-10 text-right tabular-nums">{formatTime(shown)}</span>
              <input
                type="range"
                className={cn('range flex-1')}
                aria-label="Progreso de la pista"
                min={0}
                max={seekable ? duration : 1}
                step={0.01}
                value={seekable ? shown : 0}
                disabled={!seekable}
                style={{ '--fill': `${progress}%` }}
                onChange={(e) => setScrub(Number(e.target.value))}
                onPointerUp={commitSeek}
                onKeyUp={commitSeek}
                onBlur={() => setScrub(null)}
              />
              <span className="w-10 tabular-nums">{formatTime(seekable ? duration : 0)}</span>
            </>
          )}
        </div>

        <div className="flex w-36 items-center gap-2">
          <button
            type="button"
            className="text-white/70 transition hover:text-white"
            aria-label={volume === 0 ? 'Activar sonido' : 'Silenciar'}
            title={volume === 0 ? 'Activar sonido' : 'Silenciar'}
            onClick={() => {
              if (volume === 0) engine.setVolume(lastVolume);
              else {
                setLastVolume(volume);
                engine.setVolume(0);
              }
            }}
          >
            <VolumeIcon className="h-4 w-4" />
          </button>
          <input
            type="range"
            className="range"
            aria-label="Volumen"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            style={{ '--fill': `${volume * 100}%` }}
            onChange={(e) => engine.setVolume(Number(e.target.value))}
          />
        </div>
      </div>
      {isLive && (
        <p className="text-[11px] text-white/35">
          El micrófono solo alimenta al analizador: no se reproduce por los altavoces para evitar acoples.
        </p>
      )}
    </section>
  );
}
