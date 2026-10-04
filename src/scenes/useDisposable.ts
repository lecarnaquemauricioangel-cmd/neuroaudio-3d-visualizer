import { useEffect, useMemo, type DependencyList } from 'react';

interface Disposable {
  dispose: () => void;
}

/**
 * `useMemo` for imperatively created Three.js resources (geometries, materials,
 * textures) that guarantees `dispose()` when deps change or the component unmounts,
 * freeing the GPU buffers and preventing memory leaks between scene switches.
 *
 * Three.js transparently re-uploads a disposed resource if it is rendered again,
 * so StrictMode's double effect invocation is harmless.
 */
export function useDisposable<T extends Disposable>(factory: () => T, deps: DependencyList): T {
  const resource = useMemo(factory, deps);
  useEffect(() => () => resource.dispose(), [resource]);
  return resource;
}
