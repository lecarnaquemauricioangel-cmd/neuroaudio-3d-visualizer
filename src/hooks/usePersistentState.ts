import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * `useState` mirrored to localStorage. Storage may be unavailable (private mode,
 * blocked cookies), so every access is guarded and the app works without it.
 * Stored values are shallow-merged over `initial` so new settings keys get defaults.
 */
export function usePersistentState<T extends object>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initial;
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? { ...initial, ...(parsed as Partial<T>) } : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable — keep in-memory state only */
    }
  }, [key, value]);

  return [value, setValue];
}
