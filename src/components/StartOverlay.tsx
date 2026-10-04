import { useRef } from 'react';
import { Headphones, Mic, Sparkles, Upload } from 'lucide-react';
import { AUDIO_ACCEPT } from './SourcePanel';

interface StartOverlayProps {
  onSynth: () => void;
  onFile: (file: File) => void;
  onMic: () => void;
}

/**
 * First-run splash. Browsers block audio until a user gesture, so the AudioContext is
 * only created when one of these buttons is pressed — the 3D scene already idles behind.
 */
export function StartOverlay({ onSynth, onFile, onMic }: StartOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/35 p-4 backdrop-blur-[2px]">
      <div className="glass w-full max-w-lg rounded-3xl p-7 text-center sm:p-9">
        <p className="mb-3 text-[10px] font-semibold tracking-[0.4em] text-white/45 uppercase">WebGL · Web Audio API</p>
        <h1 className="font-display text-3xl leading-tight font-extrabold tracking-wider sm:text-4xl">
          NEURO<span className="neon-text">AUDIO</span> 3D
        </h1>
        <p className="mt-1 text-xs tracking-[0.35em] text-white/50 uppercase">Visualizer &amp; Studio</p>
        <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-white/60">
          Visualización 3D reactiva en tiempo real: partículas neuronales, grids cyberpunk y túneles hipnóticos que
          bailan con tu música.
        </p>

        <button
          type="button"
          onClick={onSynth}
          className="neon-gradient mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold tracking-wide text-black shadow-[0_0_40px_-8px_var(--accent-a)] transition hover:brightness-110 active:scale-[0.98]"
        >
          <Sparkles className="h-4 w-4" />
          Iniciar con demo Synthwave
        </button>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.08]"
          >
            <Upload className="h-4 w-4" />
            Subir audio
          </button>
          <button
            type="button"
            onClick={onMic}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.08]"
          >
            <Mic className="h-4 w-4" />
            Micrófono
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={AUDIO_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = '';
          }}
        />

        <p className="mt-6 flex items-center justify-center gap-2 text-[11px] text-white/35">
          <Headphones className="h-3.5 w-3.5" />
          Mejor con auriculares · También puedes arrastrar un archivo a la ventana
        </p>
      </div>
    </div>
  );
}
