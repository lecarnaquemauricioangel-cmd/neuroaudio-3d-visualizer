import { FileAudio } from 'lucide-react';

export function DropOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="flex h-full max-h-[28rem] w-full max-w-2xl flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-[var(--accent-a)] bg-white/[0.03] shadow-[0_0_80px_-20px_var(--accent-a)]">
        <FileAudio className="h-12 w-12 animate-pulse-glow text-[var(--accent-a)]" />
        <p className="font-display text-lg tracking-[0.2em]">SUELTA TU AUDIO</p>
        <p className="text-xs text-white/50">MP3 · WAV · OGG · M4A · FLAC</p>
      </div>
    </div>
  );
}
