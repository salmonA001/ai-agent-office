import { useSyncExternalStore } from "react";

/** Local profile (display name), kept in this browser only. There is no sign-in. */
const KEY = "office.profile.name";
const listeners = new Set<() => void>();
let cached: string | null = null;

function read() {
  if (cached !== null) return cached;
  try {
    cached = localStorage.getItem(KEY) ?? "";
  } catch {
    cached = "";
  }
  return cached;
}

export function setProfileName(name: string) {
  cached = name.slice(0, 40);
  try {
    localStorage.setItem(KEY, cached);
  } catch {
    // storage unavailable: keep it for this session
  }
  listeners.forEach((l) => l());
}

export function useProfileName() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    read,
    () => "",
  );
}
