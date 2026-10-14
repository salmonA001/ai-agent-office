"use client";

import { useSyncExternalStore } from "react";
import { getSupabase } from "./supabase/client";

/**
 * Keeps the office in the signed-in person's Supabase account.
 *
 * The app already saves everything it needs in localStorage, so instead of rewiring every module
 * this mirrors those keys: on sign-in it merges the account with what's in this browser (writing
 * the result back and reloading once if anything changed), then every few seconds it uploads the
 * keys that changed. Row level security on `user_state` means a person can only ever read and
 * write their own rows, whatever the browser sends.
 */

/** What follows you to another device. Device-only keys (`office.idle`, `office.running`) stay out. */
export const SYNCED_KEYS = [
  "office.tasks",
  "office.agents",
  "office.game",
  "office.rewarded",
  "office.custom",
  "office.profile.name",
  "office.ai",
  "office.theme",
  "office.lang",
  "office.motion",
] as const;
type SyncedKey = (typeof SYNCED_KEYS)[number];

/** Look-and-feel stays in the browser after signing out; the office itself leaves with the account. */
const KEEP_ON_SIGN_OUT: SyncedKey[] = ["office.theme", "office.lang", "office.motion"];

const TABLE = "user_state";
const TICK_MS = 3000;
const MAX_AGENTS = 36;
const RELOAD_FLAG = "office.sync.reloaded";

export type AccountState = {
  /** Supabase is configured on this deployment */
  enabled: boolean;
  /** the first session check has finished */
  ready: boolean;
  user: { id: string; email: string } | null;
  sync: "idle" | "syncing" | "saving" | "saved" | "error";
  savedAt?: number;
};

let state: AccountState = { enabled: false, ready: false, user: null, sync: "idle" };
const SERVER_STATE: AccountState = state;
const listeners = new Set<() => void>();
function set(patch: Partial<AccountState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useAccount() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => SERVER_STATE,
  );
}

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage full or blocked: the account still has it
  }
};
const parse = <T,>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

type WithId = { id: string; createdAt?: number; status?: string };

/**
 * Account + browser → one value. Deterministic, and merge(x, x) === x, so a second pass after
 * the reload changes nothing.
 */
export function mergeValue(key: string, local: string | null, remote: string | null): string | null {
  if (local === remote || local === null) return remote;
  if (remote === null) return local;
  switch (key) {
    case "office.tasks": {
      // every task from both; for the same task, the finished copy, else the account's
      const byId = new Map<string, WithId>();
      for (const t of parse<WithId[]>(remote, [])) byId.set(t.id, t);
      for (const t of parse<WithId[]>(local, [])) {
        const other = byId.get(t.id);
        if (!other || (t.status === "done" && other.status !== "done")) byId.set(t.id, t);
      }
      const all = [...byId.values()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0) || a.id.localeCompare(b.id));
      return JSON.stringify(all);
    }
    case "office.agents": {
      const out = parse<WithId[]>(remote, []);
      const ids = new Set(out.map((a) => a.id));
      for (const a of parse<WithId[]>(local, [])) if (!ids.has(a.id)) out.push(a);
      return JSON.stringify(out.slice(0, MAX_AGENTS));
    }
    case "office.game": {
      // XP never goes down: the higher of the two for each agent
      type Game = { xp?: Record<string, number>; log?: unknown[]; eventsHandled?: number };
      const r = parse<Game>(remote, {});
      const l = parse<Game>(local, {});
      const xp: Record<string, number> = { ...(r.xp ?? {}) };
      for (const [id, n] of Object.entries(l.xp ?? {})) xp[id] = Math.max(xp[id] ?? 0, n);
      const rEvents = r.eventsHandled ?? 0;
      const lEvents = l.eventsHandled ?? 0;
      const sorted = Object.fromEntries(Object.entries(xp).sort(([a], [b]) => a.localeCompare(b)));
      return JSON.stringify({ xp: sorted, log: (lEvents > rEvents ? l.log : r.log) ?? [], eventsHandled: Math.max(rEvents, lEvents) });
    }
    case "office.rewarded": {
      const r = parse<string[]>(remote, []);
      const seen = new Set(r);
      return JSON.stringify([...r, ...parse<string[]>(local, []).filter((x) => !seen.has(x))].slice(-500));
    }
    default:
      // settings: the account's choice wins
      return remote;
  }
}

/** What's in the account right now, as far as this tab knows. */
const synced = new Map<SyncedKey, string>();
let timer: ReturnType<typeof setInterval> | null = null;
let uploading = false;
let started = false;

export function startCloudSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  const supabase = getSupabase();
  if (!supabase) {
    set({ enabled: false, ready: true });
    return;
  }
  set({ enabled: true });
  supabase.auth.onAuthStateChange((event, session) => {
    const user = session?.user ? { id: session.user.id, email: session.user.email ?? "" } : null;
    // Supabase asks not to await its own calls inside this callback: defer the work
    setTimeout(() => {
      if (user && user.id !== state.user?.id) void connect(user);
      else if (!user && (event === "SIGNED_OUT" || event === "INITIAL_SESSION")) {
        stop();
        set({ ready: true, user: null, sync: "idle" });
      }
    }, 0);
  });
  window.addEventListener("pagehide", () => void upload());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void upload();
  });
}

async function connect(user: { id: string; email: string }) {
  const supabase = getSupabase();
  if (!supabase) return;
  stop();
  set({ ready: true, user, sync: "syncing" });
  const { data, error } = await supabase.from(TABLE).select("key, value");
  if (error) {
    // don't upload over an account we couldn't read; try again shortly
    set({ sync: "error" });
    setTimeout(() => state.user?.id === user.id && void connect(user), 30_000);
    return;
  }
  const remote = new Map<string, string>(data.map((row: { key: string; value: string }) => [row.key, row.value]));
  synced.clear();
  let changedHere = false;
  for (const key of SYNCED_KEYS) {
    const theirs = remote.get(key) ?? null;
    if (theirs !== null) synced.set(key, theirs);
    const local = read(key);
    const merged = mergeValue(key, local, theirs);
    if (merged !== null && merged !== local) {
      write(key, merged);
      changedHere = true;
    }
  }
  // push what the account didn't have yet (a guest's office on first sign-in, merged extras)
  set({ sync: "idle" });
  await upload();
  if (changedHere && state.user?.id === user.id) {
    // every part of the office reads its saved state once at start: reload to pick up the account
    let recent = 0;
    try {
      recent = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0);
      sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
    } catch {
      // without sessionStorage there's no loop guard: skip the reload, changes apply next visit
      recent = Date.now();
    }
    if (Date.now() - recent > 15_000) {
      window.location.reload();
      return;
    }
  }
  timer = setInterval(() => void upload(), TICK_MS);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Send the keys that changed since the last save (and remove ones the office deleted). */
async function upload() {
  const supabase = getSupabase();
  const user = state.user;
  if (!supabase || !user || uploading || state.sync === "syncing") return;
  const changed: { key: SyncedKey; value: string }[] = [];
  const removed: SyncedKey[] = [];
  for (const key of SYNCED_KEYS) {
    const value = read(key);
    if (value === null) {
      if (synced.has(key)) removed.push(key);
    } else if (synced.get(key) !== value) changed.push({ key, value });
  }
  if (!changed.length && !removed.length) return;
  uploading = true;
  set({ sync: "saving" });
  try {
    if (changed.length) {
      const { error } = await supabase.from(TABLE).upsert(changed.map(({ key, value }) => ({ user_id: user.id, key, value })));
      if (error) throw error;
      changed.forEach(({ key, value }) => synced.set(key, value));
    }
    if (removed.length) {
      const { error } = await supabase.from(TABLE).delete().in("key", removed);
      if (error) throw error;
      removed.forEach((key) => synced.delete(key));
    }
    if (state.user?.id === user.id) set({ sync: "saved", savedAt: Date.now() });
  } catch {
    // keep the changes queued: the next tick tries again
    if (state.user?.id === user.id) set({ sync: "error" });
  } finally {
    uploading = false;
  }
}

export async function signIn(email: string, password: string) {
  const supabase = getSupabase();
  if (!supabase) return { error: "off" as const };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message };
}

/** Returns whether the person still has to confirm their email before signing in. */
export async function signUp(email: string, password: string) {
  const supabase = getSupabase();
  if (!supabase) return { error: "off" as const };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
  return { error: error?.message, confirm: !error && !data.session };
}

/** Save anything pending, sign out, and take the office off this browser (it stays in the account). */
export async function signOut() {
  const supabase = getSupabase();
  if (!supabase) return;
  await upload();
  stop();
  await supabase.auth.signOut();
  for (const key of SYNCED_KEYS) {
    if (KEEP_ON_SIGN_OUT.includes(key)) continue;
    try {
      localStorage.removeItem(key);
    } catch {
      // nothing stored
    }
  }
  synced.clear();
  window.location.reload();
}
