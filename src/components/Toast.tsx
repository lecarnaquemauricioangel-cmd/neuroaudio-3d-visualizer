import { useEffect } from 'react';
import { TriangleAlert, X } from 'lucide-react';

interface ToastProps {
  message: string;
  onDismiss: () => void;
  timeoutMs?: number;
}

export function Toast({ message, onDismiss, timeoutMs = 6000 }: ToastProps) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, timeoutMs);
    return () => window.clearTimeout(id);
  }, [message, onDismiss, timeoutMs]);

  return (
    <div
      role="alert"
      className="glass pointer-events-auto fixed top-20 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-start gap-3 rounded-xl border-rose-400/30 px-4 py-3 text-sm"
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
      <p className="text-white/85">{message}</p>
      <button type="button" onClick={onDismiss} aria-label="Cerrar aviso" className="text-white/50 hover:text-white">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
