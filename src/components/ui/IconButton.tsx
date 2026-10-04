import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/format';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  children: ReactNode;
}

/** Square glass button with an accessible label and tooltip. */
export function IconButton({ label, active = false, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'glass grid h-10 w-10 place-items-center rounded-xl text-white/80 transition',
        'hover:text-white hover:brightness-125 active:scale-95',
        active && 'neon-ring text-white',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
