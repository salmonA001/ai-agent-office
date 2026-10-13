import { useSyncExternalStore } from "react";

/**
 * Motion preference for the whole app.
 * - "full": everything animates and agents walk around (default; this office is meant to move)
 * - "system": follow the device's reduce-motion setting
 * - "reduced": agents stay seated and decorative animation stops
 */
export type Motion = "full" | "system" | "reduced";
export const MOTIONS: Motion[] = ["full", "system", "reduced"];

const KEY = "office.motion";
const listeners = new Set<() => void>();

function initial(): Motion {
  if (typeof window === "undefined") return "full";
  try {
    const saved = localStorage.getItem(KEY) as Motion | null;
    if (saved && MOTIONS.includes(saved)) return saved;
  } catch {
    // storage unavailable
  }
  return "full";
}

let motion: Motion = initial();

/** True when animations should be skipped (the Motion setting, or the device asking for less). */
export function motionOff() {
  if (typeof document === "undefined") return true;
  const m = document.documentElement.dataset.motion;
  return m === "reduced" || (m === "system" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

export function setMotion(next: Motion) {
  motion = next;
  document.documentElement.dataset.motion = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // storage unavailable: keep it for this session
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useMotion() {
  return useSyncExternalStore(
    subscribe,
    () => motion,
    () => "full" as Motion,
  );
}

const QUERY = "(prefers-reduced-motion: reduce)";

/** Whether the device itself asks for reduced motion (e.g. Windows "Animation effects" off). */
export function useDeviceReducedMotion() {
  return useSyncExternalStore(
    (l) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener("change", l);
      return () => mq.removeEventListener("change", l);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** True when animation should stop: the user picked "reduced", or "system" on a reduced-motion device. */
export function useStill() {
  const m = useMotion();
  const device = useDeviceReducedMotion();
  return m === "reduced" || (m === "system" && device);
}
