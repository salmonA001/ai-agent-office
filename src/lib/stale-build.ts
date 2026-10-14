"use client";

import { useSyncExternalStore } from "react";
import { translate } from "./i18n";

/**
 * A tab opened before a deploy still runs the old build. The moment it lazy-loads something (the
 * in-browser AI, the PDF reader, the 3D office) it asks for a file the new deploy no longer has,
 * and the import fails with "Failed to load chunk …". Recognise that, say so in plain words, and
 * offer a reload (which loads the new build; tasks are saved, so nothing is lost).
 */

const STALE = /failed to load chunk|loading chunk .* failed|chunkloaderror|error loading dynamically imported module|importing a module script failed|failed to fetch dynamically imported module/i;

export function isStaleBuildError(err: unknown) {
  const message = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? "");
  return STALE.test(message);
}

let outdated = false;
const listeners = new Set<() => void>();

export function markOutdated() {
  if (outdated) return;
  outdated = true;
  listeners.forEach((l) => l());
}

export function useOutdated() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => outdated,
    () => false,
  );
}

const lang = () => (typeof document !== "undefined" && document.documentElement.lang === "th" ? "th" : "en");

/** `import()` that turns a missing old file into a clear "the app was updated, reload" error. */
export async function importFresh<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (err) {
    if (!isStaleBuildError(err)) throw err;
    markOutdated();
    throw new Error(translate(lang(), "update.error"));
  }
}

/** Catch stale-file failures that escape elsewhere (e.g. a lazily loaded component). */
export function watchForStaleBuild() {
  if (typeof window === "undefined") return () => {};
  const onRejection = (e: PromiseRejectionEvent) => {
    if (isStaleBuildError(e.reason)) markOutdated();
  };
  const onError = (e: ErrorEvent) => {
    if (isStaleBuildError(e.error ?? e.message)) markOutdated();
  };
  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("error", onError);
  return () => {
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("error", onError);
  };
}
