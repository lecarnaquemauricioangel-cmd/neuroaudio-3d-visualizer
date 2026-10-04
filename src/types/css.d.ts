import 'react';

declare module 'react' {
  /** Allow CSS custom properties (e.g. `--accent-a`) in inline styles without casts. */
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
