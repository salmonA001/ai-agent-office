import { useSyncExternalStore } from "react";

/** The six working zones of the office, and where the camera looks to show each one. */
export type ZoneId = "engine" | "social" | "labs" | "pods" | "fitness" | "hub";
export const ZONE_IDS: ZoneId[] = ["engine", "social", "labs", "pods", "fitness", "hub"];
export const ZONE_LOOK: Record<ZoneId, [number, number]> = {
  engine: [5, 7.5],
  social: [2, 6],
  labs: [12.8, 20.6],
  pods: [4.7, 20.6],
  fitness: [-3.5, 20.6],
  hub: [21.5, 20.6],
};

/** Which zone the camera flies to; `n` counts requests so the same zone can be picked twice. null = the user moved the camera. */
export type CameraFocus = { id: ZoneId | "all" | null; n: number };

let focus: CameraFocus = { id: null, n: 0 };
const listeners = new Set<() => void>();

function emit(next: CameraFocus) {
  focus = next;
  listeners.forEach((l) => l());
}

export function focusZone(id: ZoneId | "all") {
  emit({ id, n: focus.n + 1 });
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

const SERVER: CameraFocus = { id: null, n: 0 };

export function useCameraFocus() {
  return useSyncExternalStore(subscribe, () => focus, () => SERVER);
}
