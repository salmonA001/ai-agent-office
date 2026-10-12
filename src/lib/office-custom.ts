import { useSyncExternalStore } from "react";
import { SPOT_CATS, type SpotCat } from "@/components/office-nav";

/** How the office looks and what the agents do on their breaks. Saved in this browser. */

export const FLOOR_STYLES = ["tile", "wood", "carpet", "concrete"] as const;
export const DESK_FINISHES = ["white", "oak", "walnut", "black"] as const;
export const ACCENTS = ["slate", "sage", "sky", "blush", "sun"] as const;
export const LIGHTING = ["auto", "fast", "day", "sunset", "night"] as const;
export const DECOR_ITEMS = ["plants", "rugs", "art", "lamps", "deskItems", "aquarium", "stringLights", "sign"] as const;
export const BREAKS = ["rare", "normal", "often"] as const;

export type FloorStyle = (typeof FLOOR_STYLES)[number];
export type DeskFinish = (typeof DESK_FINISHES)[number];
export type Accent = (typeof ACCENTS)[number];
export type Lighting = (typeof LIGHTING)[number];
export type DecorItem = (typeof DECOR_ITEMS)[number];
export type Breaks = (typeof BREAKS)[number];
export type Phase = "day" | "sunset" | "night";

export type OfficeCustom = {
  floor: FloorStyle;
  desk: DeskFinish;
  accent: Accent;
  lighting: Lighting;
  items: Record<DecorItem, boolean>;
  sign: string;
  activities: Record<SpotCat, boolean>;
  breaks: Breaks;
  events: boolean;
};

export const ACCENT_COLORS: Record<Accent, string> = {
  slate: "#8f9aa1",
  sage: "#8fb9a0",
  sky: "#8ab4d8",
  blush: "#e3a4b4",
  sun: "#e8c26a",
};

export const FLOOR_SWATCH: Record<FloorStyle, string> = {
  tile: "#e9ebee",
  wood: "#c8925c",
  carpet: "#7d8fa6",
  concrete: "#b9b8b4",
};

export const DESK_COLORS: Record<DeskFinish, { top: string; legs: string }> = {
  white: { top: "#f4f4f2", legs: "#374151" },
  oak: { top: "#d9b07c", legs: "#4b3a2a" },
  walnut: { top: "#7a5236", legs: "#2b2f33" },
  black: { top: "#2f3236", legs: "#111317" },
};

export const SIGN_MAX = 18;

export const DEFAULT_CUSTOM: OfficeCustom = {
  floor: "tile",
  desk: "white",
  accent: "slate",
  lighting: "auto",
  items: { plants: true, rugs: true, art: true, lamps: true, deskItems: true, aquarium: true, stringLights: true, sign: true },
  sign: "AGENT HQ",
  activities: Object.fromEntries(SPOT_CATS.map((c) => [c, true])) as Record<SpotCat, boolean>,
  breaks: "normal",
  events: true,
};

const KEY = "office.custom";

/** Keep only known values so an old or hand-edited save can't break the scene. */
function sanitize(raw: unknown): OfficeCustom {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<OfficeCustom>;
  const pick = <T extends string>(list: readonly T[], v: unknown, d: T) => (list.includes(v as T) ? (v as T) : d);
  const flags = <K extends string>(keys: readonly K[], v: unknown, d: Record<K, boolean>) =>
    Object.fromEntries(keys.map((k) => [k, typeof (v as Record<string, unknown>)?.[k] === "boolean" ? (v as Record<K, boolean>)[k] : d[k]])) as Record<K, boolean>;
  return {
    floor: pick(FLOOR_STYLES, r.floor, DEFAULT_CUSTOM.floor),
    desk: pick(DESK_FINISHES, r.desk, DEFAULT_CUSTOM.desk),
    accent: pick(ACCENTS, r.accent, DEFAULT_CUSTOM.accent),
    lighting: pick(LIGHTING, r.lighting, DEFAULT_CUSTOM.lighting),
    items: flags(DECOR_ITEMS, r.items, DEFAULT_CUSTOM.items),
    sign: typeof r.sign === "string" ? r.sign.slice(0, SIGN_MAX) : DEFAULT_CUSTOM.sign,
    activities: flags(SPOT_CATS, r.activities, DEFAULT_CUSTOM.activities),
    breaks: pick(BREAKS, r.breaks, DEFAULT_CUSTOM.breaks),
    events: typeof r.events === "boolean" ? r.events : DEFAULT_CUSTOM.events,
  };
}

let custom: OfficeCustom = DEFAULT_CUSTOM;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) custom = sanitize(JSON.parse(raw));
  } catch {
    // storage unavailable: use the defaults
  }
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getOfficeCustom() {
  load();
  return custom;
}

export function setOfficeCustom(patch: Partial<OfficeCustom>) {
  load();
  custom = sanitize({ ...custom, ...patch });
  try {
    localStorage.setItem(KEY, JSON.stringify(custom));
  } catch {
    // storage unavailable: the change still applies until reload
  }
  listeners.forEach((l) => l());
}

export function resetOfficeCustom() {
  setOfficeCustom(DEFAULT_CUSTOM);
}

export function useOfficeCustom() {
  return useSyncExternalStore(subscribe, getOfficeCustom, () => DEFAULT_CUSTOM);
}
