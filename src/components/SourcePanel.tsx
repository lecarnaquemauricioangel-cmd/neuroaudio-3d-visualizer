import { useRef, type ReactNode } from 'react';
import { Mic, Sparkles, Upload } from 'lucide-react';
import type { AudioSourceKind } from '../audio/types';
import { cn } from '../utils/format';

interface SourcePanelProps {
  source: AudioSourceKind;
  onSynth: () => void;
  onFile: (file: File) => void;
  onMic: () => void;
}

export const AUDIO_ACCEPT = 'audio/*,.mp3,.wav,.ogg,.m4a,.flac';

function SourceButton({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
        active
          ? 'neon-ring border-transparent bg-white/[0.07]'
          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]',
      )}
    >
      <span
        className={cn(
          'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition',
          active ? 'neon-gradient text-black' : 'bg-white/[0.06] text-white/70 group-hover:text-white',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-white/90">{title}</span>
        <span className="block truncate text-[11px] text-white/40">{subtitle}</span>
      </span>
    </button>
  );
}

export function SourcePanel({ source, onSynth, onFile, onMic }: SourcePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="glass pointer-events-auto w-64 space-y-2 rounded-2xl p-3" aria-label="Fuente de audio">
      <h2 className="px-1 pb-1 text-[10px] font-semibold tracking-[0.25em] text-white/45 uppercase">Fuente de audio</h2>
      <SourceButton
        active={source === 'synth'}
        icon={<Sparkles className="h-4 w-4" />}
        title="Demo Synthwave"
        subtitle="Sintetizador procedural en vivo"
        onClick={onSynth}
      />
      <SourceButton
        active={source === 'file'}
        icon={<Upload className="h-4 w-4" />}
        title="Subir archivo"
        subtitle="MP3 · WAV · OGG — o arrástralo"
        onClick={() => inputRef.current?.click()}
      />
      <SourceButton
        active={source === 'mic'}
        icon={<Mic className="h-4 w-4" />}
        title="Micrófono"
        subtitle="Entrada en vivo (requiere permiso)"
        onClick={onMic}
      />
      <input
        ref={inputRef}
        type="file"
        accept={AUDIO_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = ''; // allow re-selecting the same file
        }}
      />
    </section>
  );
}
