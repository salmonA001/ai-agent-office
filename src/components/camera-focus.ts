import { useSyncExternalStore } from "react";

/** The six working zones of the office, and where the camera looks to show each one. */
export type ZoneId = "engine" | "social" | "labs" | "pods" | "fitness" | "hub";
export const ZONE_IDS: ZoneId[] = ["engine", "social", "labs", "pods", "fitness", "hub"];
export const ZONE_LOOK: Record<ZoneId, [number, number]> = {
  engine: [5, 7.5],
  social: [1.5, 12.5],
  labs: [12.8, 20.6],
  pods: [4.7, 20.6],
  fitness: [-3.5, 20.6],
  hub: [21.5, 20.6],
};

/**
 * Which zone the camera flies to ("roof": up to the rooftop); `n` counts requests so the same zone
 * can be picked twice. null = the user moved the camera. `level` is the floor on show (0 ground, 1 roof).
 */
export type CameraFocus = { id: ZoneId | "all" | "roof" | null; n: number; level: 0 | 1 };

let focus: CameraFocus = { id: null, n: 0, level: 0 };
const listeners = new Set<() => void>();

function emit(next: CameraFocus) {
  focus = next;
  listeners.forEach((l) => l());
}

export function focusZone(id: ZoneId | "all" | "roof") {
  follow = null;
  emit({ id, n: focus.n + 1, level: id === "roof" ? 1 : 0 });
}

/** Show the other floor (the camera follows an agent who takes the elevator). */
export function showLevel(level: 0 | 1) {
  if (focus.level !== level) emit({ ...focus, id: level ? "roof" : null, level });
}

/** The floor on show, read every frame by the 3D scene. */
export function getLevel() {
  return focus.level;
}

/** The agent the camera keeps in view (the one clicked), or null. Read every frame, so no re-render. */
let follow: string | null = null;

export function setFollow(id: string | null) {
  follow = id;
}

export function getFollow() {
  return follow;
}

/** The user took over the camera, so no zone is selected any more. */
export function releaseFocus() {
  if (focus.id !== null) emit({ ...focus, id: null });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const SERVER: CameraFocus = { id: null, n: 0, level: 0 };

export function useCameraFocus() {
  return useSyncExternalStore(subscribe, () => focus, () => SERVER);
}
