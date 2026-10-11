import { useSyncExternalStore } from "react";

/** What each agent is doing in the 3D office right now, in plain words (e.g. "Getting coffee at the coffee machine"). */
const activity = new Map<string, string>();
const listeners = new Set<() => void>();

export function setAgentActivity(id: string, text: string) {
  if (activity.get(id) === text) return;
  activity.set(id, text);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAgentActivity(id: string | null) {
  return useSyncExternalStore(
    subscribe,
    () => (id ? activity.get(id) : undefined),
    () => undefined,
  );
}
