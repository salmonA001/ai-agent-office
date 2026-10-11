import { useEffect, useMemo } from "react";

export function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Deterministic noise so procedural textures look the same on every render. */
export function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Stable pseudo-random value in [0, 1) for a step number. */
export function hash(n: number) {
  const h = Math.sin(n * 12.9898) * 43758.5453;
  return h - Math.floor(h);
}

/** Builds a texture once per key and disposes it when the key changes or the scene unmounts. */
export function useDisposable<T extends { dispose(): void }>(factory: () => T, key: string) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => factory(), [key]);
  useEffect(() => () => value.dispose(), [value]);
  return value;
}
